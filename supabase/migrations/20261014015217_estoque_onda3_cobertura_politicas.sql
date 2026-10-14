-- Estoque · Onda 3: política de cobertura (com histórico), cobertura por consumo real e necessidade líquida de reposição.
-- Sugestão de reposição é informativa: não cria compra, produção, despesa nem conta a pagar.

insert into public.permissions (key, name, description, sensitivity)
values ('estoque.politicas.gerenciar', 'Gerenciar políticas de estoque', 'Alterar dias de cobertura mínimo, ideal e máximo', 'SENSITIVE')
on conflict (key) do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, 'estoque.politicas.gerenciar'
from public.roles r
where r.key = 'OWNER'
on conflict do nothing;

-- Histórico de políticas: cada mudança é uma linha nova (autor, data, justificativa); a vigente é a mais recente.
create table public.stock_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid not null references public.units(id),
  scope text not null default 'ALL' check (scope in ('ALL', 'PRODUCT', 'RAW_MATERIAL')),
  min_days numeric not null,
  ideal_days numeric not null,
  max_days numeric not null,
  justification text not null check (length(trim(justification)) > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (min_days > 0 and min_days < ideal_days and ideal_days < max_days)
);
create index stock_policies_lookup_idx on public.stock_policies (company_id, unit_id, scope, created_at desc);
alter table public.stock_policies enable row level security;
create policy stock_policies_select on public.stock_policies
  for select using ((select private.is_active_company_member(company_id)));

