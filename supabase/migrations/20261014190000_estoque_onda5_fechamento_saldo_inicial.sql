-- Estoque · Onda 5: fechamento imutável de período, saldo inicial com custo, agendador de sessões de inventário,
-- guarda contra baixa dupla de pedido e estado das integrações.

-- 1. Guarda contra baixa dupla do mesmo pedido -------------------------------------------------------
-- Duas rotas baixam estoque de pedido: separação finalizada e pedido concluído. A primeira que ocorrer vence;
-- a segunda não repete a saída (idempotência por pedido).
create or replace function public.handle_order_completed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item record;
  v_product public.products;
  v_deducted numeric;
begin
  if new.status <> 'COMPLETED' or old.status is not distinct from 'COMPLETED' then
    return new;
  end if;
  if exists (select 1 from public.stock_movements where origin = 'order' and reference_id = new.id) then
    return new;
  end if;

  for v_item in
    select product_id, total_units from public.order_items
    where order_id = new.id and product_id is not null
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      continue;
    end if;

    v_deducted := least(v_item.total_units, v_product.current_stock);

    update public.products
      set current_stock = v_product.current_stock - v_deducted
      where id = v_item.product_id;

    insert into public.stock_movements (
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation
    ) values (
      v_item.product_id, -v_deducted, 'order', new.id,
      v_product.current_stock, v_product.current_stock - v_deducted,
      case
        when v_deducted < v_item.total_units then 'Pedido ' || new.order_number || ' — estoque insuficiente, baixou até zero (pedido de ' || v_item.total_units || ' un)'
        else 'Pedido ' || new.order_number
      end
    );
  end loop;

  return new;
end;
$$;

create or replace function public.handle_separation_finished()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_unit_id uuid;
begin
  if exists (select 1 from public.stock_movements where origin = 'order' and reference_id = new.id) then
    return new;
  end if;

  select id into v_unit_id from public.units where company_id = new.company_id and status = 'ACTIVE' order by created_at asc limit 1;

  for v_item in select * from public.order_items where order_id = new.id
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      continue;
    end if;

    update public.products
      set current_stock = greatest(current_stock - v_item.total_units, 0)
      where id = v_item.product_id;

    insert into public.stock_movements (
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation,
      company_id, unit_id
    ) values (
      v_item.product_id, -v_item.total_units, 'order', new.id,
      v_product.current_stock, greatest(v_product.current_stock - v_item.total_units, 0),
      'Baixa por separação finalizada — pedido ' || new.order_number,
      new.company_id, v_unit_id
    );
  end loop;
  return new;
end;
$$;

-- 2. Saldo inicial com custo ---------------------------------------------------------------------------
create table public.stock_opening_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid references public.units(id),
  item_type text not null check (item_type in ('PRODUCT', 'RAW_MATERIAL')),
  item_id uuid not null,
  quantity numeric not null check (quantity >= 0),
  unit_cost numeric check (unit_cost is null or unit_cost >= 0),
  justification text not null check (length(trim(justification)) > 0),
  registered_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, item_type, item_id)
);
alter table public.stock_opening_balances enable row level security;
create policy stock_opening_balances_select on public.stock_opening_balances
  for select using ((select private.is_active_company_member(company_id)));

