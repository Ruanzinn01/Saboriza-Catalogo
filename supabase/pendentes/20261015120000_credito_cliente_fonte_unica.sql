-- Crédito do cliente: fonte única (ficha, pedidos, Faturar), reserva idempotente,
-- autorização por operação e bloqueio no servidor. NÃO aplicada em produção.
-- Não reaplica nem edita migrations anteriores; substitui funções por create or replace.

-- 1) Auditoria de limite e autorizações por operação ---------------------------------------

create table public.credit_limit_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  customer_id uuid not null references public.customers(id),
  old_limit numeric not null,
  new_limit numeric not null,
  reason text not null check (length(trim(reason)) >= 5),
  changed_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.credit_limit_changes enable row level security;
create policy credit_limit_changes_select on public.credit_limit_changes for select
  using (private.has_permission(company_id, 'billing.view_credit_analysis'));

create table public.credit_authorizations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null references public.orders(id),
  customer_id uuid not null references public.customers(id),
  restrictions text[] not null,
  authorized_restrictions text[] not null default '{}',
  reason text not null check (length(trim(reason)) >= 5),
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','AUTORIZADA','NEGADA','INVALIDADA')),
  order_total numeric not null,
  snapshot jsonb not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index credit_authorizations_one_pending on public.credit_authorizations (order_id) where status = 'PENDENTE';
create index credit_authorizations_order_idx on public.credit_authorizations (order_id, status);
alter table public.credit_authorizations enable row level security;
create policy credit_authorizations_select on public.credit_authorizations for select
  using (private.has_permission(company_id, 'billing.view_credit_analysis')
      or private.has_permission(company_id, 'billing.request_credit_release'));

-- escrita só via RPC (security definer)
revoke insert, update, delete on public.customer_credit from authenticated;
revoke insert, update, delete on public.credit_commitments from authenticated;

-- reserva idempotente: no máximo um compromisso aberto por pedido
create unique index credit_commitments_one_open_per_order on public.credit_commitments (order_id) where status = 'ABERTO';

-- 2) Cálculo único ------------------------------------------------------------------------

create or replace function private.compute_credit_snapshot(p_customer_id uuid, p_financed_part numeric, p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_limit numeric;
  v_has_policy boolean;
  v_open numeric;
  v_overdue numeric;
  v_overdue_count int;
  v_max_days int;
  v_commit numeric;
  v_own numeric;
  v_current numeric;
  v_projected numeric;
begin
  select credit_limit into v_limit from public.customer_credit where customer_id = p_customer_id;
  v_has_policy := found;
  v_limit := coalesce(v_limit, 0);

  select coalesce(sum(amount), 0),
         coalesce(sum(amount) filter (where due_date < v_today), 0),
         count(*) filter (where due_date < v_today),
         coalesce(max(v_today - due_date) filter (where due_date < v_today), 0)
    into v_open, v_overdue, v_overdue_count, v_max_days
  from public.receivables
  where customer_id = p_customer_id and status in ('ABERTO', 'VENCIDO');

  select coalesce(sum(amount), 0),
         coalesce(sum(amount) filter (where order_id is not distinct from p_order_id and p_order_id is not null), 0)
    into v_commit, v_own
  from public.credit_commitments
  where customer_id = p_customer_id and status = 'ABERTO';

  v_current := v_open + v_commit;
  v_projected := v_current - v_own + coalesce(p_financed_part, 0);

  return jsonb_build_object(
    'has_policy', v_has_policy,
    'credit_limit', v_limit,
    'open_receivables', v_open,
    'overdue_amount', v_overdue,
    'overdue_count', v_overdue_count,
    'max_overdue_days', v_max_days,
    'commitments', v_commit,
    'own_commitment', v_own,
    'current_exposure', v_current,
    'available', v_limit - v_current,
    'current_excess', greatest(0, v_current - v_limit),
    'financed_part', coalesce(p_financed_part, 0),
    'projected_exposure', v_projected,
    'available_after', v_limit - v_projected,
    'excess', greatest(0, v_projected - v_limit),
    'as_of', now(),
    'fingerprint', md5(concat_ws('|', v_limit, v_open, v_overdue, v_commit, v_own, coalesce(p_financed_part, 0)))
  );
end;
$$;

create or replace function private.compute_credit_snapshot(p_customer_id uuid, p_financed_part numeric)
returns jsonb
language sql
stable
set search_path to ''
as $$ select private.compute_credit_snapshot(p_customer_id, p_financed_part, null::uuid) $$;

create or replace function private.credit_blockers(p_snapshot jsonb)
returns text[]
language sql
immutable
set search_path to ''
as $$
  select coalesce(array_remove(array[
    case when (p_snapshot->>'overdue_amount')::numeric > 0 then 'OVERDUE' end,
    case when (p_snapshot->>'excess')::numeric > 0 then 'OVER_LIMIT' end
  ], null), '{}'::text[])
$$;

-- impedimentos ainda não cobertos por autorização vigente (escopo, validade e valor do pedido)
create or replace function private.credit_uncovered(p_order_id uuid, p_blockers text[])
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(array(
    select b from unnest(p_blockers) b
    where not exists (
      select 1
      from public.credit_authorizations a
      join public.orders o on o.id = a.order_id
      where a.order_id = p_order_id
        and a.status = 'AUTORIZADA'
        and b = any(a.authorized_restrictions)
        and a.customer_id = o.customer_id
        and (a.expires_at is null or a.expires_at > now())
        and o.total_amount <= a.order_total
    )
  ), '{}'::text[])
$$;

create or replace function private.convert_credit_commitment(p_order_id uuid, p_receivable_id uuid)
returns void
language sql
security definer
set search_path to ''
as $$
  update public.credit_commitments set status = 'CONVERTIDO', converted_receivable_id = p_receivable_id
  where order_id = p_order_id and status = 'ABERTO'
$$;

-- 3) Reserva de crédito na transição existente para CONFIRMED -----------------------------

