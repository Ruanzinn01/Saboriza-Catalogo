-- Estoque · Onda 2: Compras de insumos e mercadorias.
-- Catálogo único (revenda em Produtos, insumos em Matérias-primas), rascunho no servidor, rateio,
-- custo da última compra x custo médio, recebimento posterior e devolução ao fornecedor.
-- Alterações aditivas; create_expense_launch é recriada preservando o comportamento anterior.

-- 1. Catálogo --------------------------------------------------------------------------------
alter table public.products
  add column nature text not null default 'MANUFACTURED' check (nature in ('MANUFACTURED', 'RESALE')),
  add column avg_cost numeric not null default 0 check (avg_cost >= 0),
  add column last_purchase_cost numeric check (last_purchase_cost is null or last_purchase_cost >= 0),
  add column last_purchase_date date;

alter table public.raw_materials
  add column last_purchase_cost numeric check (last_purchase_cost is null or last_purchase_cost >= 0),
  add column last_purchase_date date,
  add column gtin text not null default '';

-- Código do fornecedor pertence ao par fornecedor + item interno; o mesmo código pode existir em outro fornecedor.
create table public.item_supplier_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  item_type text not null check (item_type in ('PRODUCT', 'RAW_MATERIAL')),
  item_id uuid not null,
  code text not null check (length(trim(code)) > 0),
  created_at timestamptz not null default now(),
  unique (company_id, supplier_id, code),
  unique (company_id, supplier_id, item_type, item_id)
);
create index item_supplier_codes_item_idx on public.item_supplier_codes (item_type, item_id);
alter table public.item_supplier_codes enable row level security;
create policy item_supplier_codes_select on public.item_supplier_codes
  for select using ((select private.is_active_company_member(company_id)));
create policy item_supplier_codes_insert on public.item_supplier_codes
  for insert with check ((select private.has_permission(company_id, 'despesas.manage')));
create policy item_supplier_codes_update on public.item_supplier_codes
  for update using ((select private.has_permission(company_id, 'despesas.manage')))
  with check ((select private.has_permission(company_id, 'despesas.manage')));
create policy item_supplier_codes_delete on public.item_supplier_codes
  for delete using ((select private.has_permission(company_id, 'despesas.manage')));

-- 2. Rascunhos de compra no servidor ---------------------------------------------------------
create table public.purchase_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  created_by uuid not null default auth.uid(),
  supplier_label text not null default '',
  document_ref text not null default '',
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE', 'DISCARDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchase_drafts_company_status_idx on public.purchase_drafts (company_id, status, updated_at desc);
alter table public.purchase_drafts enable row level security;
create policy purchase_drafts_select on public.purchase_drafts
  for select using ((select private.has_permission(company_id, 'despesas.manage')));

