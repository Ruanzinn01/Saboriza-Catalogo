-- Estoque · Onda 4a: retornos (conferência física) e perdas/avarias.
-- Cancelar pedido ou entregar parcialmente NÃO devolve estoque: só a conferência física da quantidade apta.

insert into public.permissions (key, name, description, sensitivity)
values ('estoque.movimentar', 'Registrar perdas e conferir retornos', 'Registrar perda/avaria e conferir retorno físico de mercadoria', 'SENSITIVE')
on conflict (key) do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, 'estoque.movimentar'
from public.roles r
where r.key = 'OWNER'
on conflict do nothing;

alter table public.stock_movements drop constraint stock_movements_origin_check;
alter table public.stock_movements add constraint stock_movements_origin_check
  check (origin = any (array['production','entry','order','adjustment','order_cancel_reversal','purchase_entry','purchase_return','return','loss']));
alter table public.raw_material_movements drop constraint raw_material_movements_origin_check;
alter table public.raw_material_movements add constraint raw_material_movements_origin_check
  check (origin in ('adjustment', 'purchase_return', 'loss'));

-- Retornos esperados: nascem da origem (cancelamento após separação ou entrega parcial) e esperam conferência.
create table public.stock_returns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  unit_id uuid references public.units(id),
  source text not null check (source in ('CANCELLATION', 'PARTIAL_DELIVERY')),
  source_ref text not null default '',
  order_id uuid references public.orders(id),
  delivery_item_id uuid references public.order_delivery_items(id),
  product_id uuid not null references public.products(id),
  expected_units numeric not null check (expected_units > 0),
  status text not null default 'AWAITING' check (status in ('AWAITING', 'CONFIRMED')),
  good_units numeric check (good_units is null or good_units >= 0),
  bad_units numeric check (bad_units is null or bad_units >= 0),
  notes text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index stock_returns_delivery_item_uidx on public.stock_returns (delivery_item_id) where delivery_item_id is not null;
create unique index stock_returns_cancel_uidx on public.stock_returns (order_id, product_id) where source = 'CANCELLATION';
create index stock_returns_company_status_idx on public.stock_returns (company_id, status);
alter table public.stock_returns enable row level security;
create policy stock_returns_select on public.stock_returns
  for select using ((select private.is_active_company_member(company_id)));

create table public.stock_loss_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid references public.units(id),
  item_type text not null check (item_type in ('PRODUCT', 'RAW_MATERIAL')),
  item_id uuid not null,
  item_name text not null,
  quantity numeric not null check (quantity > 0),
  kind text not null check (kind in ('EXPIRY', 'BREAKAGE', 'CONTAMINATION', 'DAMAGE', 'OTHER')),
  occurred_on date not null,
  reason text not null check (length(trim(reason)) > 0),
  unit_cost numeric,
  total_cost numeric,
  source text not null default 'MANUAL' check (source in ('MANUAL', 'RETURN')),
  source_id uuid,
  registered_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index stock_loss_records_company_date_idx on public.stock_loss_records (company_id, occurred_on desc);
create unique index stock_loss_records_return_uidx on public.stock_loss_records (source_id) where source = 'RETURN';
alter table public.stock_loss_records enable row level security;
create policy stock_loss_records_select on public.stock_loss_records
  for select using ((select private.is_active_company_member(company_id)));

-- Custo de referência para valorizar perda: revenda = custo médio; fabricado = ficha técnica; insumo = custo médio.
create or replace function private.item_unit_cost(p_item_type text, p_item_id uuid)
returns numeric
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_cost numeric;
  v_nature text;
  v_complete boolean;
begin
  if p_item_type = 'RAW_MATERIAL' then
    select nullif(avg_cost, 0) into v_cost from public.raw_materials where id = p_item_id;
    return v_cost;
  end if;
  select nature, nullif(avg_cost, 0) into v_nature, v_cost from public.products where id = p_item_id;
  if v_nature = 'RESALE' then return v_cost; end if;
  select sum(rc.quantity_per_unit * m.avg_cost), bool_and(m.avg_cost > 0) into v_cost, v_complete
  from public.product_recipe rc join public.raw_materials m on m.id = rc.raw_material_id where rc.product_id = p_item_id;
  return case when v_complete then v_cost end;
end;
$$;