create or replace function private.sync_credit_commitment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.customer_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));

  if new.status = 'CONFIRMED'
     and (tg_op = 'INSERT' or old.status is distinct from 'CONFIRMED')
     and exists (select 1 from public.customer_credit where customer_id = new.customer_id)
     and not exists (select 1 from public.billings where order_id = new.id and status = 'CONFIRMADO') then
    insert into public.credit_commitments (customer_id, order_id, amount, company_id)
    values (new.customer_id, new.id, new.total_amount, new.company_id)
    on conflict (order_id) where status = 'ABERTO' do update set amount = excluded.amount;
  elsif tg_op = 'UPDATE' and new.status = 'CANCELLED' then
    update public.credit_commitments set status = 'CANCELADO' where order_id = new.id and status = 'ABERTO';
    update public.credit_authorizations set status = 'INVALIDADA' where order_id = new.id and status in ('PENDENTE', 'AUTORIZADA');
  elsif tg_op = 'UPDATE' and new.total_amount is distinct from old.total_amount then
    update public.credit_commitments set amount = new.total_amount where order_id = new.id and status = 'ABERTO';
    if new.total_amount > old.total_amount then
      update public.credit_authorizations set status = 'INVALIDADA'
      where order_id = new.id and status in ('PENDENTE', 'AUTORIZADA') and order_total < new.total_amount;
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_sync_credit_commitment
  after insert or update of status, total_amount on public.orders
  for each row execute function private.sync_credit_commitment();

-- 4) Leitura compartilhada ----------------------------------------------------------------

create or replace function public.oris360_credit_overview(p_customer_id uuid, p_order_id uuid default null, p_financed_part numeric default 0)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_company uuid;
  v_snap jsonb;
  v_blockers text[];
begin
  select company_id into v_company from public.customers where id = p_customer_id;
  if v_company is null or not private.has_permission(v_company, 'billing.view_credit_analysis') then
    return null;
  end if;
  if p_order_id is not null and not exists (select 1 from public.orders where id = p_order_id and customer_id = p_customer_id and company_id = v_company) then
    return null;
  end if;

  v_snap := private.compute_credit_snapshot(p_customer_id, p_financed_part, p_order_id);
  v_blockers := private.credit_blockers(v_snap);

  return v_snap || jsonb_build_object(
    'blockers', to_jsonb(v_blockers),
    'uncovered', to_jsonb(case when p_order_id is null then v_blockers else private.credit_uncovered(p_order_id, v_blockers) end),
    'authorization_pending', p_order_id is not null and exists (select 1 from public.credit_authorizations where order_id = p_order_id and status = 'PENDENTE')
  );
