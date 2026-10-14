-- Separa Confere V3: operador confinado no servidor, leitor por código, relatórios de inventário e faltas de separação.

-- 1) Permissão do operador restrito. Não é concedida ao Proprietário: quem a recebe fica confinado à área operacional.
insert into public.permissions (key, name, description, sensitivity)
values (
  'separa_confere.operar',
  'Operador do Separa Confere (acesso restrito)',
  'Confina o usuário à área operacional (Pedidos, Inventário, Histórico). Os módulos administrativos ficam bloqueados no servidor.',
  'SENSITIVE'
)
on conflict (key) do nothing;

create or replace function private.is_restricted_operator(p_company_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select (select private.has_permission(p_company_id, 'separa_confere.operar'))
$$;

revoke all on function private.is_restricted_operator(uuid) from public, anon;

-- 2) Bloqueio no servidor: políticas RESTRICTIVE somam-se às existentes e negam leitura/escrita direta ao operador restrito.
do $$
declare
  t text;
  restricted text[] := array[
    'customers', 'coupons', 'employees', 'employee_documents', 'salary_history', 'time_devices',
    'suppliers', 'item_supplier_codes', 'product_recipe', 'raw_materials', 'raw_material_categories',
    'raw_material_entries', 'raw_material_movements', 'production_consumptions', 'production_diaries',
    'production_participants', 'production_plans', 'production_records', 'production_releases',
    'production_route_stages', 'production_routes', 'floor_execution_events', 'floor_executions',
    'diary_evaluations', 'diary_occurrences', 'diary_other_activities', 'stock_period_closings',
    'stock_opening_balances', 'stock_policies', 'stock_returns', 'stock_loss_records', 'loading_jobs',
    'order_deliveries', 'order_delivery_items', 'delivery_er_reservations', 'urgent_demands',
    'roles', 'role_permissions', 'membership_roles', 'subscriptions', 'entitlements', 'onboarding_checklists'
  ];
begin
  foreach t in array restricted loop
    if exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t and c.column_name = 'company_id'
    ) then
      execute format('drop policy if exists %I on public.%I', t || '_no_restricted_operator', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (not (select private.is_restricted_operator(company_id))) with check (not (select private.is_restricted_operator(company_id)))',
        t || '_no_restricted_operator', t
      );
    end if;
  end loop;
end $$;

-- 3) Perfil de acesso lido pelo shell: o servidor decide, a interface só obedece.
create or replace function public.my_access_profile()
returns table (company_id uuid, restricted boolean, can_manage_inventory boolean)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null then return; end if;
  return query select v_company,
                      (select private.is_restricted_operator(v_company)),
                      (select private.inventory_can_manage(v_company));
end;
$$;

revoke all on function public.my_access_profile() from public, anon;
grant execute on function public.my_access_profile() to authenticated;

-- 4) Código de barras da sessão: o leitor só localiza item que pertence à sessão.
drop function if exists public.inventory_session_items(uuid);