-- Sem compra válida, a referência de custo cai para o custo do saldo inicial (nunca para zero silencioso).
create or replace function private.refresh_last_purchase(p_item_type text, p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cost numeric;
  v_date date;
begin
  select i.landed_unit_cost, coalesce(l.document_issue_date, l.competence)
    into v_cost, v_date
  from public.expense_launch_items i
  join public.expense_launches l on l.id = i.launch_id
  where i.received_at is not null and i.returned_quantity < i.quantity and i.landed_unit_cost is not null
    and ((p_item_type = 'PRODUCT' and i.product_id = p_item_id) or (p_item_type = 'RAW_MATERIAL' and i.raw_material_id = p_item_id))
  order by coalesce(l.document_issue_date, l.competence) desc, i.created_at desc
  limit 1;

  if v_cost is null then
    select ob.unit_cost, ob.created_at::date into v_cost, v_date
    from public.stock_opening_balances ob where ob.item_type = p_item_type and ob.item_id = p_item_id and ob.unit_cost is not null;
  end if;

  if p_item_type = 'PRODUCT' then
    update public.products set last_purchase_cost = v_cost, last_purchase_date = v_date where id = p_item_id;
  else
    update public.raw_materials set last_purchase_cost = v_cost, last_purchase_date = v_date where id = p_item_id;
  end if;
end;
$$;

create or replace function public.register_opening_balance(p_item_type text, p_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_justification text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_unit uuid := (select private.default_unit_id());
  v_stock numeric;
  v_avg numeric;
  v_nature text;
  v_new numeric;
  v_new_avg numeric;
  v_id uuid;
begin
  if v_company is null or not (select private.inventory_can_manage(v_company)) then
    raise exception 'Sem permissão para registrar saldo inicial';
  end if;
  if p_quantity is null or p_quantity < 0 then raise exception 'Quantidade inválida'; end if;
  if p_unit_cost is not null and p_unit_cost < 0 then raise exception 'Custo inválido'; end if;
  if p_quantity = 0 and p_unit_cost is null then raise exception 'Informe a quantidade e/ou o custo unitário'; end if;
  if coalesce(trim(p_justification), '') = '' then raise exception 'Informe a origem / justificativa do saldo inicial'; end if;
  if exists (select 1 from public.stock_opening_balances where company_id = v_company and item_type = p_item_type and item_id = p_item_id) then
    raise exception 'Este item já tem saldo inicial registrado';
  end if;

  if p_item_type = 'PRODUCT' then
    select p.current_stock, p.avg_cost, p.nature into v_stock, v_avg, v_nature from public.products p where p.id = p_item_id and p.company_id = v_company for update;
    if v_stock is null then raise exception 'Produto não encontrado'; end if;
    if v_nature <> 'RESALE' and p_unit_cost is not null then
      raise exception 'Produto fabricado tem custo pela ficha técnica: informe apenas a quantidade';
    end if;
    v_new := v_stock + p_quantity;
    v_new_avg := case when p_unit_cost is null then v_avg when v_new > 0 then ((v_stock * v_avg) + (p_quantity * p_unit_cost)) / v_new else p_unit_cost end;
    if p_quantity = 0 then v_new_avg := p_unit_cost; end if;
    update public.products set current_stock = v_new, avg_cost = coalesce(v_new_avg, avg_cost) where id = p_item_id;
    if p_quantity > 0 then
      insert into public.stock_movements (product_id, variation, origin, reference_id, previous_balance, new_balance, observation, company_id, unit_id)
      values (p_item_id, p_quantity, 'adjustment', null, v_stock, v_new, 'Saldo inicial — ' || p_justification, v_company, v_unit);
    end if;
  elsif p_item_type = 'RAW_MATERIAL' then
    select m.current_stock, m.avg_cost into v_stock, v_avg from public.raw_materials m where m.id = p_item_id and m.company_id = v_company for update;
    if v_stock is null then raise exception 'Insumo não encontrado'; end if;
    v_new := v_stock + p_quantity;
    v_new_avg := case when p_unit_cost is null then v_avg when v_new > 0 then ((v_stock * v_avg) + (p_quantity * p_unit_cost)) / v_new else p_unit_cost end;
    if p_quantity = 0 then v_new_avg := p_unit_cost; end if;
    update public.raw_materials set current_stock = v_new, avg_cost = coalesce(v_new_avg, avg_cost) where id = p_item_id;
    if p_quantity > 0 then
      insert into public.raw_material_movements (company_id, unit_id, raw_material_id, variation, origin, previous_balance, new_balance, observation)
      values (v_company, v_unit, p_item_id, p_quantity, 'adjustment', v_stock, v_new, 'Saldo inicial — ' || p_justification);
    end if;
  else
    raise exception 'Tipo de item inválido';
  end if;

  insert into public.stock_opening_balances (company_id, unit_id, item_type, item_id, quantity, unit_cost, justification)
  values (v_company, v_unit, p_item_type, p_item_id, p_quantity, p_unit_cost, p_justification)
  returning id into v_id;

  perform private.refresh_last_purchase(p_item_type, p_item_id);
  perform private.record_audit_event('stock.opening_balance', v_company, 'stock_opening_balance', v_id::text,
    jsonb_build_object('item_type', p_item_type, 'item_id', p_item_id, 'quantity', p_quantity, 'unit_cost', p_unit_cost, 'justification', p_justification));
  return v_id;
end;
$$;

-- 3. Fechamento de período: fotografia imutável -------------------------------------------------------
create table public.stock_period_closings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid not null references public.units(id),
  competence date not null,
  partial boolean not null default false,
  items_count integer not null,
  total_value numeric not null,
  entries_value numeric not null default 0,
  exits_value numeric not null default 0,
  snapshot jsonb not null,
  closed_by uuid default auth.uid(),
  closed_at timestamptz not null default now(),
  unique (company_id, unit_id, competence)
);
alter table public.stock_period_closings enable row level security;
create policy stock_period_closings_select on public.stock_period_closings
  for select using ((select private.is_active_company_member(company_id)));

create or replace function private.reject_closing_mutation()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'Fechamento de estoque é imutável: eventos posteriores não recalculam o período fechado';
end;
$$;
create trigger trg_stock_closing_immutable
  before update or delete on public.stock_period_closings
  for each row execute function private.reject_closing_mutation();

create or replace function public.close_stock_period(p_competence date)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_unit uuid := (select private.default_unit_id());
  v_start date := date_trunc('month', p_competence)::date;
  v_end date := (date_trunc('month', p_competence) + interval '1 month')::date;
  v_items jsonb;
  v_moves jsonb;
  v_inventory jsonb;
  v_losses jsonb;
  v_policy jsonb;
  v_total numeric;
  v_entries numeric := 0;
  v_exits numeric := 0;
  v_uncosted integer := 0;
  v_count integer;
  v_id uuid;
begin
  if v_company is null or not (select private.has_permission(v_company, 'estoque.politicas.gerenciar')) then
    raise exception 'Sem permissão para fechar o período';
  end if;
  if v_start > current_date then raise exception 'Não é possível fechar uma competência futura'; end if;
  if exists (select 1 from public.stock_period_closings where company_id = v_company and unit_id = v_unit and competence = v_start) then
    raise exception 'Esta competência já foi fechada e não pode ser refeita';
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.item_type, p.name), '[]'::jsonb), coalesce(sum(p.stock_value), 0), count(*)
    into v_items, v_total, v_count
  from public.stock_position() p;

  -- fluxos da competência a custo do fechamento (item sem custo conhecido não vira zero: é contado à parte)
  select coalesce(sum(case when l.quantity > 0 and pos.unit_cost is not null then l.quantity * pos.unit_cost else 0 end), 0),
         coalesce(sum(case when l.quantity < 0 and pos.unit_cost is not null then -l.quantity * pos.unit_cost else 0 end), 0),
         count(*) filter (where pos.unit_cost is null)
    into v_entries, v_exits, v_uncosted
  from public.stock_ledger l
  left join public.stock_position() pos on pos.item_id = l.item_id
  where l.company_id = v_company and l.occurred_at >= v_start and l.occurred_at < v_end;

  select coalesce(jsonb_agg(jsonb_build_object('type', x.movement_type, 'count', x.n, 'quantity', x.q) order by x.movement_type), '[]'::jsonb)
    into v_moves
  from (select l.movement_type, count(*) n, sum(l.quantity) q from public.stock_ledger l
        where l.company_id = v_company and l.occurred_at >= v_start and l.occurred_at < v_end group by l.movement_type) x;

  select coalesce(jsonb_agg(jsonb_build_object('session_id', s.id, 'status', s.status, 'modality', s.modality,
           'items', (select count(*) from public.inventory_session_items i where i.session_id = s.id),
           'counted', (select count(*) from public.inventory_counts c where c.session_id = s.id and c.round = 1),
           'divergences', (select count(*) from public.inventory_counts c where c.session_id = s.id and c.round = 1 and c.difference <> 0))), '[]'::jsonb)
    into v_inventory
  from public.inventory_sessions s where s.company_id = v_company and s.starts_at >= v_start and s.starts_at < v_end;

  select jsonb_build_object('count', count(*), 'total_cost', coalesce(sum(r.total_cost), 0), 'unknown_cost', count(*) filter (where r.total_cost is null),
           'awaiting_returns', (select count(*) from public.stock_returns x where x.company_id = v_company and x.status = 'AWAITING'))
    into v_losses
  from public.stock_loss_records r where r.company_id = v_company and r.occurred_on >= v_start and r.occurred_on < v_end;

  select jsonb_build_object(
    'product', (select to_jsonb(e) from private.effective_policy(v_company, v_unit, 'PRODUCT') e),
    'raw_material', (select to_jsonb(e) from private.effective_policy(v_company, v_unit, 'RAW_MATERIAL') e)) into v_policy;

  insert into public.stock_period_closings (company_id, unit_id, competence, partial, items_count, total_value, entries_value, exits_value, snapshot)
  values (v_company, v_unit, v_start, v_end > current_date, v_count, v_total, v_entries, v_exits, jsonb_build_object(
    'generated_at', now(), 'calculation_version', 'estoque-v1', 'items', v_items, 'movements', v_moves,
    'inventory', v_inventory, 'losses_and_returns', v_losses, 'policy', v_policy, 'uncosted_movements', v_uncosted,
    'criteria', 'Cobertura = disponível ÷ demanda média; disponível = físico − reservado; valor a custo usa custo médio ponderado; fluxos a custo do fechamento.'))
  returning id into v_id;

  perform private.record_audit_event('stock.period_closed', v_company, 'stock_period_closing', v_id::text,
    jsonb_build_object('competence', v_start, 'items', v_count, 'total_value', v_total));
  return v_id;