end;
$$;

create or replace function public.oris360_billing_context(p_order_id uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_company_id uuid;
  v_customer_id uuid;
  v_existing_billing_id uuid;
begin
  select company_id, customer_id into v_company_id, v_customer_id from public.orders where id = p_order_id;
  if v_company_id is null or not private.has_permission(v_company_id, 'billing.invoice_order') then
    return null;
  end if;
  select id into v_existing_billing_id from public.billings where order_id = p_order_id;
  return jsonb_build_object(
    'customer_id', v_customer_id,
    'billing_id', v_existing_billing_id,
    'snapshot', public.oris360_credit_overview(v_customer_id, p_order_id, 0)
  );
end;
$$;

create or replace function public.oris360_billing_quote(p_order_id uuid, p_financed_part numeric)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_company_id uuid;
  v_customer_id uuid;
begin
  select company_id, customer_id into v_company_id, v_customer_id from public.orders where id = p_order_id;
  if v_company_id is null or not private.has_permission(v_company_id, 'billing.invoice_order') then
    return null;
  end if;
  return private.compute_credit_snapshot(v_customer_id, p_financed_part, p_order_id)
    || jsonb_build_object(
      'blockers', to_jsonb(private.credit_blockers(private.compute_credit_snapshot(v_customer_id, p_financed_part, p_order_id))),
      'uncovered', to_jsonb(private.credit_uncovered(p_order_id, private.credit_blockers(private.compute_credit_snapshot(v_customer_id, p_financed_part, p_order_id))))
    );
end;
$$;

-- 5) Limite permanente (separado da edição cadastral) -------------------------------------

create or replace function public.oris360_set_credit_limit(p_customer_id uuid, p_new_limit numeric, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_old numeric;
begin
  select company_id into v_company from public.customers where id = p_customer_id;
  if v_company is null or not private.has_permission(v_company, 'customer_credit.change_permanent_limit') then
    raise exception 'sem permissao para alterar o limite de credito';
  end if;
  if p_new_limit is null or p_new_limit < 0 then
    raise exception 'limite invalido';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'motivo obrigatorio';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select credit_limit into v_old from public.customer_credit where customer_id = p_customer_id;
  insert into public.customer_credit (customer_id, company_id, credit_limit, updated_by)
  values (p_customer_id, v_company, p_new_limit, auth.uid())
  on conflict (customer_id) do update set credit_limit = excluded.credit_limit, updated_by = auth.uid();

  insert into public.credit_limit_changes (company_id, customer_id, old_limit, new_limit, reason)
  values (v_company, p_customer_id, coalesce(v_old, 0), p_new_limit, trim(p_reason));

  return public.oris360_credit_overview(p_customer_id, null, 0);
end;
$$;

-- 6) Liberação excepcional por operação ---------------------------------------------------