-- Salva com controle de versão: duas abas não sobrescrevem silenciosamente uma à outra.
create or replace function public.save_purchase_draft(p_draft_id uuid, p_expected_version integer, p_supplier_label text, p_document_ref text, p_payload jsonb)
returns table (draft_id uuid, version integer, updated_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  d public.purchase_drafts;
begin
  if v_company is null or not (select private.has_permission(v_company, 'despesas.manage')) then
    raise exception 'Sem permissão para lançar compras';
  end if;

  if p_draft_id is null then
    insert into public.purchase_drafts (company_id, supplier_label, document_ref, payload)
    values (v_company, coalesce(p_supplier_label, ''), coalesce(p_document_ref, ''), coalesce(p_payload, '{}'::jsonb))
    returning * into d;
    return query select d.id, d.version, d.updated_at;
    return;
  end if;

  select * into d from public.purchase_drafts x where x.id = p_draft_id and x.company_id = v_company for update;
  if not found then raise exception 'Rascunho não encontrado'; end if;
  if d.status <> 'OPEN' then raise exception 'Este rascunho já foi finalizado ou descartado'; end if;
  if d.version <> p_expected_version then
    raise exception 'CONFLITO_RASCUNHO: o rascunho foi alterado em outra aba (versão atual %)', d.version;
  end if;

  update public.purchase_drafts x
    set supplier_label = coalesce(p_supplier_label, ''), document_ref = coalesce(p_document_ref, ''),
        payload = coalesce(p_payload, '{}'::jsonb), version = x.version + 1, updated_at = now()
    where x.id = d.id
    returning * into d;
  return query select d.id, d.version, d.updated_at;
end;
$$;

create or replace function public.close_purchase_draft(p_draft_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if p_status not in ('DONE', 'DISCARDED') then raise exception 'Estado inválido'; end if;
  if v_company is null or not (select private.has_permission(v_company, 'despesas.manage')) then
    raise exception 'Sem permissão para lançar compras';
  end if;
  update public.purchase_drafts set status = p_status, updated_at = now()
    where id = p_draft_id and company_id = v_company and status = 'OPEN';
end;
$$;

-- 3. Estruturas de apoio na compra --------------------------------------------------------------
alter table public.expense_launches add column other_costs numeric not null default 0 check (other_costs >= 0);

alter table public.expense_launch_items
  add column product_id uuid references public.products(id),
  add column landed_unit_cost numeric,
  add column received_at timestamptz,
  add column returned_quantity numeric not null default 0 check (returned_quantity >= 0);

alter table public.raw_material_entries
  add column launch_id uuid references public.expense_launches(id),
  add column launch_item_id uuid references public.expense_launch_items(id);
create index raw_material_entries_launch_idx on public.raw_material_entries (launch_id) where launch_id is not null;

create table public.supplier_credits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  launch_id uuid not null references public.expense_launches(id),
  supplier_id uuid references public.suppliers(id),
  amount numeric not null check (amount > 0),
  reason text not null,
  status text not null default 'A_RECUPERAR' check (status in ('A_RECUPERAR', 'RECUPERADO')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.supplier_credits enable row level security;
create policy supplier_credits_select on public.supplier_credits
  for select using ((select private.has_permission(company_id, 'despesas.read')));

-- origens novas nos livros de movimento
alter table public.stock_movements drop constraint stock_movements_origin_check;
alter table public.stock_movements add constraint stock_movements_origin_check
  check (origin = any (array['production','entry','order','adjustment','order_cancel_reversal','purchase_entry','purchase_return']));
alter table public.raw_material_movements drop constraint raw_material_movements_origin_check;
alter table public.raw_material_movements add constraint raw_material_movements_origin_check
  check (origin in ('adjustment', 'purchase_return'));

-- 4. Custo da última compra válida (margem) — separado do custo médio (valor do saldo) -------------
-- Compra válida = recebida e não devolvida por inteiro; vale a de data mais recente, não a digitada por último.
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

  if p_item_type = 'PRODUCT' then
    update public.products set last_purchase_cost = v_cost, last_purchase_date = v_date where id = p_item_id;
  else
    update public.raw_materials set last_purchase_cost = v_cost, last_purchase_date = v_date where id = p_item_id;
  end if;
end;
$$;

-- Entrada física de produto para revenda: movimento no razão + custo médio ponderado, uma única vez por linha.
create or replace function private.receive_product_line(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  i public.expense_launch_items;
  l public.expense_launches;
  p public.products;
  v_new_stock numeric;
  v_new_avg numeric;
  v_unit uuid;
begin
  select * into i from public.expense_launch_items where id = p_item_id for update;
  if not found or i.product_id is null then raise exception 'Linha de produto não encontrada'; end if;
  if i.received_at is not null then return; end if;
  select * into l from public.expense_launches where id = i.launch_id;
  select * into p from public.products where id = i.product_id and company_id = l.company_id for update;
  if not found then raise exception 'Produto não pertence a esta empresa'; end if;

  v_new_stock := p.current_stock + i.quantity;
  v_new_avg := case when v_new_stock > 0 then ((p.current_stock * p.avg_cost) + (i.quantity * i.landed_unit_cost)) / v_new_stock else 0 end;
  select u.id into v_unit from public.units u where u.company_id = l.company_id and u.status = 'ACTIVE' order by u.created_at limit 1;

  update public.products set current_stock = v_new_stock, avg_cost = v_new_avg where id = p.id;
  insert into public.stock_movements (product_id, variation, origin, reference_id, previous_balance, new_balance, observation, company_id, unit_id)
  values (p.id, i.quantity, 'purchase_entry', l.id, p.current_stock, v_new_stock,
          'Entrada de compra' || case when coalesce(l.document_ref, '') <> '' then ' — NF ' || l.document_ref else '' end,
          l.company_id, v_unit);
  update public.expense_launch_items set received_at = now() where id = i.id;
  perform private.refresh_last_purchase('PRODUCT', p.id);
end;
$$;

-- 5. Lançamento financeiro + efeito de estoque (função existente, estendida) --------------------
create or replace function public.create_expense_launch(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_launch_id uuid;
  v_existing_launch_id uuid;
  v_item jsonb;
  v_installment jsonb;
  v_items_total numeric := 0;
  v_installments_total numeric := 0;
  v_total numeric;
  v_first_category text;
  v_first_employee_id uuid;
  v_pattern text;
  v_nature text;
  v_idempotency text;
  v_expense_id uuid;
  v_entry_id uuid;
  v_item_id uuid;
  v_obligation_id uuid;
  v_rec_id uuid;
  v_item_count int := 0;
  v_subcategory text;
  v_item_detail text;
  v_salary_due_date date;
  v_installment_count int;
  v_freight numeric := coalesce((p_payload->>'freight')::numeric, 0);
  v_other numeric := coalesce((p_payload->>'other_costs')::numeric, 0);
  v_discount numeric := coalesce((p_payload->>'discount')::numeric, 0);
  v_landed_factor numeric := 1;
  v_landed_unit numeric;
  v_factor numeric;
  v_doc_date date;
  v_received boolean := coalesce((p_payload->>'received')::boolean, false);
begin
  v_company := private.default_company_id();
  if v_company is null then
    raise exception 'Empresa não identificada';
  end if;
  if not private.has_permission(v_company, 'despesas.manage') then
    raise exception 'Sem permissão para lançar despesas';
  end if;

  v_idempotency := p_payload->>'idempotency_key';
  if v_idempotency is not null then
    select id into v_existing_launch_id from public.expense_launches
      where company_id = v_company and idempotency_key = v_idempotency;
    if v_existing_launch_id is not null then
      return v_existing_launch_id;
    end if;
  end if;

  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'Lançamento sem itens';
  end if;

  -- Nota repetida: mesma empresa + fornecedor + número + série exige justificativa explícita.
  if coalesce(p_payload->>'document_ref', '') <> '' and (p_payload->>'supplier_id') is not null
     and coalesce(p_payload->>'duplicate_reason', '') = '' then
    if exists (
      select 1 from public.expense_launches l
      where l.company_id = v_company and l.supplier_id = (p_payload->>'supplier_id')::uuid
        and l.document_ref = p_payload->>'document_ref'
        and coalesce(l.document_series, '') = coalesce(p_payload->>'document_series', '')
    ) then
      raise exception 'NOTA_DUPLICADA: já existe lançamento deste fornecedor com o mesmo número e série. Informe o motivo para registrar novamente.';
    end if;
  end if;

  -- Totais e validação de soma das parcelas
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_items_total := v_items_total + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
  end loop;
  v_total := round((v_items_total + v_freight + v_other - v_discount)::numeric, 2);
  if v_total < 0 then
    raise exception 'O desconto não pode ultrapassar o valor total da compra';
  end if;

  -- Rateio proporcional ao subtotal: despesas aumentam e descontos reduzem o custo unitário de aquisição.
  if v_items_total > 0 then
    v_landed_factor := (v_items_total + v_freight + v_other - v_discount) / v_items_total;
  end if;

  for v_installment in select * from jsonb_array_elements(coalesce(p_payload->'installments', '[]'::jsonb)) loop
    v_installments_total := v_installments_total + (v_installment->>'amount')::numeric;
  end loop;
  if abs(round(v_installments_total::numeric, 2) - v_total) > 0.01 then
    raise exception 'A soma das parcelas (%) não confere com o total do lançamento (%)', v_installments_total, v_total;
  end if;

  v_installment_count := jsonb_array_length(coalesce(p_payload->'installments', '[]'::jsonb));

  if p_payload->>'kind' = 'salary' then
    v_salary_due_date := (p_payload->'installments'->0->>'due_date')::date;
  end if;

  select coalesce(c.name, 'Diversos') into v_first_category
    from jsonb_array_elements(p_payload->'items') it
    left join public.expense_categories c on c.id = (it->>'category_id')::uuid
    limit 1;

  select (it->>'employee_id')::uuid into v_first_employee_id
    from jsonb_array_elements(p_payload->'items') it
    where it->>'payroll_type' = 'salary'
    limit 1;

  v_nature := case p_payload->>'kind'
    when 'asset' then 'INVESTIMENTO'
    when 'salary' then 'SALARIO'
    when 'partner' then 'OUTRO'
    else 'OPERACIONAL'
  end;

  select case
    when bool_or(coalesce((it->'recurrence'->>'enabled')::boolean, false) and not coalesce((it->'recurrence'->>'variable_amount')::boolean, false)) then 'fixed'
    when bool_or(coalesce((it->'recurrence'->>'enabled')::boolean, false) and coalesce((it->'recurrence'->>'variable_amount')::boolean, false)) then 'variable'
    else 'eventual'
  end into v_pattern
  from jsonb_array_elements(p_payload->'items') it;

  v_doc_date := coalesce((p_payload->>'document_issue_date')::date, (p_payload->>'competence')::date);

  insert into public.expense_launches (
    company_id, kind, party_type, party_name, supplier_id, partner_id, competence,
    document_ref, document_series, document_issue_date, document_access_key, batch, expiry_date,
    freight, other_costs, discount, total_amount, received, payment_method, payment_condition, scheduled,
    recipient_key, recipient_holder, observations, duplicate_reason, idempotency_key
  ) values (
    v_company, p_payload->>'kind', p_payload->>'party_type', p_payload->>'party_name',
    (p_payload->>'supplier_id')::uuid, (p_payload->>'partner_id')::uuid, (p_payload->>'competence')::date,
    p_payload->>'document_ref', p_payload->>'document_series', (p_payload->>'document_issue_date')::date, p_payload->>'document_access_key',
    p_payload->>'batch', (p_payload->>'expiry_date')::date,
    v_freight, v_other, v_discount, v_total,
    v_received, p_payload->>'payment_method', p_payload->>'payment_condition',
    coalesce((p_payload->>'scheduled')::boolean, false), p_payload->>'recipient_key', p_payload->>'recipient_holder',
    p_payload->>'observations', p_payload->>'duplicate_reason', v_idempotency
  ) returning id into v_launch_id;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_item_count := v_item_count + 1;
    -- custo rateado por unidade de controle só existe no fluxo novo (quantidade já na unidade de controle ou produto de revenda)
    v_landed_unit := case
      when v_item->>'kind' = 'stock'
        and ((v_item->>'product_id') is not null or coalesce((v_item->>'control_unit_quantity')::boolean, false))
      then (v_item->>'unit_price')::numeric * v_landed_factor
      else null
    end;

    if (v_item->>'raw_material_id') is not null and not exists (
      select 1 from public.raw_materials m where m.id = (v_item->>'raw_material_id')::uuid and m.company_id = v_company
    ) then
      raise exception 'Insumo não pertence a esta empresa';
    end if;
    if (v_item->>'product_id') is not null and not exists (
      select 1 from public.products pr where pr.id = (v_item->>'product_id')::uuid and pr.company_id = v_company
    ) then
      raise exception 'Produto não pertence a esta empresa';
    end if;

    insert into public.expense_launch_items (
      launch_id, kind, category_id, raw_material_id, product_id, catalog_item_id, employee_id,
      name_snapshot, unit, quantity, unit_price, amount, rateable, contract_label,
      payroll_type, reference_expense_id, description, landed_unit_cost
    ) values (
      v_launch_id, v_item->>'kind', (v_item->>'category_id')::uuid, (v_item->>'raw_material_id')::uuid, (v_item->>'product_id')::uuid,
      (v_item->>'catalog_item_id')::uuid, (v_item->>'employee_id')::uuid,
      v_item->>'name_snapshot', coalesce(v_item->>'unit', 'un'), (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, coalesce((v_item->>'rateable')::boolean, false),
      v_item->>'contract_label', v_item->>'payroll_type', (v_item->>'reference_expense_id')::uuid, v_item->>'description',
      v_landed_unit
    ) returning id into v_item_id;
    -- (landed_unit_cost: custo de aquisição por unidade de controle, já com frete/outras despesas/desconto rateados)

    -- Insumos: entrada de estoque (reaproveita o fluxo de Matéria-Prima)
    if v_item->>'kind' = 'stock' and (v_item->>'raw_material_id') is not null then
      select m.purchase_unit_factor into v_factor from public.raw_materials m where m.id = (v_item->>'raw_material_id')::uuid;

      insert into public.raw_material_entries (
        raw_material_id, supplier_id, packages_quantity, unit_price, batch, expiry_date, entry_date,
        invoice_number, invoice_series, invoice_issue_date, invoice_access_key, launch_id, launch_item_id
      ) values (
        (v_item->>'raw_material_id')::uuid, (p_payload->>'supplier_id')::uuid,
        -- quantidade informada direto na unidade de controle (sem conversão de embalagem): convertida uma única vez aqui
        case when coalesce((v_item->>'control_unit_quantity')::boolean, false) then (v_item->>'quantity')::numeric / v_factor else (v_item->>'quantity')::numeric end,
        case when coalesce((v_item->>'control_unit_quantity')::boolean, false) then v_landed_unit * v_factor else (v_item->>'unit_price')::numeric end,
        coalesce(p_payload->>'batch', ''), coalesce((p_payload->>'expiry_date')::date, (p_payload->>'competence')::date),
        coalesce((p_payload->>'competence')::date, current_date),
        coalesce(p_payload->>'document_ref', ''), coalesce(p_payload->>'document_series', ''),
        (p_payload->>'document_issue_date')::date, coalesce(p_payload->>'document_access_key', ''),
        v_launch_id, v_item_id
      ) returning id into v_entry_id;

      if v_received then
        perform public.confirm_raw_material_entry(v_entry_id);
        update public.expense_launch_items set received_at = now() where id = v_item_id;
        if coalesce((v_item->>'control_unit_quantity')::boolean, false) then
          perform private.refresh_last_purchase('RAW_MATERIAL', (v_item->>'raw_material_id')::uuid);
        end if;
      end if;
    end if;

    -- Produtos para revenda: entrada pelo mesmo caminho, só da quantidade recebida
    if v_item->>'kind' = 'stock' and (v_item->>'product_id') is not null and v_received then
      perform private.receive_product_line(v_item_id);
    end if;

    if v_item->>'kind' = 'asset' then
      insert into public.investment_formation_ledger (company_id, category_id, direction, amount, competence)
      values (
        v_company,
        coalesce((select name from public.expense_categories where id = (v_item->>'category_id')::uuid), v_item->>'name_snapshot'),
        'credit', (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, (p_payload->>'competence')::date
      );
    end if;

    if v_item->>'kind' = 'salary' and v_item->>'payroll_type' = 'salary' then
      select id into v_obligation_id from public.salary_obligations
        where company_id = v_company and employee_id = (v_item->>'employee_id')::uuid and competence = (p_payload->>'competence')::date;
      if v_obligation_id is not null then
        raise exception 'Já existe apuração salarial deste colaborador nesta competência';
      end if;
      insert into public.salary_obligations (company_id, employee_id, competence, base_salary, additions, deductions, net_amount, status, due_date)
      values (
        v_company, (v_item->>'employee_id')::uuid, (p_payload->>'competence')::date,
        (v_item->>'unit_price')::numeric - coalesce((v_item->'breakdown'->>'extra')::numeric, 0) + coalesce((v_item->'breakdown'->>'discount')::numeric, 0),
        coalesce((v_item->'breakdown'->>'extra')::numeric, 0), coalesce((v_item->'breakdown'->>'discount')::numeric, 0),
        (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 'ABERTO', v_salary_due_date
      );
    elsif v_item->>'kind' = 'salary' and v_item->>'payroll_type' = 'advance' then
      select id into v_obligation_id from public.salary_obligations
        where company_id = v_company and employee_id = (v_item->>'employee_id')::uuid and competence = (p_payload->>'competence')::date;
      if v_obligation_id is null then
        insert into public.salary_obligations (company_id, employee_id, competence, base_salary, net_amount, status, due_date)
        values (v_company, (v_item->>'employee_id')::uuid, (p_payload->>'competence')::date, 0, 0, 'ABERTO', v_salary_due_date)
        returning id into v_obligation_id;
      end if;
      insert into public.salary_advances (company_id, salary_obligation_id, amount, status)
      values (v_company, v_obligation_id, (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 'SOLICITADO');
    end if;

    if coalesce((v_item->'recurrence'->>'enabled')::boolean, false) then
      insert into public.expense_recurrences (
        company_id, kind, party_type, party_name, supplier_id, partner_id, raw_material_id, catalog_item_id,
        contract_label, amount, rateable, frequency, interval_days, day_of_month, start_date, end_mode, end_date,
        occurrences, variable_amount, reference_expense_id, first_launch_id
      ) values (
        v_company, v_item->>'kind', p_payload->>'party_type', p_payload->>'party_name',
        (p_payload->>'supplier_id')::uuid, (p_payload->>'partner_id')::uuid, (v_item->>'raw_material_id')::uuid, (v_item->>'catalog_item_id')::uuid,
        coalesce(v_item->>'contract_label', 'Principal'), (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric,
        coalesce((v_item->>'rateable')::boolean, false), v_item->'recurrence'->>'frequency',
        (v_item->'recurrence'->>'interval_days')::int, (v_item->'recurrence'->>'day_of_month')::int,
        coalesce((v_item->'recurrence'->>'start_date')::date, (p_payload->>'competence')::date),
        coalesce(v_item->'recurrence'->>'end_mode', 'none'), (v_item->'recurrence'->>'end_date')::date,
        (v_item->'recurrence'->>'occurrences')::int, coalesce((v_item->'recurrence'->>'variable_amount')::boolean, false),
        (v_item->>'reference_expense_id')::uuid, v_launch_id
      );
    end if;
  end loop;

  if v_item_count = 1 then
    select name_snapshot, description into v_subcategory, v_item_detail
      from public.expense_launch_items where launch_id = v_launch_id limit 1;
  else
    v_subcategory := null;
    v_item_detail := null;
  end if;

  for v_installment in select * from jsonb_array_elements(coalesce(p_payload->'installments', '[]'::jsonb)) loop
    if p_payload->>'kind' = 'salary' then
      v_expense_id := null;
    else
      insert into public.expenses (
        company_id, description, category, subcategory, item_detail, nature, origin, pattern, employee_id, partner_id,
        competence, amount, status, due_date, scheduled_payment_at, party_name, document_ref,
        source_module, source_entity_id, launch_id, installment_number, installment_count, payment_method
      ) values (
        v_company,
        p_payload->>'party_name' || ' · ' || (case when v_item_count > 1 then v_item_count || ' itens' else (select name_snapshot from public.expense_launch_items where launch_id = v_launch_id limit 1) end),
        v_first_category, v_subcategory, v_item_detail, v_nature, p_payload->>'kind', v_pattern, v_first_employee_id, (p_payload->>'partner_id')::uuid,
        (p_payload->>'competence')::date, (v_installment->>'amount')::numeric,
        case when coalesce((p_payload->>'scheduled')::boolean, false) then 'AGENDADO' else 'ABERTO' end,
        (v_installment->>'due_date')::date, (v_installment->>'scheduled_payment_at')::date,
        p_payload->>'party_name', p_payload->>'document_ref',
        'despesas', v_launch_id, v_launch_id,
        (v_installment->>'number')::int, v_installment_count, p_payload->>'payment_method'
      ) returning id into v_expense_id;
    end if;

    insert into public.expense_launch_installments (launch_id, number, amount, due_date, scheduled_payment_at, boleto_code, expense_id)
    values (
      v_launch_id, (v_installment->>'number')::int, (v_installment->>'amount')::numeric,
      (v_installment->>'due_date')::date, (v_installment->>'scheduled_payment_at')::date,
      v_installment->>'boleto_code', v_expense_id
    );
  end loop;

  perform private.record_audit_event('expense.created', v_company, 'expense_launch', v_launch_id::text,
    jsonb_build_object('kind', p_payload->>'kind', 'party_name', p_payload->>'party_name', 'total', v_total));

  return v_launch_id;
end;
$$;

-- 6. Recebimento posterior: confirma a quantidade que efetivamente chegou, uma vez ----------------
create or replace function public.confirm_launch_receipt(p_launch_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  l public.expense_launches;
  i public.expense_launch_items;
  e public.raw_material_entries;
  v_count integer := 0;
begin
  select * into l from public.expense_launches where id = p_launch_id for update;
  if not found then raise exception 'Lançamento não encontrado'; end if;
  if not (select private.has_permission(l.company_id, 'despesas.manage')) then raise exception 'Sem permissão para confirmar recebimento'; end if;

  for i in select * from public.expense_launch_items x where x.launch_id = l.id and x.kind = 'stock' and x.received_at is null order by x.created_at loop
    if i.raw_material_id is not null then
      select * into e from public.raw_material_entries r where r.launch_item_id = i.id and r.status = 'draft' for update;
      if found then
        perform public.confirm_raw_material_entry(e.id);
        update public.expense_launch_items set received_at = now() where id = i.id;
        perform private.refresh_last_purchase('RAW_MATERIAL', i.raw_material_id);
        v_count := v_count + 1;
      end if;
    elsif i.product_id is not null then
      perform private.receive_product_line(i.id);
      v_count := v_count + 1;
    end if;
  end loop;

  update public.expense_launches set received = true where id = l.id;
  perform private.record_audit_event('purchase.receipt_confirmed', l.company_id, 'expense_launch', l.id::text, jsonb_build_object('lines', v_count));
  return v_count;
end;
$$;

-- 7. Devolução ao fornecedor: reduz estoque pela quantidade devolvida e trata o financeiro ----------
create or replace function public.return_launch_items(p_launch_id uuid, p_lines jsonb, p_reason text)
returns table (returned_value numeric, applied_to_open numeric, credit_created numeric)
language plpgsql
security definer
set search_path to ''
as $$
declare
  l public.expense_launches;
  i public.expense_launch_items;
  v_line jsonb;
  v_qty numeric;
  v_value numeric := 0;
  v_remaining numeric;
  v_open_applied numeric := 0;
  v_credit numeric := 0;
  v_stock numeric;
  v_avg numeric;
  v_new_stock numeric;
  v_new_avg numeric;
  v_unit uuid;
  x record;
  v_cut numeric;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Informe o motivo da devolução'; end if;
  select * into l from public.expense_launches where id = p_launch_id for update;
  if not found then raise exception 'Lançamento não encontrado'; end if;
  if not (select private.has_permission(l.company_id, 'despesas.manage')) then raise exception 'Sem permissão para devolver itens'; end if;
  select u.id into v_unit from public.units u where u.company_id = l.company_id and u.status = 'ACTIVE' order by u.created_at limit 1;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line->>'quantity')::numeric;
    select * into i from public.expense_launch_items where id = (v_line->>'launch_item_id')::uuid and launch_id = l.id for update;
    if not found then raise exception 'Item não pertence a este lançamento'; end if;
    if i.received_at is null then raise exception 'Só é possível devolver item já recebido'; end if;
    if i.landed_unit_cost is null then raise exception 'Compra anterior ao novo fluxo: devolução não disponível para %', i.name_snapshot; end if;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantidade inválida'; end if;
    if i.returned_quantity + v_qty > i.quantity then raise exception 'Devolução maior que a quantidade comprada de %', i.name_snapshot; end if;

    if i.raw_material_id is not null then
      select m.current_stock, m.avg_cost into v_stock, v_avg from public.raw_materials m where m.id = i.raw_material_id for update;
      -- a entrada guarda a quantidade em pacotes: a devolução é em unidade de controle
      if v_stock < v_qty then raise exception 'Estoque atual de % é insuficiente para esta devolução', i.name_snapshot; end if;
      v_new_stock := v_stock - v_qty;
      v_new_avg := case when v_new_stock > 0 then greatest(((v_stock * v_avg) - (v_qty * i.landed_unit_cost)) / v_new_stock, 0) else 0 end;
      update public.raw_materials set current_stock = v_new_stock, avg_cost = v_new_avg where id = i.raw_material_id;
      insert into public.raw_material_movements (company_id, unit_id, raw_material_id, variation, origin, reference_id, previous_balance, new_balance, observation)
      values (l.company_id, coalesce(v_unit, private.default_unit_id()), i.raw_material_id, -v_qty, 'purchase_return', l.id, v_stock, v_new_stock, 'Devolução ao fornecedor — ' || p_reason);
    elsif i.product_id is not null then
      select p.current_stock, p.avg_cost into v_stock, v_avg from public.products p where p.id = i.product_id for update;
      if v_stock < v_qty then raise exception 'Estoque atual de % é insuficiente para esta devolução', i.name_snapshot; end if;
      v_new_stock := v_stock - v_qty;
      v_new_avg := case when v_new_stock > 0 then greatest(((v_stock * v_avg) - (v_qty * i.landed_unit_cost)) / v_new_stock, 0) else 0 end;
      update public.products set current_stock = v_new_stock, avg_cost = v_new_avg where id = i.product_id;
      insert into public.stock_movements (product_id, variation, origin, reference_id, previous_balance, new_balance, observation, company_id, unit_id)
      values (i.product_id, -v_qty, 'purchase_return', l.id, v_stock, v_new_stock, 'Devolução ao fornecedor — ' || p_reason, l.company_id, v_unit);
    else
      raise exception 'Item sem vínculo de estoque';
    end if;

    update public.expense_launch_items set returned_quantity = returned_quantity + v_qty where id = i.id;
    v_value := v_value + (v_qty * i.unit_price);
    if i.raw_material_id is not null then perform private.refresh_last_purchase('RAW_MATERIAL', i.raw_material_id);
    else perform private.refresh_last_purchase('PRODUCT', i.product_id); end if;
  end loop;

  -- Financeiro: reduz o que ainda está em aberto (das últimas parcelas para as primeiras); o excedente vira crédito do fornecedor.
  v_remaining := v_value;
  for x in
    select e.id, e.amount from public.expense_launch_installments ins
    join public.expenses e on e.id = ins.expense_id
    where ins.launch_id = l.id and e.status in ('ABERTO', 'AGENDADO', 'ATRASADO')
    order by ins.number desc
    for update of e
  loop
    exit when v_remaining <= 0;
    v_cut := least(x.amount, v_remaining);
    update public.expenses set amount = amount - v_cut where id = x.id;
    update public.expense_launch_installments set amount = amount - v_cut where expense_id = x.id;
    v_remaining := v_remaining - v_cut;
    v_open_applied := v_open_applied + v_cut;
  end loop;

  if v_remaining > 0 then
    insert into public.supplier_credits (company_id, launch_id, supplier_id, amount, reason)
    values (l.company_id, l.id, l.supplier_id, round(v_remaining, 2), p_reason);
    v_credit := round(v_remaining, 2);
  end if;

  perform private.record_audit_event('purchase.items_returned', l.company_id, 'expense_launch', l.id::text,
    jsonb_build_object('value', v_value, 'applied_to_open', v_open_applied, 'credit', v_credit, 'reason', p_reason));
  return query select round(v_value, 2), round(v_open_applied, 2), v_credit;
end;
$$;

-- 8. Busca do catálogo único para a compra (nome, SKU, EAN/GTIN, código do fornecedor) ---------------
create or replace function public.purchase_catalog(p_supplier_id uuid default null)
returns table (
  item_type text, item_id uuid, sku text, name text, brand text, category_id text, category_name text, unit text,
  usage text, gtin text, supplier_code text, current_stock numeric, avg_cost numeric,
  last_purchase_cost numeric, last_purchase_date date, sale_price numeric, target_margin_pct numeric, image_url text, is_active boolean
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
         m.last_purchase_cost, m.last_purchase_date, null::numeric, null::numeric, m.image_url, m.is_active
  from public.raw_materials m
  left join public.item_supplier_codes sc on sc.company_id = v_company and sc.supplier_id = p_supplier_id and sc.item_type = 'RAW_MATERIAL' and sc.item_id = m.id
  where m.company_id = v_company and m.is_active
  union all
  select 'PRODUCT'::text, p.id, p.code, p.name, p.brand, p.category_id::text,
         coalesce((select c.name from public.categories c where c.id = p.category_id), ''), 'un'::text,
         case when p.nature = 'RESALE' then 'RESALE' else 'MANUFACTURED' end, p.gtin, sc.code, p.current_stock::numeric, p.avg_cost::numeric,
         p.last_purchase_cost, p.last_purchase_date, p.unit_price::numeric, p.target_margin_pct::numeric, p.image_url, p.is_active
  from public.products p
  left join public.item_supplier_codes sc on sc.company_id = v_company and sc.supplier_id = p_supplier_id and sc.item_type = 'PRODUCT' and sc.item_id = p.id
  where p.company_id = v_company and p.is_active and p.nature = 'RESALE'
  order by 4;
end;
$$;

-- 9. Razão: origens novas de compra e devolução ----------------------------------------------
create or replace view public.stock_ledger with (security_invoker = true) as
  select
    'sm:' || m.id::text as ledger_id, m.company_id, m.unit_id,
    'PRODUCT'::text as item_type, m.product_id as item_id,
    case
      when m.origin = 'entry' then 'ENTRY'
      when m.origin = 'purchase_entry' then 'PURCHASE_ENTRY'
      when m.origin = 'purchase_return' then 'PURCHASE_RETURN'
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
    case when a.origin = 'purchase_return' then 'PURCHASE_RETURN' else 'INVENTORY_ADJUSTMENT' end,
    a.variation, a.previous_balance, a.new_balance,
    a.origin, a.reference_id, a.observation, a.responsible_id, a.created_at, null
  from public.raw_material_movements a;

revoke all on function public.save_purchase_draft(uuid, integer, text, text, jsonb) from public, anon;
revoke all on function public.close_purchase_draft(uuid, text) from public, anon;
revoke all on function public.confirm_launch_receipt(uuid) from public, anon;
revoke all on function public.return_launch_items(uuid, jsonb, text) from public, anon;
revoke all on function public.purchase_catalog(uuid) from public, anon;
grant execute on function public.save_purchase_draft(uuid, integer, text, text, jsonb) to authenticated;
grant execute on function public.close_purchase_draft(uuid, text) to authenticated;
grant execute on function public.confirm_launch_receipt(uuid) to authenticated;
grant execute on function public.return_launch_items(uuid, jsonb, text) to authenticated;
grant execute on function public.purchase_catalog(uuid) to authenticated;