end;
$$;

-- 4. Agendador: sessões programadas abrem sozinhas no horário, sem depender de alguém abrir a tela -------
create or replace function private.inventory_sync_all()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  c record;
begin
  for c in select distinct company_id from public.inventory_sessions where status in ('SCHEDULED', 'OPEN') loop
    perform private.inventory_sync_sessions(c.company_id);
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'estoque-inventory-sync') then
    perform cron.schedule('estoque-inventory-sync', '*/5 * * * *', 'select private.inventory_sync_all()');
  end if;
end $$;

-- 5. Estado das integrações (somente leitura sobre dados reais) ------------------------------------------
create or replace function public.stock_integration_status()
returns table (origin_key text, last_event_at timestamptz, events_30d bigint, pending bigint)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.is_active_company_member(v_company)) then return; end if;
  return query
  select 'compras'::text,
         (select max(t) from (select max(e.created_at) t from public.raw_material_entries e where e.company_id = v_company and e.status = 'confirmed'
                              union all select max(m.created_at) from public.stock_movements m where m.company_id = v_company and m.origin = 'purchase_entry') x),
         (select count(*) from public.raw_material_entries e where e.company_id = v_company and e.status = 'confirmed' and e.created_at > now() - interval '30 days')
           + (select count(*) from public.stock_movements m where m.company_id = v_company and m.origin = 'purchase_entry' and m.created_at > now() - interval '30 days'),
         (select count(*) from public.raw_material_entries e where e.company_id = v_company and e.status = 'draft')
           + (select count(*) from public.expense_launch_items i join public.expense_launches l on l.id = i.launch_id where l.company_id = v_company and i.product_id is not null and i.received_at is null)
  union all
  select 'producao', (select max(r.created_at) from public.production_records r where r.company_id = v_company and r.status <> 'reversed'),
         (select count(*) from public.production_records r where r.company_id = v_company and r.status <> 'reversed' and r.created_at > now() - interval '30 days'),
         (select count(*) from public.production_releases r where r.company_id = v_company)
  union all
  select 'chao_fabrica', (select max(r.created_at) from public.production_records r where r.company_id = v_company and r.floor_execution_id is not null),
         (select count(*) from public.production_records r where r.company_id = v_company and r.floor_execution_id is not null and r.created_at > now() - interval '30 days'), 0::bigint
  union all
  select 'separa_confere', (select max(m.created_at) from public.stock_movements m where m.company_id = v_company and m.origin = 'order'),
         (select count(*) from public.stock_movements m where m.company_id = v_company and m.origin = 'order' and m.created_at > now() - interval '30 days'),
         (select count(*) from public.orders o where o.company_id = v_company and o.status = 'CONFIRMED' and o.separation_finished_at is null)
  union all
  select 'entrega', (select max(d.created_at) from public.order_deliveries d where d.company_id = v_company),
         (select count(*) from public.order_deliveries d where d.company_id = v_company and d.created_at > now() - interval '30 days'),
         (select count(*) from public.stock_returns x where x.company_id = v_company and x.status = 'AWAITING')
  union all
  select 'produtos', (select max(p.updated_at) from public.products p where p.company_id = v_company), 0::bigint, 0::bigint;
end;
$$;

alter publication supabase_realtime add table public.stock_returns;
alter publication supabase_realtime add table public.stock_loss_records;
alter publication supabase_realtime add table public.raw_material_movements;
alter publication supabase_realtime add table public.stock_period_closings;

revoke all on function public.register_opening_balance(text, uuid, numeric, numeric, text) from public, anon;
revoke all on function public.close_stock_period(date) from public, anon;
revoke all on function public.stock_integration_status() from public, anon;
grant execute on function public.register_opening_balance(text, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.close_stock_period(date) to authenticated;
grant execute on function public.stock_integration_status() to authenticated;