create or replace function public.oris360_credit_request_release(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order public.orders;
  v_snap jsonb;
  v_blockers text[];
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_order.customer_id is null
     or not private.has_permission(v_order.company_id, 'billing.request_credit_release') then
    raise exception 'sem permissao para solicitar liberacao';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'justificativa obrigatoria';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_order.customer_id::text, 0));

  select id into v_id from public.credit_authorizations where order_id = p_order_id and status = 'PENDENTE';
  if v_id is not null then
    return v_id;
  end if;

  v_snap := private.compute_credit_snapshot(v_order.customer_id, v_order.total_amount, p_order_id);
  v_blockers := private.credit_blockers(v_snap);
  if cardinality(v_blockers) = 0 then
    raise exception 'pedido sem impedimento de credito';
  end if;

  insert into public.credit_authorizations (company_id, order_id, customer_id, restrictions, reason, requested_by, order_total, snapshot)
  values (v_order.company_id, p_order_id, v_order.customer_id, v_blockers, trim(p_reason), auth.uid(), v_order.total_amount, v_snap)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.oris360_credit_authorize(p_order_id uuid, p_restrictions text[], p_reason text, p_valid_hours int default 24)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order public.orders;
  v_snap jsonb;
  v_blockers text[];
  v_pending public.credit_authorizations;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_order.customer_id is null
     or not private.has_permission(v_order.company_id, 'billing.authorize_credit_exception') then
    raise exception 'sem permissao para autorizar excecao de credito';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'justificativa obrigatoria';
  end if;
  if p_restrictions is null or cardinality(p_restrictions) = 0 or not p_restrictions <@ array['OVERDUE', 'OVER_LIMIT'] then
    raise exception 'restricoes invalidas';
  end if;
  if p_valid_hours is null or p_valid_hours < 1 or p_valid_hours > 72 then
    raise exception 'validade invalida';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_order.customer_id::text, 0));

  select * into v_pending from public.credit_authorizations where order_id = p_order_id and status = 'PENDENTE';
  if v_pending.id is not null and v_pending.requested_by = auth.uid() then
    raise exception 'o solicitante nao pode autorizar a propria liberacao';
  end if;

  v_snap := private.compute_credit_snapshot(v_order.customer_id, v_order.total_amount, p_order_id);
  v_blockers := private.credit_blockers(v_snap);

  update public.credit_authorizations set status = 'INVALIDADA'
  where order_id = p_order_id and status = 'AUTORIZADA';

  if v_pending.id is not null then
    update public.credit_authorizations
       set status = 'AUTORIZADA', authorized_restrictions = p_restrictions, decided_by = auth.uid(), decided_at = now(),
           expires_at = now() + make_interval(hours => p_valid_hours), order_total = v_order.total_amount,
           snapshot = v_snap, reason = reason || ' | decisao: ' || trim(p_reason)
     where id = v_pending.id
     returning id into v_id;
  else
    insert into public.credit_authorizations (company_id, order_id, customer_id, restrictions, authorized_restrictions, reason,
                                              requested_by, decided_by, decided_at, status, order_total, snapshot, expires_at)
    values (v_order.company_id, p_order_id, v_order.customer_id, v_blockers, p_restrictions, trim(p_reason),
            auth.uid(), auth.uid(), now(), 'AUTORIZADA', v_order.total_amount, v_snap, now() + make_interval(hours => p_valid_hours))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- 7) Faturamento: bloqueio no servidor, lock por cliente, conversão do compromisso -------

create or replace function public.oris360_billing_confirm(p_order_id uuid, p_payment_methods jsonb, p_fiscal_choice text, p_idempotency_key text)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_customer_id uuid;
  v_order_total numeric;
  v_billing_id uuid;
  v_financed_part numeric := 0;
  v_pm jsonb;
  v_pm_id uuid;
  v_inst jsonb;
  v_inst_id uuid;
  v_receivable_id uuid;
  v_first_receivable_id uuid;
  v_snap jsonb;
  v_uncovered text[];
