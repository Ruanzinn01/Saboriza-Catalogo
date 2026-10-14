-- Estoque · revisão final: isolamento por empresa no saldo, razão protegido, fechamento único, grupos de insumo
-- e "Corrigir compra" (diferença aplicada por movimento novo, sem apagar o original).

-- 1. Trava de empresa no ponto em que o saldo muda ----------------------------------------------------
-- As funções antigas de saldo são SECURITY DEFINER e não checavam a empresa: um usuário logado de outra empresa
-- poderia ajustar o saldo de um produto alheio. A trava vale para qualquer rota (atual ou futura). Jobs e funções de
-- serviço (sem usuário logado) continuam livres.
create or replace function private.guard_stock_write()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if (select auth.uid()) is not null
     and new.current_stock is distinct from old.current_stock
     and not (select private.is_active_company_member(new.company_id))
     and not (select private.is_platform_admin()) then
    raise exception 'Sem permissão para alterar o estoque desta empresa';
  end if;
  return new;
end;
$$;

create trigger products_guard_stock_write
  before update of current_stock on public.products
  for each row execute function private.guard_stock_write();
create trigger raw_materials_guard_stock_write
  before update of current_stock on public.raw_materials
  for each row execute function private.guard_stock_write();

-- 2. Razão: ninguém insere linha direto pela API (só as funções oficiais) --------------------------------
drop policy if exists stock_movements_insert_authenticated on public.stock_movements;

-- 3. Fechamento único por empresa e competência (o saldo não é por unidade) ----------------------------------
alter table public.stock_period_closings drop constraint stock_period_closings_company_id_unit_id_competence_key;
alter table public.stock_period_closings add constraint stock_period_closings_company_competence_key unique (company_id, competence);

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
  if exists (select 1 from public.stock_period_closings where company_id = v_company and competence = v_start) then
    raise exception 'Esta competência já foi fechada e não pode ser refeita';
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.item_type, p.name), '[]'::jsonb), coalesce(sum(p.stock_value), 0), count(*)
    into v_items, v_total, v_count
  from public.stock_position() p;

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

-- 4. Grupo do insumo: matéria-prima, embalagem ou insumo --------------------------------------------------
alter table public.raw_materials
  add column group_kind text not null default 'MATERIAL' check (group_kind in ('MATERIAL', 'PACKAGING', 'SUPPLY'));

-- 5. Corrigir compra ----------------------------------------------------------------------------------------
alter table public.stock_movements drop constraint stock_movements_origin_check;
alter table public.stock_movements add constraint stock_movements_origin_check
  check (origin = any (array['production','entry','order','adjustment','order_cancel_reversal','purchase_entry','purchase_return','return','loss','purchase_correction']));
alter table public.raw_material_movements drop constraint raw_material_movements_origin_check;
alter table public.raw_material_movements add constraint raw_material_movements_origin_check
  check (origin in ('adjustment', 'purchase_return', 'loss', 'purchase_correction'));

create table public.purchase_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  launch_id uuid not null references public.expense_launches(id),
  launch_item_id uuid not null references public.expense_launch_items(id),
  old_quantity numeric not null,
  new_quantity numeric not null,
  old_unit_price numeric not null,
  new_unit_price numeric not null,
  delta_value numeric not null,
  applied_to_open numeric not null default 0,
  credit_created numeric not null default 0,
  extra_charge numeric not null default 0,
  reason text not null check (length(trim(reason)) > 0),
  corrected_by uuid default auth.uid(),
  corrected_at timestamptz not null default now()
);
create index purchase_corrections_launch_idx on public.purchase_corrections (launch_id);
alter table public.purchase_corrections enable row level security;
create policy purchase_corrections_select on public.purchase_corrections
  for select using ((select private.has_permission(company_id, 'despesas.read')));

