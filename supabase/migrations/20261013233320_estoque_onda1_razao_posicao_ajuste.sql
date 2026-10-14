-- Estoque · Onda 1: razão unificado (leitura), posição, ajuste de inventário aprovado.
-- Não altera nenhum escritor de saldo existente (compra, pedido, produção): o razão é uma projeção
-- de leitura sobre as origens oficiais, então não há como duplicar efeito.

create table public.raw_material_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid not null default private.default_unit_id(),
  raw_material_id uuid not null references public.raw_materials(id),
  variation numeric not null,
  origin text not null check (origin in ('adjustment')),
  reference_id uuid,
  previous_balance numeric not null,
  new_balance numeric not null check (new_balance >= 0),
  observation text not null default '',
  responsible_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index raw_material_movements_item_idx on public.raw_material_movements (raw_material_id, created_at desc);
create index raw_material_movements_company_idx on public.raw_material_movements (company_id);
-- um movimento de ajuste por contagem: impede aplicar o mesmo ajuste duas vezes
create unique index raw_material_movements_adjustment_ref_uidx
  on public.raw_material_movements (reference_id) where origin = 'adjustment' and reference_id is not null;

alter table public.raw_material_movements enable row level security;
create policy raw_material_movements_select on public.raw_material_movements
  for select using ((select private.is_active_company_member(company_id)));

alter table public.inventory_counts
  add column adjustment_status text not null default 'NONE' check (adjustment_status in ('NONE', 'APPROVED', 'DISMISSED')),
  add column resolved_by uuid,
  add column resolved_at timestamptz,
  add column resolution_justification text;

create view public.stock_ledger with (security_invoker = true) as
  select
    'sm:' || m.id::text as ledger_id, m.company_id, m.unit_id,
    'PRODUCT'::text as item_type, m.product_id as item_id,
    case
      when m.origin = 'entry' then 'ENTRY'
      when m.origin = 'order' then 'SALE_OUT'
      when m.origin = 'order_cancel_reversal' then 'REVERSAL'
      when m.origin = 'production' then 'PRODUCTION_IN'
      when m.observation like 'Estorno de produção%' then 'REVERSAL'
      when m.observation like 'Ajuste de inventário%' then 'INVENTORY_ADJUSTMENT'
      else 'MANUAL_ADJUSTMENT'
    end as movement_type,
    m.variation as quantity, m.previous_balance, m.new_balance,
    m.origin as source_kind, m.reference_id as source_id, m.observation as note,
    m.responsible_id as actor_id, m.created_at as occurred_at, null::numeric as unit_cost
  from public.stock_movements m
  union all
  select
    'rme:' || e.id::text, e.company_id, e.unit_id, 'RAW_MATERIAL', e.raw_material_id,
    'PURCHASE_ENTRY', e.control_quantity, e.previous_balance, e.new_balance,
    'purchase', e.id, case when coalesce(e.invoice_number, '') <> '' then 'NF ' || e.invoice_number else 'Entrada de compra' end,
    e.responsible_id, e.created_at,
    case when coalesce(e.control_quantity, 0) > 0 then e.total_value / e.control_quantity end
  from public.raw_material_entries e
  where e.status in ('confirmed', 'reversed')
  union all
  select
    'rmv:' || e.id::text, e.company_id, e.unit_id, 'RAW_MATERIAL', e.raw_material_id,
    'REVERSAL', -e.control_quantity, null, null,
    'purchase_reversal', e.id, 'Estorno de entrada — ' || coalesce(e.reversal_reason, ''),
    e.reversed_by, e.reversed_at, null
  from public.raw_material_entries e
  where e.status = 'reversed' and e.reversed_at is not null
  union all
  select
    'pc:' || c.id::text, c.company_id, r.unit_id, 'RAW_MATERIAL', c.raw_material_id,
    'PRODUCTION_CONSUMPTION', -c.consumed_quantity, c.previous_balance, c.new_balance,
    'production', c.production_record_id, 'Consumo de produção',
    r.responsible_id, c.created_at, null
  from public.production_consumptions c
  join public.production_records r on r.id = c.production_record_id
  union all
  select
    'pcr:' || c.id::text, c.company_id, r.unit_id, 'RAW_MATERIAL', c.raw_material_id,
    'REVERSAL', c.consumed_quantity, null, null,
    'production_reversal', c.production_record_id, 'Estorno de produção',
    r.responsible_id, r.updated_at, null
  from public.production_consumptions c
  join public.production_records r on r.id = c.production_record_id
  where r.status = 'reversed'
  union all
  select
    'rma:' || a.id::text, a.company_id, a.unit_id, 'RAW_MATERIAL', a.raw_material_id,
    'INVENTORY_ADJUSTMENT', a.variation, a.previous_balance, a.new_balance,
    a.origin, a.reference_id, a.observation, a.responsible_id, a.created_at, null
  from public.raw_material_movements a;