begin
  select company_id, customer_id, total_amount into v_company_id, v_customer_id, v_order_total
  from public.orders where id = p_order_id;

  if v_company_id is null or not private.has_permission(v_company_id, 'billing.invoice_order') then
    raise exception 'sem permissao para faturar este pedido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text, 0));

  select id into v_billing_id from public.billings where idempotency_key = p_idempotency_key;
  if v_billing_id is not null then
    return v_billing_id;
  end if;

  if exists (select 1 from public.billings where order_id = p_order_id and status = 'CONFIRMADO') then
    raise exception 'pedido ja foi faturado';
  end if;

  select coalesce(sum((pm->>'amount')::numeric), 0) into v_financed_part
  from jsonb_array_elements(p_payment_methods) pm
  where coalesce((pm->>'generates_credit')::boolean, false);

  v_snap := private.compute_credit_snapshot(v_customer_id, v_financed_part, p_order_id);
  v_uncovered := private.credit_uncovered(p_order_id, private.credit_blockers(v_snap));
  if cardinality(v_uncovered) > 0 then
    raise exception 'credito bloqueado: %', array_to_string(v_uncovered, ', ');
  end if;

  insert into public.billings (order_id, customer_id, status, fiscal_choice, idempotency_key, company_id)
  values (p_order_id, v_customer_id, 'CONFIRMADO', p_fiscal_choice, p_idempotency_key, v_company_id)
  returning id into v_billing_id;

  insert into public.billing_credit_snapshots (
    billing_id, open_receivables, overdue_amount, overdue_count, commitments,
    credit_limit, current_exposure, financed_part, projected_exposure, available_after, excess, fingerprint
  )
  values (
    v_billing_id,
    (v_snap->>'open_receivables')::numeric, (v_snap->>'overdue_amount')::numeric, (v_snap->>'overdue_count')::int, (v_snap->>'commitments')::numeric,
    (v_snap->>'credit_limit')::numeric, (v_snap->>'current_exposure')::numeric, (v_snap->>'financed_part')::numeric,
    (v_snap->>'projected_exposure')::numeric, (v_snap->>'available_after')::numeric, (v_snap->>'excess')::numeric, v_snap->>'fingerprint'
  );

  for v_pm in select * from jsonb_array_elements(p_payment_methods)
  loop
    insert into public.payment_methods (billing_id, type, amount, condition, generates_credit, fees, auto_messages)
    values (
      v_billing_id,
      v_pm->>'type',
      (v_pm->>'amount')::numeric,
      v_pm->>'condition',
      coalesce((v_pm->>'generates_credit')::boolean, false),
      coalesce(v_pm->'fees', '{}'::jsonb),
      coalesce((v_pm->>'auto_messages')::boolean, true)
    )
    returning id into v_pm_id;

    for v_inst in select * from jsonb_array_elements(coalesce(v_pm->'installments', '[]'::jsonb))
    loop
      insert into public.installments (payment_method_id, number, days, due_date, amount)
      values (
        v_pm_id,
        (v_inst->>'number')::int,
        coalesce((v_inst->>'days')::int, 0),
        (v_inst->>'due_date')::date,
        (v_inst->>'amount')::numeric
      )
      returning id into v_inst_id;

      insert into public.receivables (customer_id, billing_id, installment_id, amount, due_date, status)
      values (v_customer_id, v_billing_id, v_inst_id, (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date, 'ABERTO')
      returning id into v_receivable_id;
      v_first_receivable_id := coalesce(v_first_receivable_id, v_receivable_id);

      if v_pm->>'type' in ('BOLETO', 'PIX') and coalesce((v_pm->>'asaas')::boolean, false) then
        insert into public.charges (installment_id, provider, idempotency_key, status, company_id)
        values (v_inst_id, 'ASAAS', p_idempotency_key || ':' || v_inst_id::text, 'PENDENTE', v_company_id);
      end if;
    end loop;
  end loop;

  insert into public.fiscal_documents (billing_id, status, company_id)
  values (v_billing_id, case when p_fiscal_choice in ('EMITIR_NFE', 'EMITIR_NFE_PRODUTO') then 'PROCESSANDO' else 'NAO_EMITIDO' end, v_company_id);

  update public.billings set confirmed_by = auth.uid(), confirmed_at = now() where id = v_billing_id;

  perform private.convert_credit_commitment(p_order_id, v_first_receivable_id);

  update public.orders set status = 'COMPLETED' where id = p_order_id;

  return v_billing_id;
end;
$function$;

-- 8) Permissões de execução ---------------------------------------------------------------

revoke all on function public.oris360_credit_overview(uuid, uuid, numeric) from public, anon;
revoke all on function public.oris360_set_credit_limit(uuid, numeric, text) from public, anon;
revoke all on function public.oris360_credit_request_release(uuid, text) from public, anon;
revoke all on function public.oris360_credit_authorize(uuid, text[], text, int) from public, anon;
grant execute on function public.oris360_credit_overview(uuid, uuid, numeric) to authenticated;
grant execute on function public.oris360_set_credit_limit(uuid, numeric, text) to authenticated;
grant execute on function public.oris360_credit_request_release(uuid, text) to authenticated;
grant execute on function public.oris360_credit_authorize(uuid, text[], text, int) to authenticated;

grant execute on function private.compute_credit_snapshot(uuid, numeric, uuid) to authenticated;
grant execute on function private.compute_credit_snapshot(uuid, numeric) to authenticated;
grant execute on function private.credit_blockers(jsonb) to authenticated;
grant execute on function private.credit_uncovered(uuid, text[]) to authenticated;
grant execute on function private.convert_credit_commitment(uuid, uuid) to authenticated;