create function public.inventory_session_items(p_session_id uuid)
returns table (
  id uuid, item_type text, item_id uuid, group_no smallint, name text, presentation text, kind_label text,
  sku text, image_url text, base_unit text, pack_label text, state text, barcode text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_unit uuid;
begin
  select s.company_id, s.unit_id into v_company, v_unit from public.inventory_sessions s where s.id = p_session_id;
  if v_company is null or not (select private.is_active_company_member(v_company))
     or not (select private.can_access_unit(v_company, v_unit)) then
    raise exception 'Sessão não encontrada';
  end if;

  return query
  select i.id, i.item_type, i.item_id, i.group_no, info.name, info.presentation, info.kind_label, info.sku,
         info.image_url, info.base_unit, info.pack_label,
         case
           when i.recount_requested then 'RECOUNT'
           when c1.id is null then 'PENDING'
           when c1.difference <> 0 then 'DIVERGENCE'
           else 'COUNTED'
         end,
         case when i.item_type = 'PRODUCT'
              then (select coalesce(p.gtin, '') from public.products p where p.id = i.item_id)
              else (select coalesce(r.gtin, '') from public.raw_materials r where r.id = i.item_id)
         end
  from public.inventory_session_items i
  cross join lateral private.inventory_item_info(i.item_type, i.item_id) info
  left join public.inventory_counts c1 on c1.session_item_id = i.id and c1.round = 1
  where i.session_id = p_session_id
  order by i.group_no, info.name;
end;
$$;

revoke all on function public.inventory_session_items(uuid) from public, anon;
grant execute on function public.inventory_session_items(uuid) to authenticated;

-- 5) Resumo e relatório administrativo de inventários (somente gestor).
create or replace function public.inventory_history_summary()
returns table (
  closed_sessions integer, open_sessions integer, scheduled_sessions integer, incomplete_sessions integer,
  last_closed_at timestamptz, open_divergences integer, counted_total integer, divergent_total integer
)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.inventory_can_manage(v_company)) then
    raise exception 'Sem permissão para consultar o histórico de inventários';
  end if;
  return query
  select
    (select count(*) from public.inventory_sessions s where s.company_id = v_company and s.status in ('CLOSED', 'CLOSED_INCOMPLETE'))::int,
    (select count(*) from public.inventory_sessions s where s.company_id = v_company and s.status = 'OPEN')::int,
    (select count(*) from public.inventory_sessions s where s.company_id = v_company and s.status = 'SCHEDULED')::int,
    (select count(*) from public.inventory_sessions s where s.company_id = v_company and s.status = 'CLOSED_INCOMPLETE')::int,
    (select max(s.closed_at) from public.inventory_sessions s where s.company_id = v_company and s.status in ('CLOSED', 'CLOSED_INCOMPLETE')),
    (select count(*) from public.inventory_counts c where c.company_id = v_company and c.difference <> 0 and c.adjustment_status = 'NONE'
        and not exists (select 1 from public.inventory_counts n where n.session_item_id = c.session_item_id and n.round > c.round))::int,
    (select count(*) from public.inventory_counts c where c.company_id = v_company and c.round = 1)::int,
    (select count(*) from public.inventory_counts c where c.company_id = v_company and c.round = 1 and c.difference <> 0)::int;
end;
$$;

create or replace function public.inventory_sessions_history()
returns table (
  id uuid, unit_name text, modality text, scope_kind text, location_label text, status text,
  starts_at timestamptz, closed_at timestamptz, opened_by_name text, total integer, counted integer,
  divergences integer, group1_total integer, group1_counted integer, group2_total integer, group2_counted integer
)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.inventory_can_manage(v_company)) then
    raise exception 'Sem permissão para consultar o histórico de inventários';
  end if;
  return query
  select s.id, u.name, s.modality, s.scope_kind, s.location_label, s.status, s.starts_at, s.closed_at,
         coalesce((select au.raw_user_meta_data ->> 'name' from auth.users au where au.id = s.opened_by),
                  (select au.email from auth.users au where au.id = s.opened_by), '')::text,
         count(i.id)::int,
         count(c1.id)::int,
         (count(c1.id) filter (where c1.difference <> 0))::int,
         (count(i.id) filter (where i.group_no = 1))::int,
         (count(c1.id) filter (where i.group_no = 1))::int,
         (count(i.id) filter (where i.group_no = 2))::int,
         (count(c1.id) filter (where i.group_no = 2))::int
  from public.inventory_sessions s
  join public.units u on u.id = s.unit_id
  left join public.inventory_session_items i on i.session_id = s.id
  left join public.inventory_counts c1 on c1.session_item_id = i.id and c1.round = 1
  where s.company_id = v_company
  group by s.id, u.name
  order by s.starts_at desc
  limit 100;
end;
$$;

create or replace function public.inventory_divergence_report(p_from date default null, p_to date default null)
returns table (
  session_id uuid, session_starts_at timestamptz, location_label text, group_no smallint, item_name text, sku text,
  round_no smallint, expected_balance numeric, base_quantity numeric, difference numeric,
  counted_by_name text, counted_at timestamptz, adjustment_status text, has_recount boolean
)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.inventory_can_manage(v_company)) then
    raise exception 'Sem permissão para consultar divergências';
  end if;
  return query
  select c.session_id, s.starts_at, s.location_label, i.group_no, info.name, info.sku, c.round,
         c.expected_balance, c.base_quantity, c.difference, c.counted_by_name, c.counted_at, c.adjustment_status,
         exists (select 1 from public.inventory_counts n where n.session_item_id = c.session_item_id and n.round > c.round)
  from public.inventory_counts c
  join public.inventory_sessions s on s.id = c.session_id
  join public.inventory_session_items i on i.id = c.session_item_id
  cross join lateral private.inventory_item_info(i.item_type, i.item_id) info
  where c.company_id = v_company
    and c.difference <> 0
    and (p_from is null or c.counted_at::date >= p_from)
    and (p_to is null or c.counted_at::date <= p_to)
  order by c.counted_at desc;