grant select on public.stock_ledger to authenticated;

-- Posição por item: físico, reservado (pedidos confirmados ainda não separados), disponível.
create or replace function public.stock_position()
returns table (
  item_type text, item_id uuid, sku text, name text, category text, base_unit text, is_active boolean,
  physical numeric, reserved numeric, available numeric, min_stock numeric, max_stock numeric,
  avg_cost numeric, stock_value numeric, situation text
)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.is_active_company_member(v_company)) then
    return;
  end if;

  return query
  with reserved as (
    select oi.product_id, sum(oi.total_units)::numeric as qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.company_id = v_company and o.status = 'CONFIRMED' and o.separation_finished_at is null and oi.product_id is not null
    group by oi.product_id
  ), base as (
    select 'PRODUCT'::text as t, p.id as i, coalesce(p.code, p.gtin) as s, p.name as n,
           coalesce((select pc.name from public.categories pc where pc.id = p.category_id), '') as cat,
           'unidade'::text as u, p.is_active as act,
           p.current_stock::numeric as phys, coalesce(r.qty, 0) as res,
           p.min_stock::numeric as mn, p.max_stock::numeric as mx, null::numeric as cost
    from public.products p left join reserved r on r.product_id = p.id
    where p.company_id = v_company
    union all
    select 'RAW_MATERIAL', m.id, m.code, m.name, m.category, m.control_unit, m.is_active,
           m.current_stock::numeric, 0::numeric, m.min_stock::numeric, m.max_stock::numeric, m.avg_cost::numeric
    from public.raw_materials m
    where m.company_id = v_company
  )
  select b.t, b.i, b.s, b.n, b.cat, b.u, b.act, b.phys, b.res, b.phys - b.res, b.mn, b.mx, b.cost,
         case when b.cost is null then null else round(b.phys * b.cost, 2) end,
         case
           when b.phys <= 0 then 'OUT'
           when b.mn > 0 and b.phys <= b.mn then 'LOW'
           when b.mx > 0 and b.phys > b.mx then 'OVER'
           else 'OK'
         end
  from base b
  where b.act or b.phys > 0
  order by b.t, b.n;
end;
$$;

-- Resolução de divergência: o Estoque decide. Aprovar aplica a DIFERENÇA da fotografia ao saldo ATUAL.
create or replace function public.inventory_resolve_divergence(p_count_id uuid, p_action text, p_justification text)
returns table (applied numeric, previous_balance numeric, new_balance numeric)
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.inventory_counts;
  i public.inventory_session_items;
  s public.inventory_sessions;
  v_prev numeric;
  v_new numeric;
