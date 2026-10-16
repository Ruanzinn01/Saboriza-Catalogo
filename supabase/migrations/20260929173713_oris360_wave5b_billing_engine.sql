-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929173713 · md5 normalizado a5b5937dfbd595b21b7e6512034a2586 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 5b — Motor de faturamento (Faturar V5): contexto de credito + confirmacao transacional.

create or replace function private.compute_credit_snapshot(p_customer_id uuid, p_financed_part numeric)
returns jsonb
language sql
stable
set search_path to ''
as $$
  with base as (
    select
      coalesce((select credit_limit from public.customer_credit where customer_id = p_customer_id), 0) as credit_limit,
      coalesce((select sum(amount) from public.receivables where customer_id = p_customer_id and status = 'ABERTO'), 0) as open_receivables,
      coalesce((select sum(amount) from public.receivables where customer_id = p_customer_id and status = 'ABERTO' and due_date < current_date), 0) as overdue_amount,
      coalesce((select count(*) from public.receivables where customer_id = p_customer_id and status = 'ABERTO' and due_date < current_date), 0) as overdue_count,
      coalesce((select sum(amount) from public.credit_commitments where customer_id = p_customer_id and status = 'ABERTO'), 0) as committed
  )
  select jsonb_build_object(
    'credit_limit', credit_limit,
    'open_receivables', open_receivables,
    'overdue_amount', overdue_amount,
    'overdue_count', overdue_count,
    'commitments', committed,
    'current_exposure', open_receivables + committed,
    'financed_part', p_financed_part,
    'projected_exposure', open_receivables + committed + p_financed_part,
    'available_after', credit_limit - (open_receivables + committed + p_financed_part),
    'excess', greatest(0, (open_receivables + committed + p_financed_part) - credit_limit),
    'fingerprint', md5(concat(credit_limit, '|', open_receivables, '|', committed, '|', p_financed_part, '|', now()::text))
  )
  from base
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
    'snapshot', private.compute_credit_snapshot(v_customer_id, 0)
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

  return private.compute_credit_snapshot(v_customer_id, p_financed_part);
end;
$$;

-- Confirmacao transacional: ordem canonica da secao 14 do patch (sem Asaas/NFe reais ainda).
create or replace function public.oris360_billing_confirm(
  p_order_id uuid,
  p_payment_methods jsonb,
  p_fiscal_choice text,
  p_idempotency_key text
)
returns uuid
language plpgsql
set search_path to ''
as $$
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
begin
  select company_id, customer_id, total_amount into v_company_id, v_customer_id, v_order_total
  from public.orders where id = p_order_id;

  if v_company_id is null or not private.has_permission(v_company_id, 'billing.invoice_order') then
    raise exception 'sem permissao para faturar este pedido';
  end if;

  -- idempotencia: retry com a mesma chave devolve o faturamento ja criado.
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

  insert into public.billings (order_id, customer_id, status, fiscal_choice, idempotency_key)
  values (p_order_id, v_customer_id, 'CONFIRMADO', p_fiscal_choice, p_idempotency_key)
  returning id into v_billing_id;

  insert into public.billing_credit_snapshots (
    billing_id, open_receivables, overdue_amount, overdue_count, commitments,
    credit_limit, current_exposure, financed_part, projected_exposure, available_after, excess, fingerprint
  )
  select
    v_billing_id,
    (s->>'open_receivables')::numeric, (s->>'overdue_amount')::numeric, (s->>'overdue_count')::int, (s->>'commitments')::numeric,
    (s->>'credit_limit')::numeric, (s->>'current_exposure')::numeric, (s->>'financed_part')::numeric,
    (s->>'projected_exposure')::numeric, (s->>'available_after')::numeric, (s->>'excess')::numeric, s->>'fingerprint'
  from (select private.compute_credit_snapshot(v_customer_id, v_financed_part) as s) x;

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

      if v_pm->>'type' in ('BOLETO', 'PIX') then
        insert into public.charges (installment_id, provider, idempotency_key, status)
        values (v_inst_id, 'ASAAS', p_idempotency_key || ':' || v_inst_id::text, 'PENDENTE');
      end if;
    end loop;
  end loop;

  insert into public.fiscal_documents (billing_id, status)
  values (v_billing_id, case when p_fiscal_choice = 'EMITIR_NFE' then 'PROCESSANDO' else 'NAO_EMITIDO' end);

  update public.billings set confirmed_by = auth.uid(), confirmed_at = now() where id = v_billing_id;

  return v_billing_id;
end;
$$;
;