end;
$$;

revoke all on function public.inventory_history_summary() from public, anon;
revoke all on function public.inventory_sessions_history() from public, anon;
revoke all on function public.inventory_divergence_report(date, date) from public, anon;
grant execute on function public.inventory_history_summary() to authenticated;
grant execute on function public.inventory_sessions_history() to authenticated;
grant execute on function public.inventory_divergence_report(date, date) to authenticated;

-- 6) Faltas na separação de pedidos: ocorrência do pedido, nunca divergência de inventário nem ajuste de estoque.
create table public.separation_shortages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id() references public.companies(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  order_number text not null,
  customer_name text not null default '',
  product_id uuid,
  product_name text not null,
  requested_units integer not null check (requested_units > 0),
  separated_units integer not null check (separated_units >= 0),
  missing_units integer not null check (missing_units > 0),
  reason text not null default '',
  reported_by uuid not null default auth.uid(),
  reported_by_name text not null default '',
  created_at timestamptz not null default now(),
  check (separated_units + missing_units = requested_units)
);

create index separation_shortages_company_created_idx on public.separation_shortages (company_id, created_at desc);
create index separation_shortages_order_idx on public.separation_shortages (order_id);

alter table public.separation_shortages enable row level security;

create policy separation_shortages_select on public.separation_shortages
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));

create policy separation_shortages_no_restricted_operator on public.separation_shortages
  as restrictive for all to authenticated
  using (not (select private.is_restricted_operator(company_id)))
  with check (not (select private.is_restricted_operator(company_id)));

-- Escrita somente pela função abaixo (sem policy de insert/update/delete para o cliente).
create or replace function public.separation_report_shortage(
  p_order_item_id uuid,
  p_separated_units integer,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  i public.order_items;
  o public.orders;
  v_name text;
  v_id uuid;
begin
  select * into i from public.order_items where id = p_order_item_id;
  if not found then raise exception 'Item não encontrado'; end if;
  select * into o from public.orders where id = i.order_id;
  if not (select private.is_active_company_member(o.company_id)) then raise exception 'Item não encontrado'; end if;
  if o.status <> 'CONFIRMED' or o.separation_finished_at is not null then
    raise exception 'Este pedido não está em separação';
  end if;
  if p_separated_units is null or p_separated_units < 0 or p_separated_units >= i.total_units then
    raise exception 'A quantidade separada deve ser menor que a pedida (% unidades)', i.total_units;
  end if;

  v_name := coalesce((select au.raw_user_meta_data ->> 'name' from auth.users au where au.id = auth.uid()),
                     (select au.email from auth.users au where au.id = auth.uid()), 'Operador');

  insert into public.separation_shortages (
    company_id, order_id, order_item_id, order_number, customer_name, product_id, product_name,
    requested_units, separated_units, missing_units, reason, reported_by_name
  ) values (
    o.company_id, o.id, i.id, o.order_number, coalesce(nullif(o.company_name, ''), o.customer_name), i.product_id,
    trim(i.product_name || ' ' || i.presentation || ' ' || i.weight_volume), i.total_units, p_separated_units,
    i.total_units - p_separated_units, coalesce(trim(p_reason), ''), v_name
  ) returning id into v_id;

  perform private.record_audit_event('separation.shortage_reported', o.company_id, 'order_item', i.id::text,
    jsonb_build_object('order_number', o.order_number, 'requested', i.total_units, 'separated', p_separated_units));
  return v_id;
end;
$$;

revoke all on function public.separation_report_shortage(uuid, integer, text) from public, anon;
grant execute on function public.separation_report_shortage(uuid, integer, text) to authenticated;
