-- Separa Confere V3 — dados mínimos do operador e tempo real sem campos restritos (PROPOSTA).
-- STATUS: VERSIONADO, NÃO APLICADO.
--
-- ORDEM OBRIGATÓRIA (aplicar fora dela quebra a separação do operador confinado):
--   1. migration de apps operacionais (regra única de acesso)   2. 20261014221500 (faltas)
--   3. ESTE ARQUIVO em duas fases:
--        fase A (seções 1 a 3: funções + sinais + gatilhos + publicação) — aditiva, segura antes do frontend novo;
--        fase B (seção 4: bloqueio da leitura direta) — SOMENTE depois do frontend que usa as funções estar publicado
--        e validado em homologação. O frontend detecta a ausência das funções e cai no modo direto, então A pode vir antes.
--
-- Depende de: private.operator_apps, private.is_restricted_operator (regra única), private.can_use_app e
-- private.separation_actor_name (arquivo 221500).

-- ---------------------------------------------------------------------------------------------
-- 1) Funções de leitura e escrita com projeção mínima (13 / 10 / 4 / 7 colunas)
-- ---------------------------------------------------------------------------------------------
create or replace function public.separation_snapshot(p_company_id uuid, p_scope text, p_order_id uuid default null)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_orders jsonb;
  v_ids uuid[];
begin
  if (select auth.uid()) is null then raise exception 'Não autenticado' using errcode = '28000'; end if;
  if p_company_id is null or not (select private.is_active_company_member(p_company_id)) then
    raise exception 'Empresa não encontrada' using errcode = '42501';
  end if;
  if not (select private.can_use_app(p_company_id, 'separa_confere')) then
    raise exception 'Sem acesso a este app' using errcode = '42501';
  end if;
  if p_scope not in ('queue', 'history', 'order') then raise exception 'Escopo inválido'; end if;
  if p_scope = 'order' and p_order_id is null then raise exception 'Informe o pedido'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb), coalesce(array_agg(x.id), '{}')
    into v_orders, v_ids
  from (
    select o.id, o.order_number, o.created_at, o.customer_name, o.company_name, o.total_units, o.status::text as status,
           o.separation_queued_at, o.separation_started_at, o.separation_finished_at, o.separation_responsible,
           o.separation_started_by, o.separation_completed_by
    from public.orders o
    where o.company_id = p_company_id
      and case p_scope
            when 'queue' then o.status = 'CONFIRMED' and o.separation_finished_at is null
            when 'history' then o.status in ('COMPLETED', 'CANCELLED')
            else o.id = p_order_id
          end
    order by o.created_at desc
    limit case p_scope when 'history' then 100 else 500 end
  ) x;

  return jsonb_build_object(
    'orders', v_orders,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'order_id', i.order_id, 'product_id', i.product_id, 'product_name', i.product_name,
        'presentation', i.presentation, 'weight_volume', i.weight_volume, 'total_units', i.total_units,
        'packs_quantity', i.packs_quantity, 'pack_quantity', i.pack_quantity, 'separated_at', i.separated_at)), '[]'::jsonb)
      from public.order_items i where i.order_id = any (v_ids)),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'image_url', p.image_url, 'code', p.code, 'gtin', p.gtin)), '[]'::jsonb)
      from public.products p
      where p.company_id = p_company_id
        and p.id in (select i.product_id from public.order_items i where i.order_id = any (v_ids) and i.product_id is not null)),
    'adjustments', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'order_id', a.order_id, 'order_item_id', a.order_item_id, 'message', a.message,
        'status', a.status, 'created_by', a.created_by, 'created_at', a.created_at)), '[]'::jsonb)
      from public.order_adjustment_requests a where a.order_id = any (v_ids))
  );
end;
$$;