begin
  if p_action not in ('APPROVE', 'DISMISS') then raise exception 'Ação inválida'; end if;
  if coalesce(trim(p_justification), '') = '' then raise exception 'Justificativa é obrigatória'; end if;

  select * into c from public.inventory_counts where id = p_count_id for update;
  if not found then raise exception 'Contagem não encontrada'; end if;
  select * into s from public.inventory_sessions where id = c.session_id;
  if not (select private.inventory_can_manage(s.company_id)) then raise exception 'Sem permissão para tratar divergência'; end if;
  if c.adjustment_status <> 'NONE' then raise exception 'Esta divergência já foi tratada'; end if;
  if c.difference = 0 then raise exception 'Contagem sem divergência'; end if;

  select * into i from public.inventory_session_items where id = c.session_item_id for update;
  if exists (select 1 from public.inventory_counts n where n.session_item_id = c.session_item_id and n.round > c.round) then
    raise exception 'Existe uma recontagem mais recente para este item';
  end if;
  if i.recount_requested then raise exception 'Há uma recontagem solicitada para este item'; end if;

  if p_action = 'DISMISS' then
    update public.inventory_counts
      set adjustment_status = 'DISMISSED', resolved_by = auth.uid(), resolved_at = now(), resolution_justification = p_justification
      where id = c.id;
    perform private.record_audit_event('inventory.divergence_dismissed', s.company_id, 'inventory_count', c.id::text,
      jsonb_build_object('difference', c.difference, 'justification', p_justification));
    return query select 0::numeric, null::numeric, null::numeric;
    return;
  end if;

  if i.item_type = 'PRODUCT' then
    select p.current_stock into v_prev from public.products p where p.id = i.item_id for update;
    v_new := v_prev + c.difference;
    if v_new < 0 then raise exception 'O ajuste deixaria o saldo negativo (saldo atual %, diferença %)', v_prev, c.difference; end if;
    update public.products set current_stock = v_new where id = i.item_id;
    insert into public.stock_movements (product_id, variation, origin, reference_id, previous_balance, new_balance, observation, company_id, unit_id)
    values (i.item_id, c.difference, 'adjustment', c.id, v_prev, v_new, 'Ajuste de inventário — ' || p_justification, s.company_id, s.unit_id);
  else
    select m.current_stock into v_prev from public.raw_materials m where m.id = i.item_id for update;
    v_new := v_prev + c.difference;
    if v_new < 0 then raise exception 'O ajuste deixaria o saldo negativo (saldo atual %, diferença %)', v_prev, c.difference; end if;
    update public.raw_materials set current_stock = v_new where id = i.item_id;
    insert into public.raw_material_movements (company_id, unit_id, raw_material_id, variation, origin, reference_id, previous_balance, new_balance, observation)
    values (s.company_id, s.unit_id, i.item_id, c.difference, 'adjustment', c.id, v_prev, v_new, 'Ajuste de inventário — ' || p_justification);
  end if;

  update public.inventory_counts
    set adjustment_status = 'APPROVED', resolved_by = auth.uid(), resolved_at = now(), resolution_justification = p_justification
    where id = c.id;
  perform private.record_audit_event('inventory.adjustment_approved', s.company_id, 'inventory_count', c.id::text,
    jsonb_build_object('difference', c.difference, 'previous_balance', v_prev, 'new_balance', v_new, 'justification', p_justification));

  return query select c.difference, v_prev, v_new;
end;
$$;

drop function public.inventory_session_results(uuid);
create function public.inventory_session_results(p_session_id uuid)
returns table (
  count_id uuid, session_item_id uuid, item_type text, name text, sku text, round_no smallint, is_latest boolean,
  base_quantity numeric, expected_balance numeric, difference numeric, counted_by_name text, counted_at timestamptz,
  adjustment_status text, resolution_justification text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.inventory_sessions where id = p_session_id;
  if v_company is null or not (select private.inventory_can_manage(v_company)) then
    raise exception 'Sem permissão para consultar resultados';
  end if;
  return query
  select c.id, c.session_item_id, i.item_type, info.name, info.sku, c.round,
         c.round = (select max(x.round) from public.inventory_counts x where x.session_item_id = c.session_item_id),
         c.base_quantity, c.expected_balance, c.difference, c.counted_by_name, c.counted_at,
         c.adjustment_status, c.resolution_justification
  from public.inventory_counts c
  join public.inventory_session_items i on i.id = c.session_item_id
  cross join lateral private.inventory_item_info(i.item_type, i.item_id) info
  where c.session_id = p_session_id
  order by (c.difference = 0), info.name, c.round;
end;
$$;

revoke all on function public.stock_position() from public, anon;
revoke all on function public.inventory_resolve_divergence(uuid, text, text) from public, anon;
revoke all on function public.inventory_session_results(uuid) from public, anon;
grant execute on function public.stock_position() to authenticated;
grant execute on function public.inventory_resolve_divergence(uuid, text, text) to authenticated;
grant execute on function public.inventory_session_results(uuid) to authenticated;
