-- Separa Confere V3 — correções da validação (2026-10-14).
-- STATUS: VERSIONADO, NÃO APLICADO. Testado só em transação revertida em produção (nada gravado). Aplicar primeiro em homologação.
-- Ao aplicar, mover para supabase/migrations/ com a versão registrada em schema_migrations.
--
-- 1) Restrição híbrida: gestor/administrador que também recebe separa_confere.operar NÃO fica confinado.
--    Confinado = só permissões "operar" e nenhuma outra (e sem admin.acessar). Qualquer permissão fora dessa lista libera o painel.
-- 2) Faltas de separação com ciclo de vida: idempotente, correção e cancelamento com histórico imutável.
--
-- ATENÇÃO — sobreposição com supabase/pendentes/20261014180000_apps_operacionais_isolados.sql (outra frente):
-- ambas redefinem private.is_restricted_operator. A regra final precisa ser uma só; esta é a superconjunto
-- (operar + sem admin.acessar + sem permissão administrativa). Aplicar UMA definição, a última valendo.

-- ---------------------------------------------------------------------------------------------
-- 1) Restrição híbrida
-- ---------------------------------------------------------------------------------------------
create or replace function private.user_permission_keys(p_company_id uuid)
returns text[]
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(array_agg(distinct rp.permission_key), '{}'::text[])
  from public.memberships m
  join public.membership_roles mr on mr.company_id = m.company_id and mr.membership_id = m.id
  join public.roles r on r.company_id = mr.company_id and r.id = mr.role_id and r.status = 'ACTIVE'
  join public.role_permissions rp on rp.company_id = r.company_id and rp.role_id = r.id
  where m.company_id = p_company_id
    and m.user_id = (select auth.uid())
    and m.status = 'ACTIVE'
    and m.starts_at <= now()
    and (m.ends_at is null or m.ends_at > now())
$$;

