-- Correção/devolução de compra: o abatimento considera todas as despesas em aberto da compra (parcelas e cobranças
-- extras de ajuste), começando pelas extras. Antes, uma cobrança extra aberta não era abatida e virava crédito.

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
    select e.id, e.amount into x from public.expenses e
      where e.launch_id = l.id and e.status in ('ABERTO', 'AGENDADO', 'ATRASADO') order by e.installment_number desc nulls first limit 1 for update;
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
      select e.id, e.amount from public.expenses e
      where e.launch_id = l.id and e.status in ('ABERTO', 'AGENDADO', 'ATRASADO') order by e.installment_number desc nulls first for update
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
    select e.id, e.amount from public.expenses e
    where e.launch_id = l.id and e.status in ('ABERTO', 'AGENDADO', 'ATRASADO')
    order by e.installment_number desc nulls first
    for update
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