-- Só corrige linha já recebida, de compra sem rateio (sem frete/outras despesas/desconto), para o custo da linha ser exato.
-- A diferença de quantidade vira movimento novo; a de valor ajusta o que está em aberto ou gera crédito/cobrança extra.
create or replace function public.correct_launch_item(p_item_id uuid, p_new_quantity numeric, p_new_unit_price numeric, p_reason text)
returns table (delta_value numeric, applied_to_open numeric, credit_created numeric, extra_charge numeric)
language plpgsql
security definer
set search_path to ''
as $$
declare
  i public.expense_launch_items;
  l public.expense_launches;
  v_dq numeric;
  v_dv numeric;
  v_stock numeric;
  v_avg numeric;
  v_new_stock numeric;
  v_new_avg numeric;
  v_unit uuid;
  v_remaining numeric;
  v_applied numeric := 0;
  v_credit numeric := 0;
  v_extra numeric := 0;
  v_cut numeric;
  x record;
  v_template public.expenses;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Informe o motivo da correção'; end if;
  if p_new_quantity is null or p_new_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
  if p_new_unit_price is null or p_new_unit_price < 0 then raise exception 'Valor unitário inválido'; end if;

  select * into i from public.expense_launch_items where id = p_item_id for update;
  if not found then raise exception 'Item não encontrado'; end if;
  select * into l from public.expense_launches where id = i.launch_id for update;
  if not (select private.has_permission(l.company_id, 'despesas.manage')) then raise exception 'Sem permissão para corrigir compras'; end if;
  if i.kind <> 'stock' or i.received_at is null or i.landed_unit_cost is null then
    raise exception 'Só é possível corrigir item de estoque já recebido, lançado no fluxo novo';
  end if;
  if l.freight <> 0 or l.other_costs <> 0 or l.discount <> 0 then
    raise exception 'Esta compra tem frete/outras despesas/desconto rateados. Corrija por devolução e novo lançamento.';
  end if;
  if p_new_quantity < i.returned_quantity then raise exception 'A nova quantidade não pode ser menor que a já devolvida (%)', i.returned_quantity; end if;
  if p_new_quantity = i.quantity and p_new_unit_price = i.unit_price then raise exception 'Nenhuma diferença a corrigir'; end if;

  v_dq := p_new_quantity - i.quantity;
  v_dv := p_new_quantity * p_new_unit_price - i.quantity * i.unit_price;
  select u.id into v_unit from public.units u where u.company_id = l.company_id and u.status = 'ACTIVE' order by u.created_at limit 1;

  if i.raw_material_id is not null then
    select m.current_stock, m.avg_cost into v_stock, v_avg from public.raw_materials m where m.id = i.raw_material_id for update;
  else
    select p.current_stock, p.avg_cost into v_stock, v_avg from public.products p where p.id = i.product_id for update;
  end if;
  v_new_stock := v_stock + v_dq;
  if v_new_stock < 0 then raise exception 'Estoque atual (%) não comporta a redução de % un', v_stock, -v_dq; end if;
  -- o valor do estoque muda exatamente pela diferença da compra
  v_new_avg := case when v_new_stock > 0 then greatest((v_stock * v_avg + v_dv) / v_new_stock, 0) else 0 end;

  if i.raw_material_id is not null then
    update public.raw_materials set current_stock = v_new_stock, avg_cost = v_new_avg where id = i.raw_material_id;
    if v_dq <> 0 then
      insert into public.raw_material_movements (company_id, unit_id, raw_material_id, variation, origin, reference_id, previous_balance, new_balance, observation)
      values (l.company_id, coalesce(v_unit, private.default_unit_id()), i.raw_material_id, v_dq, 'purchase_correction', l.id, v_stock, v_new_stock, 'Correção de compra — ' || p_reason);
    end if;
  else
    update public.products set current_stock = v_new_stock, avg_cost = v_new_avg where id = i.product_id;
    if v_dq <> 0 then
      insert into public.stock_movements (product_id, variation, origin, reference_id, previous_balance, new_balance, observation, company_id, unit_id)
      values (i.product_id, v_dq, 'purchase_correction', l.id, v_stock, v_new_stock, 'Correção de compra — ' || p_reason, l.company_id, v_unit);
    end if;
  end if;

  update public.expense_launch_items
    set quantity = p_new_quantity, unit_price = p_new_unit_price, amount = p_new_quantity * p_new_unit_price, landed_unit_cost = p_new_unit_price
    where id = i.id;
  update public.expense_launches set total_amount = total_amount + v_dv where id = l.id;
  if i.raw_material_id is not null then perform private.refresh_last_purchase('RAW_MATERIAL', i.raw_material_id);
  else perform private.refresh_last_purchase('PRODUCT', i.product_id); end if;

  -- Financeiro: ajusta o que está em aberto; se já foi tudo pago, registra a diferença como novo lançamento / crédito
  v_remaining := abs(v_dv);
  if v_dv > 0 then
    select e.id, e.amount into x from public.expense_launch_installments ins join public.expenses e on e.id = ins.expense_id
      where ins.launch_id = l.id and e.status in ('ABERTO', 'AGENDADO', 'ATRASADO') order by ins.number desc limit 1 for update of e;
    if found then
      update public.expenses set amount = amount + v_dv where id = x.id;
      update public.expense_launch_installments set amount = amount + v_dv where expense_id = x.id;
      v_applied := v_dv;
    else
      select * into v_template from public.expenses e where e.launch_id = l.id order by e.installment_number desc nulls last limit 1;
      insert into public.expenses (company_id, description, category, nature, origin, pattern, competence, amount, status, due_date, party_name, document_ref, source_module, source_entity_id, launch_id, payment_method)
      values (l.company_id, 'Ajuste de compra — ' || i.name_snapshot, coalesce(v_template.category, 'OUTRA'), coalesce(v_template.nature, 'OPERACIONAL'), 'stock', 'eventual',
              l.competence, v_dv, 'ABERTO', current_date, l.party_name, l.document_ref, 'despesas', l.id, l.id, l.payment_method);
      v_extra := v_dv;
    end if;
  elsif v_dv < 0 then
    for x in
      select e.id, e.amount from public.expense_launch_installments ins join public.expenses e on e.id = ins.expense_id
      where ins.launch_id = l.id and e.status in ('ABERTO', 'AGENDADO', 'ATRASADO') order by ins.number desc for update of e
    loop
      exit when v_remaining <= 0;
      v_cut := least(x.amount, v_remaining);
      update public.expenses set amount = amount - v_cut where id = x.id;
      update public.expense_launch_installments set amount = amount - v_cut where expense_id = x.id;
      v_remaining := v_remaining - v_cut;
      v_applied := v_applied + v_cut;
    end loop;
    if v_remaining > 0 then
      insert into public.supplier_credits (company_id, launch_id, supplier_id, amount, reason)
      values (l.company_id, l.id, l.supplier_id, round(v_remaining, 2), 'Correção de compra — ' || p_reason);
      v_credit := round(v_remaining, 2);
    end if;
  end if;

  insert into public.purchase_corrections (company_id, launch_id, launch_item_id, old_quantity, new_quantity, old_unit_price, new_unit_price, delta_value, applied_to_open, credit_created, extra_charge, reason)
  values (l.company_id, l.id, i.id, i.quantity, p_new_quantity, i.unit_price, p_new_unit_price, v_dv, v_applied, v_credit, v_extra, p_reason);
  perform private.record_audit_event('purchase.item_corrected', l.company_id, 'expense_launch', l.id::text,
    jsonb_build_object('item', i.name_snapshot, 'old_qty', i.quantity, 'new_qty', p_new_quantity, 'old_price', i.unit_price, 'new_price', p_new_unit_price, 'delta', v_dv, 'reason', p_reason));
  return query select round(v_dv, 2), round(v_applied, 2), v_credit, round(v_extra, 2);
