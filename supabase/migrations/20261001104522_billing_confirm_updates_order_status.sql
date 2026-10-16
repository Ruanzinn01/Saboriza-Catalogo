-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001104522 · md5 normalizado a1f327bd79e66f671c7e135e7fa10171 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.oris360_billing_confirm(p_order_id uuid, p_payment_methods jsonb, p_fiscal_choice text, p_idempotency_key text)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_customer_id uuid;
  v_order_total numeric;
  v_billing_id uuid;
  v_financed_part numeric := 0;
  v_pm jsonb;
  v_pm_id uuid;
  v_inst jsonb;
  v_inst_id uuid;
  v_receivable_id uuid;
begin
  select company_id, customer_id, total_amount into v_company_id, v_customer_id, v_order_total
  from public.orders where id = p_order_id;

  if v_company_id is null or not private.has_permission(v_company_id, 'billing.invoice_order') then
    raise exception 'sem permissao para faturar este pedido';
  end if;

  select id into v_billing_id from public.billings where idempotency_key = p_idempotency_key;
  if v_billing_id is not null then
    return v_billing_id;
  end if;

  if exists (select 1 from public.billings where order_id = p_order_id and status = 'CONFIRMADO') then
    raise exception 'pedido ja foi faturado';
  end if;

  select coalesce(sum((pm->>'amount')::numeric), 0) into v_financed_part
  from jsonb_array_elements(p_payment_methods) pm
  where coalesce((pm->>'generates_credit')::boolean, false);

  insert into public.billings (order_id, customer_id, status, fiscal_choice, idempotency_key)
  values (p_order_id, v_customer_id, 'CONFIRMADO', p_fiscal_choice, p_idempotency_key)
  returning id into v_billing_id;

  insert into public.billing_credit_snapshots (
    billing_id, open_receivables, overdue_amount, overdue_count, commitments,
    credit_limit, current_exposure, financed_part, projected_exposure, available_after, excess, fingerprint
  )
  select
    v_billing_id,
    (s->>'open_receivables')::numeric, (s->>'overdue_amount')::numeric, (s->>'overdue_count')::int, (s->>'commitments')::numeric,
    (s->>'credit_limit')::numeric, (s->>'current_exposure')::numeric, (s->>'financed_part')::numeric,
    (s->>'projected_exposure')::numeric, (s->>'available_after')::numeric, (s->>'excess')::numeric, s->>'fingerprint'
  from (select private.compute_credit_snapshot(v_customer_id, v_financed_part) as s) x;

  for v_pm in select * from jsonb_array_elements(p_payment_methods)
  loop
    insert into public.payment_methods (billing_id, type, amount, condition, generates_credit, fees, auto_messages)
    values (
      v_billing_id,
      v_pm->>'type',
      (v_pm->>'amount')::numeric,
      v_pm->>'condition',
      coalesce((v_pm->>'generates_credit')::boolean, false),
      coalesce(v_pm->'fees', '{}'::jsonb),
      coalesce((v_pm->>'auto_messages')::boolean, true)
    )
    returning id into v_pm_id;

    for v_inst in select * from jsonb_array_elements(coalesce(v_pm->'installments', '[]'::jsonb))
    loop
      insert into public.installments (payment_method_id, number, days, due_date, amount)
      values (
        v_pm_id,
        (v_inst->>'number')::int,
        coalesce((v_inst->>'days')::int, 0),
        (v_inst->>'due_date')::date,
        (v_inst->>'amount')::numeric
      )
      returning id into v_inst_id;

      insert into public.receivables (customer_id, billing_id, installment_id, amount, due_date, status)
      values (v_customer_id, v_billing_id, v_inst_id, (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date, 'ABERTO')
      returning id into v_receivable_id;

      if v_pm->>'type' in ('BOLETO', 'PIX') then
        insert into public.charges (installment_id, provider, idempotency_key, status)
        values (v_inst_id, 'ASAAS', p_idempotency_key || ':' || v_inst_id::text, 'PENDENTE');
      end if;
    end loop;
  end loop;

  insert into public.fiscal_documents (billing_id, status)
  values (v_billing_id, case when p_fiscal_choice = 'EMITIR_NFE' then 'PROCESSANDO' else 'NAO_EMITIDO' end);

  update public.billings set confirmed_by = auth.uid(), confirmed_at = now() where id = v_billing_id;

  update public.orders set status = 'COMPLETED' where id = p_order_id;

  return v_billing_id;
end;
$function$;
;
