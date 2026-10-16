-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261009181836 · md5 normalizado 0c63612ea8fccfcb9b42ce9abbe1fe6d · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

alter table public.salary_obligations add column if not exists due_date date null;

update public.salary_obligations
set due_date = (date_trunc('month', competence) + interval '1 month' + interval '4 days')::date
where due_date is null;

create or replace function public.create_expense_launch(p_payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  v_obligation_id uuid;
  v_rec_id uuid;
  v_item_count int := 0;
  v_subcategory text;
  v_item_detail text;
  v_salary_due_date date;
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

  -- Totais e validação de soma das parcelas
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_items_total := v_items_total + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
  end loop;
  v_total := round((v_items_total + coalesce((p_payload->>'freight')::numeric, 0) - coalesce((p_payload->>'discount')::numeric, 0))::numeric, 2);

  for v_installment in select * from jsonb_array_elements(coalesce(p_payload->'installments', '[]'::jsonb)) loop
    v_installments_total := v_installments_total + (v_installment->>'amount')::numeric;
  end loop;
  if abs(round(v_installments_total::numeric, 2) - v_total) > 0.01 then
    raise exception 'A soma das parcelas (%) não confere com o total do lançamento (%)', v_installments_total, v_total;
  end if;

  -- Vencimento salarial: lançamentos de folha sempre têm 1 parcela (isDirect no frontend)
  if p_payload->>'kind' = 'salary' then
    v_salary_due_date := (p_payload->'installments'->0->>'due_date')::date;
  end if;

  -- Categoria/natureza/padrão agregados (primeira referência disponível, usados nas expenses geradas)
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

  insert into public.expense_launches (
    company_id, kind, party_type, party_name, supplier_id, partner_id, competence,
    document_ref, document_series, document_issue_date, document_access_key, batch, expiry_date,
    freight, discount, total_amount, received, payment_method, payment_condition, scheduled,
    recipient_key, recipient_holder, observations, duplicate_reason, idempotency_key
  ) values (
    v_company, p_payload->>'kind', p_payload->>'party_type', p_payload->>'party_name',
    (p_payload->>'supplier_id')::uuid, (p_payload->>'partner_id')::uuid, (p_payload->>'competence')::date,
    p_payload->>'document_ref', p_payload->>'document_series', (p_payload->>'document_issue_date')::date, p_payload->>'document_access_key',
    p_payload->>'batch', (p_payload->>'expiry_date')::date,
    coalesce((p_payload->>'freight')::numeric, 0), coalesce((p_payload->>'discount')::numeric, 0), v_total,
    coalesce((p_payload->>'received')::boolean, false), p_payload->>'payment_method', p_payload->>'payment_condition',
    coalesce((p_payload->>'scheduled')::boolean, false), p_payload->>'recipient_key', p_payload->>'recipient_holder',
    p_payload->>'observations', p_payload->>'duplicate_reason', v_idempotency
  ) returning id into v_launch_id;

  -- Itens: fato econômico + efeitos por tipo (estoque/patrimônio/salário)
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_item_count := v_item_count + 1;

    insert into public.expense_launch_items (
      launch_id, kind, category_id, raw_material_id, catalog_item_id, employee_id,
      name_snapshot, unit, quantity, unit_price, amount, rateable, contract_label,
      payroll_type, reference_expense_id, description
    ) values (
      v_launch_id, v_item->>'kind', (v_item->>'category_id')::uuid, (v_item->>'raw_material_id')::uuid,
      (v_item->>'catalog_item_id')::uuid, (v_item->>'employee_id')::uuid,
      v_item->>'name_snapshot', coalesce(v_item->>'unit', 'un'), (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, coalesce((v_item->>'rateable')::boolean, false),
      v_item->>'contract_label', v_item->>'payroll_type', (v_item->>'reference_expense_id')::uuid, v_item->>'description'
    );

    -- Insumos: entrada real de estoque (reaproveita o fluxo já existente de Matéria-Prima)
    if v_item->>'kind' = 'stock' and (v_item->>'raw_material_id') is not null then
      insert into public.raw_material_entries (
        raw_material_id, supplier_id, packages_quantity, unit_price, batch, expiry_date, entry_date,
        invoice_number, invoice_series, invoice_issue_date, invoice_access_key
      ) values (
        (v_item->>'raw_material_id')::uuid, (p_payload->>'supplier_id')::uuid,
        (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
        coalesce(p_payload->>'batch', ''), coalesce((p_payload->>'expiry_date')::date, (p_payload->>'competence')::date),
        coalesce((p_payload->>'competence')::date, current_date),
        coalesce(p_payload->>'document_ref', ''), coalesce(p_payload->>'document_series', ''),
        (p_payload->>'document_issue_date')::date, coalesce(p_payload->>'document_access_key', '')
      ) returning id into v_entry_id;

      if coalesce((p_payload->>'received')::boolean, false) then
        perform public.confirm_raw_material_entry(v_entry_id);
      end if;
    end if;

    -- Bens e investimentos: credita o saldo em formação da categoria (RFC Despesas §14)
    if v_item->>'kind' = 'asset' then
      insert into public.investment_formation_ledger (company_id, category_id, direction, amount, competence)
      values (
        v_company,
        coalesce((select name from public.expense_categories where id = (v_item->>'category_id')::uuid), v_item->>'name_snapshot'),
        'credit', (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, (p_payload->>'competence')::date
      );
    end if;

    -- Gestão salarial: apuração (upsert por competência) ou vale.
    -- Única fonte de verdade — NÃO gera linha redundante em `expenses` (ver loop de parcelas abaixo).
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

    -- Recorrência do compromisso (cadastro — geração automática de ocorrências é etapa futura)
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

  -- Subcategoria e descrição livre só ficam não-ambíguas quando há 1 item no lançamento
  if v_item_count = 1 then
    select name_snapshot, description into v_subcategory, v_item_detail
      from public.expense_launch_items where launch_id = v_launch_id limit 1;
  else
    v_subcategory := null;
    v_item_detail := null;
  end if;

  -- Parcelas: cada uma gera 1 despesa (fato financeiro que alimenta a Visão Geral/KPIs).
  -- Exceção: folha salarial já nasceu como fato único em salary_obligations/salary_advances
  -- acima — criar também uma linha em `expenses` duplicaria o compromisso (BUG 01).
  for v_installment in select * from jsonb_array_elements(coalesce(p_payload->'installments', '[]'::jsonb)) loop
    if p_payload->>'kind' = 'salary' then
      v_expense_id := null;
    else
      insert into public.expenses (
        company_id, description, category, subcategory, item_detail, nature, origin, pattern, employee_id, partner_id,
        competence, amount, status, due_date, scheduled_payment_at, party_name, document_ref,
        source_module, source_entity_id, launch_id
      ) values (
        v_company,
        p_payload->>'party_name' || ' · ' || (case when v_item_count > 1 then v_item_count || ' itens' else (select name_snapshot from public.expense_launch_items where launch_id = v_launch_id limit 1) end),
        v_first_category, v_subcategory, v_item_detail, v_nature, p_payload->>'kind', v_pattern, v_first_employee_id, (p_payload->>'partner_id')::uuid,
        (p_payload->>'competence')::date, (v_installment->>'amount')::numeric,
        case when coalesce((p_payload->>'scheduled')::boolean, false) then 'AGENDADO' else 'ABERTO' end,
        (v_installment->>'due_date')::date, (v_installment->>'scheduled_payment_at')::date,
        p_payload->>'party_name', p_payload->>'document_ref',
        'despesas', v_launch_id, v_launch_id
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
$function$;
;