end;
$$;

revoke all on function public.correct_launch_item(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.correct_launch_item(uuid, numeric, numeric, text) to authenticated;

-- 6. Razão: correção de compra como tipo próprio -----------------------------------------------------------------
create or replace view public.stock_ledger with (security_invoker = true) as
  select
    'sm:' || m.id::text as ledger_id, m.company_id, m.unit_id,
    'PRODUCT'::text as item_type, m.product_id as item_id,
    case
      when m.origin = 'entry' then 'ENTRY'
      when m.origin = 'purchase_entry' then 'PURCHASE_ENTRY'
      when m.origin = 'purchase_return' then 'PURCHASE_RETURN'
      when m.origin = 'purchase_correction' then 'PURCHASE_CORRECTION'
      when m.origin = 'return' then 'CUSTOMER_RETURN'
      when m.origin = 'loss' then 'LOSS'
      when m.origin = 'order' then 'SALE_OUT'
      when m.origin = 'order_cancel_reversal' then 'REVERSAL'
      when m.origin = 'production' then 'PRODUCTION_IN'
      when m.observation like 'Estorno de produção%' then 'REVERSAL'
      when m.observation like 'Saldo inicial%' then 'INITIAL_BALANCE'
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
    case
      when a.origin = 'purchase_return' then 'PURCHASE_RETURN'
      when a.origin = 'purchase_correction' then 'PURCHASE_CORRECTION'
      when a.origin = 'loss' then 'LOSS'
      when a.observation like 'Saldo inicial%' then 'INITIAL_BALANCE'
      else 'INVENTORY_ADJUSTMENT'
    end,
    a.variation, a.previous_balance, a.new_balance,
    a.origin, a.reference_id, a.observation, a.responsible_id, a.created_at, null
  from public.raw_material_movements a;