-- Perda/avaria: movimento próprio, com motivo e custo rastreável (custo desconhecido não vira zero).
create or replace function public.register_stock_loss(
  p_item_type text, p_item_id uuid, p_quantity numeric, p_kind text, p_occurred_on date, p_reason text
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_unit uuid := (select private.default_unit_id());
  v_name text;
  v_stock numeric;
  v_new numeric;
  v_cost numeric;
  v_id uuid;
begin
  if v_company is null or not (select private.has_permission(v_company, 'estoque.movimentar')) then
    raise exception 'Sem permissão para registrar perdas';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Informe uma quantidade maior que zero'; end if;
  if p_kind not in ('EXPIRY', 'BREAKAGE', 'CONTAMINATION', 'DAMAGE', 'OTHER') then raise exception 'Tipo de ocorrência inválido'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Informe a justificativa da perda'; end if;
  if p_occurred_on is null or p_occurred_on > current_date then raise exception 'Data da ocorrência inválida'; end if;

  v_cost := private.item_unit_cost(p_item_type, p_item_id);

  if p_item_type = 'PRODUCT' then
    select p.name, p.current_stock into v_name, v_stock from public.products p where p.id = p_item_id and p.company_id = v_company for update;
    if v_name is null then raise exception 'Produto não encontrado'; end if;
    if v_stock < p_quantity then raise exception 'Saldo insuficiente para registrar a perda (saldo atual %)', v_stock; end if;
    v_new := v_stock - p_quantity;
    update public.products set current_stock = v_new where id = p_item_id;
    insert into public.stock_movements (product_id, variation, origin, previous_balance, new_balance, observation, company_id, unit_id)
    values (p_item_id, -p_quantity, 'loss', v_stock, v_new, 'Perda/avaria (' || p_kind || ') — ' || p_reason, v_company, v_unit);
  elsif p_item_type = 'RAW_MATERIAL' then
    select m.name, m.current_stock into v_name, v_stock from public.raw_materials m where m.id = p_item_id and m.company_id = v_company for update;
    if v_name is null then raise exception 'Insumo não encontrado'; end if;
    if v_stock < p_quantity then raise exception 'Saldo insuficiente para registrar a perda (saldo atual %)', v_stock; end if;
    v_new := v_stock - p_quantity;
    update public.raw_materials set current_stock = v_new where id = p_item_id;
    insert into public.raw_material_movements (company_id, unit_id, raw_material_id, variation, origin, previous_balance, new_balance, observation)
    values (v_company, v_unit, p_item_id, -p_quantity, 'loss', v_stock, v_new, 'Perda/avaria (' || p_kind || ') — ' || p_reason);
  else
    raise exception 'Tipo de item inválido';
  end if;

  insert into public.stock_loss_records (company_id, unit_id, item_type, item_id, item_name, quantity, kind, occurred_on, reason, unit_cost, total_cost)
  values (v_company, v_unit, p_item_type, p_item_id, v_name, p_quantity, p_kind, p_occurred_on, p_reason, v_cost,
          case when v_cost is null then null else round(v_cost * p_quantity, 2) end)
  returning id into v_id;
  perform private.record_audit_event('stock.loss_registered', v_company, 'stock_loss', v_id::text,
    jsonb_build_object('item_type', p_item_type, 'item_id', p_item_id, 'quantity', p_quantity, 'kind', p_kind));
  return v_id;
end;
$$;

-- Conferência física do retorno: só a quantidade apta volta ao disponível; a imprópria vira perda, sem segunda baixa.
create or replace function public.confirm_stock_return(p_return_id uuid, p_good numeric, p_notes text, p_received boolean)
returns table (good_units numeric, bad_units numeric)
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.stock_returns;
  p public.products;
  v_bad numeric;
  v_new numeric;
  v_cost numeric;
begin
  select * into r from public.stock_returns where id = p_return_id for update;
  if not found then raise exception 'Retorno não encontrado'; end if;
  if not (select private.has_permission(r.company_id, 'estoque.movimentar')) then raise exception 'Sem permissão para conferir retornos'; end if;
  if r.status <> 'AWAITING' then raise exception 'Este retorno já foi conferido'; end if;
  if not coalesce(p_received, false) then raise exception 'Confirme que a mercadoria foi recebida e conferida fisicamente'; end if;
  if p_good is null or p_good < 0 or p_good > r.expected_units then raise exception 'Quantidade apta inválida (máximo %)', r.expected_units; end if;
  if p_good <> trunc(p_good) then raise exception 'Informe quantidade inteira de unidades'; end if;
  if coalesce(trim(p_notes), '') = '' then raise exception 'Informe a observação / destino das impróprias'; end if;
  v_bad := r.expected_units - p_good;

  if p_good > 0 then
    select * into p from public.products where id = r.product_id for update;
    v_new := p.current_stock + p_good;
    update public.products set current_stock = v_new where id = p.id;
    insert into public.stock_movements (product_id, variation, origin, reference_id, previous_balance, new_balance, observation, company_id, unit_id)
    values (p.id, p_good, 'return', r.id, p.current_stock, v_new, 'Retorno conferido — ' || r.source_ref || ' — ' || p_notes, r.company_id, r.unit_id);
  end if;

  if v_bad > 0 then
    v_cost := private.item_unit_cost('PRODUCT', r.product_id);
    insert into public.stock_loss_records (company_id, unit_id, item_type, item_id, item_name, quantity, kind, occurred_on, reason, unit_cost, total_cost, source, source_id)
    values (r.company_id, r.unit_id, 'PRODUCT', r.product_id, (select name from public.products where id = r.product_id), v_bad, 'DAMAGE', current_date,
            'Retorno impróprio — ' || r.source_ref || ' — ' || p_notes, v_cost, case when v_cost is null then null else round(v_cost * v_bad, 2) end, 'RETURN', r.id);
  end if;

  update public.stock_returns
    set status = 'CONFIRMED', good_units = p_good, bad_units = v_bad, notes = p_notes, confirmed_by = auth.uid(), confirmed_at = now()
    where id = r.id;
  perform private.record_audit_event('stock.return_confirmed', r.company_id, 'stock_return', r.id::text,
    jsonb_build_object('good', p_good, 'bad', v_bad, 'notes', p_notes));
  return query select p_good, v_bad;
end;
$$;

-- Origem 1: entrega parcial/não entregue gera retorno ESPERADO (não altera saldo).
create or replace function private.expect_return_from_delivery_item()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order uuid;
  v_product uuid;
  v_ref text;
begin
  if coalesce(new.packs_not_delivered, 0) <= 0 then return new; end if;
  -- só espera retorno quando a mercadoria realmente volta: faltante na carga e entrega por engano não geram retorno
  if new.reason in ('missing', 'delivered_by_mistake') then return new; end if;
  -- falha aqui nunca pode impedir o registro da entrega
  begin
    select d.order_id, coalesce(d.er_code, '') into v_order, v_ref from public.order_deliveries d where d.id = new.delivery_id;
    select oi.product_id into v_product from public.order_items oi where oi.id = new.order_item_id;
    if v_product is null or v_order is null then return new; end if;
    insert into public.stock_returns (company_id, unit_id, source, source_ref, order_id, delivery_item_id, product_id, expected_units)
    values (new.company_id, (select u.id from public.units u where u.company_id = new.company_id and u.status = 'ACTIVE' order by u.created_at limit 1),
            'PARTIAL_DELIVERY', 'Entrega ' || v_ref, v_order, new.id, v_product, new.packs_not_delivered * greatest(new.pack_quantity, 1))
    on conflict do nothing;
  exception when others then
    raise warning 'retorno esperado não registrado: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trg_expect_return_from_delivery_item
  after insert on public.order_delivery_items
  for each row execute function private.expect_return_from_delivery_item();

-- Origem 2: cancelamento após separação. ANTES devolvia o estoque sozinho; agora só registra o retorno esperado.
create or replace function public.handle_order_cancelled_reversal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_move record;
  v_unit_id uuid;
begin
  select id into v_unit_id from public.units where company_id = new.company_id and status = 'ACTIVE' order by created_at asc limit 1;

  begin
    for v_move in
      select product_id, -sum(variation) as baixed
      from public.stock_movements
      where origin = 'order' and reference_id = new.id
      group by product_id
      having sum(variation) < 0
    loop
      insert into public.stock_returns (company_id, unit_id, source, source_ref, order_id, product_id, expected_units)
      values (new.company_id, v_unit_id, 'CANCELLATION', 'Pedido ' || new.order_number || ' cancelado', new.id, v_move.product_id, v_move.baixed)
      on conflict do nothing;
    end loop;
  exception when others then
    raise warning 'retorno esperado não registrado: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Razão: retorno e perda como tipos próprios
create or replace view public.stock_ledger with (security_invoker = true) as
  select
    'sm:' || m.id::text as ledger_id, m.company_id, m.unit_id,
    'PRODUCT'::text as item_type, m.product_id as item_id,
    case
      when m.origin = 'entry' then 'ENTRY'
      when m.origin = 'purchase_entry' then 'PURCHASE_ENTRY'
      when m.origin = 'purchase_return' then 'PURCHASE_RETURN'
      when m.origin = 'return' then 'CUSTOMER_RETURN'
      when m.origin = 'loss' then 'LOSS'
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
    case when a.origin = 'purchase_return' then 'PURCHASE_RETURN' when a.origin = 'loss' then 'LOSS' else 'INVENTORY_ADJUSTMENT' end,
    a.variation, a.previous_balance, a.new_balance,
    a.origin, a.reference_id, a.observation, a.responsible_id, a.created_at, null
  from public.raw_material_movements a;

revoke all on function public.register_stock_loss(text, uuid, numeric, text, date, text) from public, anon;
revoke all on function public.confirm_stock_return(uuid, numeric, text, boolean) from public, anon;
grant execute on function public.register_stock_loss(text, uuid, numeric, text, date, text) to authenticated;
grant execute on function public.confirm_stock_return(uuid, numeric, text, boolean) to authenticated;
