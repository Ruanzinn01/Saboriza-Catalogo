-- Razão: saldo inicial passa a ter tipo próprio (antes caía em "ajuste").
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
      when a.origin = 'loss' then 'LOSS'
      when a.observation like 'Saldo inicial%' then 'INITIAL_BALANCE'
      else 'INVENTORY_ADJUSTMENT'
    end,
    a.variation, a.previous_balance, a.new_balance,
    a.origin, a.reference_id, a.observation, a.responsible_id, a.created_at, null
  from public.raw_material_movements a;
