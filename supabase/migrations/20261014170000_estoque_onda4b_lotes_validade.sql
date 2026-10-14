-- Estoque · Onda 4b: lotes e validade.
-- Rastreamento é opcional por item. Itens sem rastreamento aparecem como "sem rastreamento" (nunca validade regular).
-- Os lotes nascem das entradas reais (compra recebida com lote + validade); a distribuição do saldo atual entre lotes
-- assume FEFO (o que sobra pertence aos lotes de validade mais distante) até que a separação passe a apontar o lote.

alter table public.products add column tracks_lots boolean not null default false;
alter table public.raw_materials add column tracks_lots boolean not null default false;

create or replace function public.set_item_lot_tracking(p_item_type text, p_item_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.has_permission(v_company, 'estoque.politicas.gerenciar')) then
    raise exception 'Sem permissão para alterar o rastreamento de lote';
  end if;
  if p_item_type = 'PRODUCT' then
    update public.products set tracks_lots = p_enabled where id = p_item_id and company_id = v_company;
  elsif p_item_type = 'RAW_MATERIAL' then
    update public.raw_materials set tracks_lots = p_enabled where id = p_item_id and company_id = v_company;
  else
    raise exception 'Tipo de item inválido';
  end if;
  if not found then raise exception 'Item não encontrado'; end if;
  perform private.record_audit_event('stock.lot_tracking_changed', v_company, p_item_type, p_item_id::text, jsonb_build_object('enabled', p_enabled));
end;
$$;

-- Entrada de item rastreado exige lote e validade: a compra não pode ser concluída sem os dados.
create or replace function private.require_lot_data()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  l public.expense_launches;
  v_tracked boolean := false;
begin
  if new.kind <> 'stock' then return new; end if;
  if new.raw_material_id is not null then
    select m.tracks_lots into v_tracked from public.raw_materials m where m.id = new.raw_material_id;
  elsif new.product_id is not null then
    select p.tracks_lots into v_tracked from public.products p where p.id = new.product_id;
  end if;
  if not coalesce(v_tracked, false) then return new; end if;
  select * into l from public.expense_launches where id = new.launch_id;
  if coalesce(trim(l.batch), '') = '' or l.expiry_date is null then
    raise exception 'LOTE_OBRIGATORIO: % exige lote e validade na entrada. Preencha Lote e Validade nos dados da nota.', new.name_snapshot;
  end if;
  return new;
end;
$$;

create trigger trg_require_lot_data
  before insert on public.expense_launch_items
  for each row execute function private.require_lot_data();

-- Lotes derivados das entradas recebidas, com a distribuição FEFO do saldo atual.
create or replace function public.stock_lots()
returns table (
  item_type text, item_id uuid, item_name text, sku text, base_unit text,
  lot_code text, received_on date, expires_on date, received_qty numeric, remaining_qty numeric,
  days_to_expiry integer, status text
)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.is_active_company_member(v_company)) then return; end if;

  return query
  with entries as (
    select 'RAW_MATERIAL'::text as t, m.id as i, m.name as n, m.code as s, m.control_unit as u, m.current_stock::numeric as stock,
           e.batch as lot, e.entry_date as rec, e.expiry_date as exp, e.control_quantity::numeric as qty
    from public.raw_material_entries e join public.raw_materials m on m.id = e.raw_material_id
    where m.company_id = v_company and m.tracks_lots and e.status = 'confirmed' and coalesce(trim(e.batch), '') <> ''
    union all
    select 'PRODUCT', p.id, p.name, coalesce(p.code, p.gtin), 'unidade', p.current_stock::numeric,
           l.batch, coalesce(l.document_issue_date, l.competence), l.expiry_date, (it.quantity - it.returned_quantity)::numeric
    from public.expense_launch_items it
    join public.expense_launches l on l.id = it.launch_id
    join public.products p on p.id = it.product_id
    where p.company_id = v_company and p.tracks_lots and it.received_at is not null and it.quantity - it.returned_quantity > 0 and coalesce(trim(l.batch), '') <> ''
  ), ranked as (
    select e.*,
           coalesce(sum(e.qty) over (partition by e.t, e.i order by e.exp desc nulls last, e.rec desc
                                      rows between unbounded preceding and 1 preceding), 0) as ahead
    from entries e
  ), lots as (
    select r.t, r.i, r.n, r.s, r.u, r.lot, r.rec, r.exp, r.qty,
           least(r.qty, greatest(0, r.stock - r.ahead)) as remaining
    from ranked r
  )
  select lt.t, lt.i, lt.n, lt.s, lt.u, lt.lot, lt.rec, lt.exp, lt.qty, lt.remaining,
         case when lt.exp is null then null else (lt.exp - current_date)::integer end,
         case
           when lt.exp is null then 'NO_EXPIRY'
           when lt.exp < current_date then 'EXPIRED'
           when lt.exp - current_date <= 30 then 'EXPIRING'
           else 'OK'
         end
  from lots lt
  where lt.remaining > 0
  order by lt.exp asc nulls last, lt.n;
end;
$$;

-- Catálogo de compra passa a informar se o item exige lote/validade.
drop function public.purchase_catalog(uuid);
create function public.purchase_catalog(p_supplier_id uuid default null)
returns table (
  item_type text, item_id uuid, sku text, name text, brand text, category_id text, category_name text, unit text,
  usage text, gtin text, supplier_code text, current_stock numeric, avg_cost numeric,
  last_purchase_cost numeric, last_purchase_date date, sale_price numeric, target_margin_pct numeric, image_url text, is_active boolean,
  tracks_lots boolean
)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.is_active_company_member(v_company)) then return; end if;
  return query
  select 'RAW_MATERIAL'::text, m.id, m.code, m.name, ''::text, m.category, m.category, m.control_unit,
         'MATERIAL'::text, m.gtin, sc.code, m.current_stock::numeric, m.avg_cost::numeric,
         m.last_purchase_cost, m.last_purchase_date, null::numeric, null::numeric, m.image_url, m.is_active, m.tracks_lots
  from public.raw_materials m
  left join public.item_supplier_codes sc on sc.company_id = v_company and sc.supplier_id = p_supplier_id and sc.item_type = 'RAW_MATERIAL' and sc.item_id = m.id
  where m.company_id = v_company and m.is_active
  union all
  select 'PRODUCT'::text, p.id, p.code, p.name, p.brand, p.category_id::text,
         coalesce((select c.name from public.categories c where c.id = p.category_id), ''), 'un'::text,
         case when p.nature = 'RESALE' then 'RESALE' else 'MANUFACTURED' end, p.gtin, sc.code, p.current_stock::numeric, p.avg_cost::numeric,
         p.last_purchase_cost, p.last_purchase_date, p.unit_price::numeric, p.target_margin_pct::numeric, p.image_url, p.is_active, p.tracks_lots
  from public.products p
  left join public.item_supplier_codes sc on sc.company_id = v_company and sc.supplier_id = p_supplier_id and sc.item_type = 'PRODUCT' and sc.item_id = p.id
  where p.company_id = v_company and p.is_active and p.nature = 'RESALE'
  order by 4;
end;
$$;

revoke all on function public.set_item_lot_tracking(text, uuid, boolean) from public, anon;
revoke all on function public.stock_lots() from public, anon;
revoke all on function public.purchase_catalog(uuid) from public, anon;
grant execute on function public.set_item_lot_tracking(text, uuid, boolean) to authenticated;
grant execute on function public.stock_lots() to authenticated;
grant execute on function public.purchase_catalog(uuid) to authenticated;