-- Empresa e permissão sempre vêm da linha afetada, nunca de parâmetro livre.
create or replace function public.separation_accept_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  o public.orders;
  v_name text := private.separation_actor_name();
  n int;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or not (select private.is_active_company_member(o.company_id))
     or not (select private.can_use_app(o.company_id, 'separa_confere')) then
    return false;
  end if;
  update public.orders
     set separation_responsible = v_name,
         separation_started_at = coalesce(separation_started_at, now()),
         separation_started_by = coalesce(separation_started_by, v_name)
   where id = o.id and status = 'CONFIRMED' and separation_finished_at is null and separation_responsible is null;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.separation_release_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  o public.orders;
  n int;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or not (select private.is_active_company_member(o.company_id))
     or not (select private.can_use_app(o.company_id, 'separa_confere')) then
    return false;
  end if;
  update public.orders set separation_responsible = null
   where id = o.id and separation_finished_at is null
     and (separation_responsible = private.separation_actor_name() or not (select private.is_restricted_operator(o.company_id)));
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Marca/desfaz item. Ao marcar o último item sem ajuste pendente, a separação termina (mesma regra de hoje).
create or replace function public.separation_set_item(p_item_id uuid, p_separated boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  i public.order_items;
  v_name text := private.separation_actor_name();
  n int;
begin
  select * into i from public.order_items where id = p_item_id for update;
  if not found or not (select private.is_active_company_member(i.company_id))
     or not (select private.can_use_app(i.company_id, 'separa_confere')) then
    return false;
  end if;
  if p_separated then
    update public.order_items set separated_at = now() where id = i.id and separated_at is null;
    get diagnostics n = row_count;
    if n = 0 then return false; end if;
    if not exists (select 1 from public.order_items r where r.order_id = i.order_id and r.separated_at is null)
       and not exists (select 1 from public.order_adjustment_requests a where a.order_id = i.order_id and a.status = 'pending') then
      update public.orders set separation_finished_at = now(), separation_completed_by = v_name
       where id = i.order_id and separation_finished_at is null;
    end if;
  else
    update public.order_items set separated_at = null where id = i.id;
  end if;
  return true;
end;
$$;

create or replace function public.separation_request_adjustment(p_order_id uuid, p_item_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  o public.orders;
  v_id uuid;
begin
  if coalesce(trim(p_message), '') = '' then raise exception 'Descreva o ajuste'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found or not (select private.is_active_company_member(o.company_id))
     or not (select private.can_use_app(o.company_id, 'separa_confere')) then
    raise exception 'Pedido não encontrado';
  end if;
  insert into public.order_adjustment_requests (order_id, order_item_id, message, created_by)
  values (o.id, p_item_id, trim(p_message), private.separation_actor_name())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.separation_resolve_adjustment(p_adjustment_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  a public.order_adjustment_requests;
  n int;
begin
  select * into a from public.order_adjustment_requests where id = p_adjustment_id;
  if not found or not (select private.is_active_company_member(a.company_id))
     or not (select private.can_use_app(a.company_id, 'separa_confere')) then
    return false;
  end if;
  update public.order_adjustment_requests
     set status = 'resolved', resolved_by = private.separation_actor_name(), resolved_at = now()
   where id = a.id and status = 'pending';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.separation_snapshot(uuid, text, uuid)', 'public.separation_accept_order(uuid)', 'public.separation_release_order(uuid)',
    'public.separation_set_item(uuid, boolean)', 'public.separation_request_adjustment(uuid, uuid, text)',
    'public.separation_resolve_adjustment(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2) Tempo real sem campos restritos: tabela de sinais (somente identificadores e estado)
--    O cliente assina esta tabela (o Realtime respeita o RLS dela) e, ao receber, relê pela função acima.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.separation_signals (
  order_id uuid primary key references public.orders (id) on delete cascade,
  company_id uuid not null,
  status text not null,
  responsible text,
  separation_finished boolean not null default false,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists separation_signals_company_idx on public.separation_signals (company_id, updated_at desc);

alter table public.separation_signals enable row level security;

drop policy if exists separation_signals_select on public.separation_signals;
create policy separation_signals_select on public.separation_signals
  for select to authenticated
  using ((select private.is_active_company_member(company_id)) and (select private.can_use_app(company_id, 'separa_confere')));
-- Sem políticas de escrita: só os gatilhos (SECURITY DEFINER) gravam.

grant select on public.separation_signals to authenticated;
revoke insert, update, delete on public.separation_signals from authenticated, anon;

create or replace function private.touch_separation_signal()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order uuid := case when tg_table_name = 'orders' then (to_jsonb(new) ->> 'id')::uuid else (to_jsonb(new) ->> 'order_id')::uuid end;
begin
  insert into public.separation_signals (order_id, company_id, status, responsible, separation_finished, version, updated_at)
  select o.id, o.company_id, o.status::text, o.separation_responsible, o.separation_finished_at is not null, 1, now()
  from public.orders o
  where o.id = v_order
  on conflict (order_id) do update
    set status = excluded.status, responsible = excluded.responsible,
        separation_finished = excluded.separation_finished,
        version = public.separation_signals.version + 1, updated_at = now();
  return null;
end;
$$;

revoke all on function private.touch_separation_signal() from public, anon, authenticated;

drop trigger if exists separation_signal_orders on public.orders;
create trigger separation_signal_orders
  after insert or update of status, separation_responsible, separation_queued_at, separation_started_at, separation_finished_at
  on public.orders for each row execute function private.touch_separation_signal();

drop trigger if exists separation_signal_items on public.order_items;
create trigger separation_signal_items
  after update of separated_at on public.order_items for each row execute function private.touch_separation_signal();

drop trigger if exists separation_signal_adjustments on public.order_adjustment_requests;
create trigger separation_signal_adjustments
  after insert or update of status on public.order_adjustment_requests for each row execute function private.touch_separation_signal();

insert into public.separation_signals (order_id, company_id, status, responsible, separation_finished)
select o.id, o.company_id, o.status::text, o.separation_responsible, o.separation_finished_at is not null
from public.orders o
on conflict (order_id) do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'separation_signals') then
    alter publication supabase_realtime add table public.separation_signals;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3) Operador "só Separa Confere" = confinado e com exatamente este app
-- ---------------------------------------------------------------------------------------------
create or replace function private.is_separa_only_operator(p_company_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select (select private.is_restricted_operator(p_company_id))
     and private.operator_apps(p_company_id) = array['separa_confere']::text[]
$$;

revoke all on function private.is_separa_only_operator(uuid) from public, anon;
grant execute on function private.is_separa_only_operator(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4) FASE B — bloqueio da leitura/escrita direta. NÃO executar antes do frontend novo estar publicado.
--    (Mantido no mesmo arquivo para revisão; ao aplicar, rodar a fase B em migration separada.)
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'order_adjustment_requests', 'products'] loop
    execute format('drop policy if exists %I on public.%I', t || '_no_separa_direct', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (not (select private.is_separa_only_operator(company_id))) with check (not (select private.is_separa_only_operator(company_id)))',
      t || '_no_separa_direct', t);
  end loop;
end $$;