create or replace function private.is_restricted_operator(p_company_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select k.keys && array['separa_confere.operar', 'producao.operar', 'entrega.operar']
     and not ('admin.acessar' = any (k.keys))
     and not exists (
       select 1 from unnest(k.keys) as x(key)
       where x.key <> all (array['separa_confere.operar', 'producao.operar', 'entrega.operar'])
     )
  from (select private.user_permission_keys(p_company_id) as keys) k
$$;

revoke all on function private.user_permission_keys(uuid) from public, anon;
revoke all on function private.is_restricted_operator(uuid) from public, anon;
grant execute on function private.user_permission_keys(uuid) to authenticated;
grant execute on function private.is_restricted_operator(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2) Faltas de separação: ciclo de vida
-- ---------------------------------------------------------------------------------------------
alter table public.separation_shortages
  add column if not exists status text not null default 'OPEN' check (status in ('OPEN', 'CANCELLED', 'CLOSED')),
  add column if not exists command_id uuid,
  add column if not exists adjustment_request_id uuid references public.order_adjustment_requests (id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancelled_by uuid,
  add column if not exists cancelled_by_name text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

-- Uma falta aberta por item do pedido; reenviar o mesmo comando devolve a mesma falta.
create unique index if not exists separation_shortages_one_open_per_item on public.separation_shortages (order_item_id) where status = 'OPEN';
create unique index if not exists separation_shortages_command_uidx on public.separation_shortages (company_id, command_id) where command_id is not null;

create table if not exists public.separation_shortage_events (
  id uuid primary key default gen_random_uuid(),
  shortage_id uuid not null references public.separation_shortages (id),
  company_id uuid not null,
  event text not null check (event in ('REPORTED', 'CORRECTED', 'CANCELLED', 'RESOLVED')),
  actor uuid not null default auth.uid(),
  actor_name text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists separation_shortage_events_shortage_idx on public.separation_shortage_events (shortage_id, created_at);

alter table public.separation_shortage_events enable row level security;

drop policy if exists separation_shortage_events_select on public.separation_shortage_events;
create policy separation_shortage_events_select on public.separation_shortage_events
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));

drop policy if exists separation_shortage_events_no_restricted_operator on public.separation_shortage_events;
create policy separation_shortage_events_no_restricted_operator on public.separation_shortage_events
  as restrictive for all to authenticated
  using (not (select private.is_restricted_operator(company_id)))
  with check (not (select private.is_restricted_operator(company_id)));

create or replace function private.block_shortage_event_changes()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'O histórico de faltas é imutável';
end;
$$;

drop trigger if exists separation_shortage_events_immutable on public.separation_shortage_events;
create trigger separation_shortage_events_immutable
  before update or delete on public.separation_shortage_events
  for each row execute function private.block_shortage_event_changes();

-- Situação para o relatório: aberta, resolvida (quando o ajuste ligado foi resolvido) ou cancelada.
create or replace view public.separation_shortage_report
with (security_invoker = true)
as
select s.id, s.company_id, s.order_id, s.order_number, s.customer_name, s.product_name,
       s.requested_units, s.separated_units, s.missing_units, s.reason, s.reported_by_name, s.created_at, s.updated_at,
       case
         when s.status = 'CANCELLED' then 'CANCELLED'
         when s.status = 'CLOSED' or a.status = 'resolved' then 'RESOLVED'
         else 'OPEN'
       end as situation,
       s.cancelled_at, s.cancelled_by_name, s.cancel_reason,
       a.resolved_at, a.resolved_by,
       (select count(*) from public.separation_shortage_events e where e.shortage_id = s.id)::int as event_count
from public.separation_shortages s
left join public.order_adjustment_requests a on a.id = s.adjustment_request_id;

grant select on public.separation_shortage_report to authenticated;

drop function if exists public.separation_report_shortage(uuid, integer, text);

create or replace function public.separation_report_shortage(
  p_order_item_id uuid,
  p_separated_units integer,
  p_reason text default '',
  p_command_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  i public.order_items;
  o public.orders;
  s public.separation_shortages;
  v_name text;
  v_reason text := coalesce(trim(p_reason), '');
  v_message text;
  v_adj uuid;
  v_id uuid;
begin
  select * into i from public.order_items where id = p_order_item_id for update;
  if not found then raise exception 'Item não encontrado'; end if;
  select * into o from public.orders where id = i.order_id;
  if not (select private.is_active_company_member(o.company_id)) then raise exception 'Item não encontrado'; end if;

  -- Reenvio do mesmo comando (duplo toque, timeout): devolve o resultado já gravado.
  if p_command_id is not null then
    select * into s from public.separation_shortages where company_id = o.company_id and command_id = p_command_id;
    if found then
      if s.order_item_id <> i.id or s.separated_units <> p_separated_units then
        raise exception 'COMMAND_CONFLITO: este comando já foi usado com outro conteúdo';
      end if;
      return s.id;
    end if;
  end if;

  if o.status <> 'CONFIRMED' or o.separation_finished_at is not null then
    raise exception 'Este pedido não está em separação';
  end if;
  if p_separated_units is null or p_separated_units < 0 or p_separated_units >= i.total_units then
    raise exception 'A quantidade separada deve ser menor que a pedida (% unidades)', i.total_units;
  end if;

  v_name := coalesce((select au.raw_user_meta_data ->> 'name' from auth.users au where au.id = auth.uid()),
                     (select au.email from auth.users au where au.id = auth.uid()), 'Operador');
  v_message := trim(format('Falta na separação: %s de %s unidades separadas. %s', p_separated_units, i.total_units, v_reason));

  select * into s from public.separation_shortages where order_item_id = i.id and status = 'OPEN' for update;

  if found and exists (select 1 from public.order_adjustment_requests a where a.id = s.adjustment_request_id and a.status = 'resolved') then
    -- O ajuste ligado já foi resolvido: a ocorrência anterior se encerra e uma nova falta começa.
    update public.separation_shortages set status = 'CLOSED', updated_at = now() where id = s.id;
    insert into public.separation_shortage_events (shortage_id, company_id, event, actor_name, data)
    values (s.id, s.company_id, 'RESOLVED', v_name, jsonb_build_object('reason', 'ajuste resolvido'));
    s := null;
  end if;

  if s.id is not null then
    -- Mesmo conteúdo: nada muda (idempotência por conteúdo).
    if s.separated_units = p_separated_units and s.reason = v_reason then return s.id; end if;
    -- Conteúdo diferente: correção; os valores anteriores ficam no histórico.
    update public.separation_shortages
       set separated_units = p_separated_units, missing_units = i.total_units - p_separated_units,
           reason = v_reason, updated_at = now()
     where id = s.id;
    update public.order_adjustment_requests set message = v_message
     where id = s.adjustment_request_id and status = 'pending';
    insert into public.separation_shortage_events (shortage_id, company_id, event, actor_name, data)
    values (s.id, s.company_id, 'CORRECTED', v_name,
            jsonb_build_object('before', jsonb_build_object('separated_units', s.separated_units, 'reason', s.reason),
                               'after', jsonb_build_object('separated_units', p_separated_units, 'reason', v_reason)));
    return s.id;
  end if;

  insert into public.order_adjustment_requests (order_id, order_item_id, message, created_by)
  values (o.id, i.id, v_message, v_name)
  returning id into v_adj;

  insert into public.separation_shortages (
    company_id, order_id, order_item_id, order_number, customer_name, product_id, product_name,
    requested_units, separated_units, missing_units, reason, reported_by_name, command_id, adjustment_request_id
  ) values (
    o.company_id, o.id, i.id, o.order_number, coalesce(nullif(o.company_name, ''), o.customer_name), i.product_id,
    trim(i.product_name || ' ' || i.presentation || ' ' || i.weight_volume), i.total_units, p_separated_units,
    i.total_units - p_separated_units, v_reason, v_name, p_command_id, v_adj
  ) returning id into v_id;

  insert into public.separation_shortage_events (shortage_id, company_id, event, actor_name, data)
  values (v_id, o.company_id, 'REPORTED', v_name,
          jsonb_build_object('requested_units', i.total_units, 'separated_units', p_separated_units, 'reason', v_reason));

  perform private.record_audit_event('separation.shortage_reported', o.company_id, 'order_item', i.id::text,
    jsonb_build_object('order_number', o.order_number, 'requested', i.total_units, 'separated', p_separated_units));
  return v_id;
end;
$$;

create or replace function public.separation_cancel_shortage(p_shortage_id uuid, p_reason text default '')
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  s public.separation_shortages;
  v_name text;
begin
  select * into s from public.separation_shortages where id = p_shortage_id for update;
  if not found or not (select private.is_active_company_member(s.company_id)) then raise exception 'Falta não encontrada'; end if;
  -- Quem registrou ou quem não é operador confinado (gestor/administrador).
  if s.reported_by <> auth.uid() and (select private.is_restricted_operator(s.company_id)) then
    raise exception 'Sem permissão para cancelar esta falta';
  end if;
  if s.status = 'CANCELLED' then return; end if;

  v_name := coalesce((select au.raw_user_meta_data ->> 'name' from auth.users au where au.id = auth.uid()),
                     (select au.email from auth.users au where au.id = auth.uid()), 'Operador');

  update public.separation_shortages
     set status = 'CANCELLED', cancelled_by = auth.uid(), cancelled_by_name = v_name, cancelled_at = now(),
         cancel_reason = coalesce(trim(p_reason), ''), updated_at = now()
   where id = s.id;
  update public.order_adjustment_requests
     set status = 'resolved', resolved_by = 'Cancelamento da falta', resolved_at = now()
   where id = s.adjustment_request_id and status = 'pending';
  insert into public.separation_shortage_events (shortage_id, company_id, event, actor_name, data)
  values (s.id, s.company_id, 'CANCELLED', v_name, jsonb_build_object('reason', coalesce(trim(p_reason), '')));
end;
$$;

revoke all on function public.separation_report_shortage(uuid, integer, text, uuid) from public, anon;
revoke all on function public.separation_cancel_shortage(uuid, text) from public, anon;
grant execute on function public.separation_report_shortage(uuid, integer, text, uuid) to authenticated;
grant execute on function public.separation_cancel_shortage(uuid, text) to authenticated;