create or replace function public.set_stock_policy(p_unit_id uuid, p_scope text, p_min numeric, p_ideal numeric, p_max numeric, p_justification text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_id uuid;
begin
  select company_id into v_company from public.units where id = p_unit_id;
  if v_company is null then raise exception 'Unidade não encontrada'; end if;
  if not (select private.has_permission(v_company, 'estoque.politicas.gerenciar')) then
    raise exception 'Sem permissão para alterar a política de estoque';
  end if;
  if not (select private.can_access_unit(v_company, p_unit_id)) then raise exception 'Sem acesso a esta unidade'; end if;
  if p_scope not in ('ALL', 'PRODUCT', 'RAW_MATERIAL') then raise exception 'Escopo inválido'; end if;
  if not (p_min > 0 and p_min < p_ideal and p_ideal < p_max) then
    raise exception 'Informe 0 < mínimo < ideal < máximo (em dias)';
  end if;
  if coalesce(trim(p_justification), '') = '' then raise exception 'Informe a justificativa da alteração'; end if;

  insert into public.stock_policies (company_id, unit_id, scope, min_days, ideal_days, max_days, justification)
  values (v_company, p_unit_id, p_scope, p_min, p_ideal, p_max, p_justification)
  returning id into v_id;
  perform private.record_audit_event('stock.policy_changed', v_company, 'stock_policy', v_id::text,
    jsonb_build_object('scope', p_scope, 'min', p_min, 'ideal', p_ideal, 'max', p_max, 'justification', p_justification));
  return v_id;
end;
$$;

-- Política vigente por escopo (a mais específica vence; sem registro vale o padrão 30/45/60).
create or replace function private.effective_policy(p_company uuid, p_unit uuid, p_item_type text)
returns table (min_days numeric, ideal_days numeric, max_days numeric)
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(s.min_days, a.min_days, 30), coalesce(s.ideal_days, a.ideal_days, 45), coalesce(s.max_days, a.max_days, 60)
  from (select 1) d
  left join lateral (
    select p.min_days, p.ideal_days, p.max_days from public.stock_policies p
    where p.company_id = p_company and p.unit_id = p_unit and p.scope = p_item_type order by p.created_at desc limit 1
  ) s on true
  left join lateral (
    select p.min_days, p.ideal_days, p.max_days from public.stock_policies p
    where p.company_id = p_company and p.unit_id = p_unit and p.scope = 'ALL' order by p.created_at desc limit 1
  ) a on true
$$;

-- Posição completa: físico, reservado, a receber, em produção, consumo médio, cobertura e necessidade líquida.
drop function public.stock_position();
create function public.stock_position()
returns table (
  item_type text, item_id uuid, sku text, name text, category text, base_unit text, is_active boolean,
  physical numeric, reserved numeric, available numeric, incoming numeric, in_production numeric,
  min_stock numeric, max_stock numeric, daily_rate numeric, history_days integer, coverage_days numeric,
  net_need numeric, unit_cost numeric, stock_value numeric, excess_qty numeric, excess_value numeric,
  idle_days integer, health text, policy_min numeric, policy_ideal numeric, policy_max numeric
)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_unit uuid := (select private.default_unit_id());
  v_history integer;
  pp record;
  pr record;
begin
  if v_company is null or not (select private.is_active_company_member(v_company)) then return; end if;

  -- histórico disponível: dias desde o primeiro evento de demanda da empresa, limitado à janela de 90 dias
  select least(90, greatest(1, ceil(extract(epoch from (now() - min(t))) / 86400)::integer)) into v_history
  from (
    select min(m.created_at) t from public.stock_movements m where m.company_id = v_company and m.origin = 'order'
    union all
    select min(c.created_at) from public.production_consumptions c where c.company_id = v_company
  ) x;

  select * into pp from private.effective_policy(v_company, v_unit, 'PRODUCT');
  select * into pr from private.effective_policy(v_company, v_unit, 'RAW_MATERIAL');

  return query
  with reserved as (
    select oi.product_id, sum(oi.total_units)::numeric as qty
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where o.company_id = v_company and o.status = 'CONFIRMED' and o.separation_finished_at is null and oi.product_id is not null
    group by oi.product_id
  ), prod_out as (
    select m.product_id, -sum(m.variation)::numeric as qty, count(*) as n
    from public.stock_movements m
    where m.company_id = v_company and m.origin in ('order', 'order_cancel_reversal') and m.created_at > now() - interval '90 days'
    group by m.product_id
  ), prod_out_ever as (
    select distinct m.product_id from public.stock_movements m where m.company_id = v_company and m.origin = 'order'
  ), raw_out as (
    select c.raw_material_id, sum(c.consumed_quantity)::numeric as qty
    from public.production_consumptions c join public.production_records r on r.id = c.production_record_id
    where c.company_id = v_company and r.status <> 'reversed' and c.created_at > now() - interval '90 days'
    group by c.raw_material_id
  ), raw_out_ever as (
    select distinct c.raw_material_id from public.production_consumptions c where c.company_id = v_company
  ), incoming_raw as (
    select e.raw_material_id, sum(e.packages_quantity * m.purchase_unit_factor)::numeric as qty
    from public.raw_material_entries e join public.raw_materials m on m.id = e.raw_material_id
    where e.company_id = v_company and e.status = 'draft' group by e.raw_material_id
  ), incoming_prod as (
    select i.product_id, sum(i.quantity)::numeric as qty
    from public.expense_launch_items i join public.expense_launches l on l.id = i.launch_id
    where l.company_id = v_company and i.product_id is not null and i.received_at is null group by i.product_id
  ), released as (
    select r.product_id, sum(r.requested_units)::numeric as qty, min(r.created_at) as first_at
    from public.production_releases r where r.company_id = v_company group by r.product_id
  ), produced_after as (
    select rl.product_id, coalesce(sum(pr2.units_quantity), 0)::numeric as qty
    from released rl
    left join public.production_records pr2 on pr2.product_id = rl.product_id and pr2.company_id = v_company
      and pr2.status <> 'reversed' and pr2.created_at >= rl.first_at
    group by rl.product_id
  ), recipe_cost as (
    select rc.product_id, sum(rc.quantity_per_unit * m.avg_cost) as cost, bool_and(m.avg_cost > 0) as complete
    from public.product_recipe rc join public.raw_materials m on m.id = rc.raw_material_id
    where rc.company_id = v_company group by rc.product_id
  ), activity as (
    select l.item_id, max(l.occurred_at) as last_at from public.stock_ledger l where l.company_id = v_company group by l.item_id
  ), base as (
    select 'PRODUCT'::text as t, p.id as i, coalesce(p.code, p.gtin) as s, p.name as n,
           coalesce((select c.name from public.categories c where c.id = p.category_id), '') as cat,
           'unidade'::text as u, p.is_active as act,
           p.current_stock::numeric as phys, coalesce(rs.qty, 0) as res,
           coalesce(ip.qty, 0) as inc,
           greatest(0, coalesce(rl.qty, 0) - coalesce(pa.qty, 0)) as wip,
           p.min_stock::numeric as mn, p.max_stock::numeric as mx,
           coalesce(po.qty, 0) as out90, (poe.product_id is not null) as out_ever,
           case when p.nature = 'RESALE' then nullif(p.avg_cost, 0)
                when rcc.complete then rcc.cost end as cost,
           act.last_at as last_at, pp.min_days as pmin, pp.ideal_days as pideal, pp.max_days as pmax
    from public.products p
    left join reserved rs on rs.product_id = p.id
    left join incoming_prod ip on ip.product_id = p.id
    left join released rl on rl.product_id = p.id
    left join produced_after pa on pa.product_id = p.id
    left join prod_out po on po.product_id = p.id
    left join prod_out_ever poe on poe.product_id = p.id
    left join recipe_cost rcc on rcc.product_id = p.id
    left join activity act on act.item_id = p.id
    where p.company_id = v_company
    union all
    select 'RAW_MATERIAL', m.id, m.code, m.name, m.category, m.control_unit, m.is_active,
           m.current_stock::numeric, 0::numeric, coalesce(ir.qty, 0), 0::numeric,
           m.min_stock::numeric, m.max_stock::numeric,
           coalesce(ro.qty, 0), (roe.raw_material_id is not null),
           nullif(m.avg_cost, 0)::numeric, act.last_at, pr.min_days, pr.ideal_days, pr.max_days
    from public.raw_materials m
    left join incoming_raw ir on ir.raw_material_id = m.id
    left join raw_out ro on ro.raw_material_id = m.id
    left join raw_out_ever roe on roe.raw_material_id = m.id
    left join activity act on act.item_id = m.id
    where m.company_id = v_company
  ), calc as (
    select b.*, greatest(0, b.phys - b.res) as avail,
           case when coalesce(v_history, 0) > 0 and b.out90 > 0 then b.out90 / v_history end as rate
    from base b
  )
  select c.t, c.i, c.s, c.n, c.cat, c.u, c.act, c.phys, c.res, c.avail, c.inc, c.wip, c.mn, c.mx,
         c.rate, coalesce(v_history, 0),
         case when c.rate is not null then c.avail / c.rate end,
         case when c.rate is not null then greatest(0, ceil((c.pideal * c.rate - c.avail - c.inc - c.wip) * 100) / 100) end,
         c.cost,
         case when c.cost is null then null else round(c.phys * c.cost, 2) end,
         case when c.rate is not null then greatest(0, c.avail - c.pmax * c.rate) else 0 end,
         case when c.rate is not null and c.cost is not null then round(greatest(0, c.avail - c.pmax * c.rate) * c.cost, 2) else 0 end,
         case when c.last_at is null then null else floor(extract(epoch from (now() - c.last_at)) / 86400)::integer end,
         case
           when c.phys < 0 then 'DIVERGENCE'
           when c.phys = 0 then 'ZERO'
           when c.rate is null then case when c.out_ever then 'NO_RECENT_DEMAND' else 'NO_HISTORY' end
           when c.avail / c.rate < c.pmin / 2 then 'CRITICAL'
           when c.avail / c.rate < c.pmin then 'LOW'
           when c.avail / c.rate <= c.pideal then 'HEALTHY'
           when c.avail / c.rate <= c.pmax then 'ABOVE_IDEAL'
           else 'EXCESS'
         end,
         c.pmin, c.pideal, c.pmax
  from calc c
  where c.act or c.phys > 0
  order by c.t, c.n;
end;
$$;

revoke all on function public.set_stock_policy(uuid, text, numeric, numeric, numeric, text) from public, anon;
revoke all on function public.stock_position() from public, anon;
grant execute on function public.set_stock_policy(uuid, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.stock_position() to authenticated;
