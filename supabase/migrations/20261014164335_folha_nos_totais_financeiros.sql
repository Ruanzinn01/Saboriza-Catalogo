-- A folha salarial vive em salary_obligations/salary_advances (nunca em expenses). Financeiro Geral, Painel do
-- Proprietário e DRE liam só expenses e deixavam a folha fora dos totais. Aqui a folha entra pelas fontes originais,
-- sem criar lançamento duplicado: saída de caixa = vale pago e não estornado; a pagar = saldo da obrigação.

create or replace function private.salary_balances(p_company_id uuid)
returns table (obligation_id uuid, competence date, due_date date, base_salary numeric, paid numeric, remaining numeric)
language sql
stable
security definer
set search_path to ''
as $$
  select o.id, o.competence, o.due_date, o.base_salary, p.paid, o.base_salary - p.paid
  from public.salary_obligations o
  cross join lateral (
    select coalesce(sum(a.amount), 0) as paid
    from public.salary_advances a
    where a.salary_obligation_id = o.id
      and a.status = 'PAGO'
      and not exists (select 1 from public.salary_advances r where r.reversed_advance_id = a.id)
  ) p
  where o.company_id = p_company_id
$$;

revoke all on function private.salary_balances(uuid) from public, anon, authenticated;

create or replace function public.get_financeiro_geral_summary(p_company_id uuid, p_period text default 'month')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_from date;
  v_to date;
  v_entradas_vendas numeric;
  v_entradas_outras numeric;
  v_entradas_aportes numeric;
  v_entradas_total numeric;
  v_saidas_operacionais numeric;
  v_saidas_salario numeric;
  v_saidas_investimentos numeric;
  v_saidas_retiradas numeric;
  v_saidas_total numeric;
  v_a_receber numeric;
  v_a_pagar numeric;
  v_despesas_atrasadas_qtd int;
  v_despesas_atrasadas_valor numeric;
  v_folha_atrasada_qtd int;
  v_folha_atrasada_valor numeric;
  v_receber_vencido_qtd int;
  v_receber_vencido_valor numeric;
  v_estoque_criticos int;
  v_composicao jsonb;
  v_resultado jsonb;
begin
  if not private.has_permission(p_company_id, 'financeiro_geral.read') then
    raise exception 'sem permissao para ver o financeiro geral';
  end if;
  if p_period not in ('month', '3m', '6m', 'year') then
    raise exception 'periodo invalido: %', p_period;
  end if;

  v_to := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_from := case p_period
    when 'month' then date_trunc('month', now())::date
    when '3m' then date_trunc('month', now() - interval '2 months')::date
    when '6m' then date_trunc('month', now() - interval '5 months')::date
    when 'year' then date_trunc('year', now())::date
  end;

  select coalesce(sum(amount), 0) into v_entradas_vendas
    from public.receivables where company_id = p_company_id and status = 'PAGO' and paid_at::date between v_from and v_to;

  select coalesce(sum(rr.principal), 0) into v_entradas_outras
    from public.revenue_receivables rr join public.revenues rv on rv.id = rr.revenue_id
    where rv.company_id = p_company_id and rr.status = 'RECEBIDO' and rr.effective_date between v_from and v_to;

  select coalesce(sum(amount), 0) into v_entradas_aportes
    from public.partner_contributions
    where company_id = p_company_id and status = 'REALIZADO'
      and id not in (select reversed_contribution_id from public.partner_contributions where reversed_contribution_id is not null)
      and coalesce(realized_date, created_at::date) between v_from and v_to;

  v_entradas_total := v_entradas_vendas + v_entradas_outras + v_entradas_aportes;

  -- Folha: a saída de caixa é o vale efetivamente pago (e não estornado), na data do pagamento.
  select coalesce(sum(a.amount), 0) into v_saidas_salario
    from public.salary_advances a
    where a.company_id = p_company_id and a.status = 'PAGO' and a.paid_at::date between v_from and v_to
      and not exists (select 1 from public.salary_advances r where r.reversed_advance_id = a.id);

  select coalesce(sum(paid_amount), 0) + v_saidas_salario into v_saidas_operacionais
    from public.expenses
    where company_id = p_company_id and nature <> 'INVESTIMENTO' and origin <> 'partner' and paid_amount > 0
      and paid_at::date between v_from and v_to;

  select coalesce(sum(paid_amount), 0) into v_saidas_investimentos
    from public.expenses
    where company_id = p_company_id and nature = 'INVESTIMENTO' and paid_amount > 0 and paid_at::date between v_from and v_to;

  select coalesce(sum(paid_amount), 0) into v_saidas_retiradas
    from public.expenses
    where company_id = p_company_id and origin = 'partner' and paid_amount > 0 and paid_at::date between v_from and v_to;

  v_saidas_total := v_saidas_operacionais + v_saidas_investimentos + v_saidas_retiradas;

  select coalesce(sum(amount), 0) into v_a_receber
    from public.receivables where company_id = p_company_id and status = 'ABERTO';

  select coalesce(sum(amount - coalesce(paid_amount, 0)), 0) + coalesce((select sum(greatest(b.remaining, 0)) from private.salary_balances(p_company_id) b), 0)
    into v_a_pagar
    from public.expenses where company_id = p_company_id and status in ('ABERTO', 'AGENDADO', 'ATRASADO');

  select count(*), coalesce(sum(amount - coalesce(paid_amount, 0)), 0) into v_despesas_atrasadas_qtd, v_despesas_atrasadas_valor
    from public.expenses where company_id = p_company_id and status = 'ATRASADO';

  select count(*), coalesce(sum(b.remaining), 0) into v_folha_atrasada_qtd, v_folha_atrasada_valor
    from private.salary_balances(p_company_id) b where b.remaining > 0 and b.due_date < current_date;
  v_despesas_atrasadas_qtd := v_despesas_atrasadas_qtd + v_folha_atrasada_qtd;
  v_despesas_atrasadas_valor := v_despesas_atrasadas_valor + v_folha_atrasada_valor;

  select count(*), coalesce(sum(amount), 0) into v_receber_vencido_qtd, v_receber_vencido_valor
    from public.receivables where company_id = p_company_id and status = 'VENCIDO';

  select count(*) into v_estoque_criticos
    from public.products where company_id = p_company_id and is_active and current_stock <= min_stock;

  select coalesce(jsonb_agg(jsonb_build_object('origin', origin, 'total', total) order by total desc), '[]'::jsonb) into v_composicao
  from (
    select origin, sum(paid_amount) as total
      from public.expenses
      where company_id = p_company_id and paid_amount > 0 and paid_at::date between v_from and v_to
      group by origin
    union all
    select 'salary', v_saidas_salario where v_saidas_salario > 0
  ) t;

  select coalesce(jsonb_build_object(
    'month', d.month,
    'net_revenue', d.net_revenue,
    'cmv_cpv', d.cmv_cpv,
    'gross_profit', d.gross_profit,
    'gross_margin', case when d.net_revenue > 0 then round(d.gross_profit / d.net_revenue * 100, 2) else null end,
    'operating_expenses', d.operating_expenses,
    'financial_charges', d.financial_charges,
    'management_net_result', d.managerial_operating_result,
    'management_net_margin', case when d.net_revenue > 0 then round(d.managerial_operating_result / d.net_revenue * 100, 2) else null end
  ), jsonb_build_object('disponivel', false, 'motivo', 'DRE ainda sem apuração para esta competência')) into v_resultado
  from public.get_dre_monthly(p_company_id) d where d.month = date_trunc('month', now())::date;

  return jsonb_build_object(
    'periodo', p_period,
    'periodo_de', v_from,
    'periodo_ate', v_to,
    'saldo_disponivel', jsonb_build_object('disponivel', false, 'motivo', 'sem motor de caixa/conta bancaria ainda'),
    'projecao_caixa', jsonb_build_object('disponivel', false, 'motivo', 'depende do saldo disponivel, ainda sem motor de caixa'),
    'entradas_mes', jsonb_build_object('total', v_entradas_total, 'vendas', v_entradas_vendas, 'outras_receitas', v_entradas_outras, 'aportes', v_entradas_aportes),
    'saidas_mes', jsonb_build_object('total', v_saidas_total, 'operacionais', v_saidas_operacionais, 'investimentos', v_saidas_investimentos, 'retiradas_socios', v_saidas_retiradas),
    'composicao_saidas', v_composicao,
    'resultado_empresa', v_resultado,
    'a_receber', v_a_receber,
    'a_pagar', v_a_pagar,
    'central_atencao', jsonb_build_object(
      'despesas_atrasadas', jsonb_build_object('quantidade', v_despesas_atrasadas_qtd, 'valor', v_despesas_atrasadas_valor),
      'recebiveis_vencidos', jsonb_build_object('quantidade', v_receber_vencido_qtd, 'valor', v_receber_vencido_valor),
      'estoque_criticos', v_estoque_criticos
    ),
    'gerado_em', now()
  );
end;
$function$;

create or replace function public.get_owner_panel_summary(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_a_receber numeric;
  v_a_pagar numeric;
  v_resultado_mes numeric;
  v_resultado_month date;
  v_ativos_monitorados int;
  v_estoque_criticos int;
  v_aportes_mes numeric;
begin
  if not private.has_permission(p_company_id, 'painel_proprietario.read') then
    raise exception 'sem permissao para ver o painel do proprietario';
  end if;

  select coalesce(sum(amount), 0) into v_a_receber
    from public.receivables where company_id = p_company_id and status = 'ABERTO';

  select coalesce(sum(amount - coalesce(paid_amount, 0)), 0) + coalesce((select sum(greatest(b.remaining, 0)) from private.salary_balances(p_company_id) b), 0)
    into v_a_pagar
    from public.expenses where company_id = p_company_id and status in ('ABERTO', 'AGENDADO', 'ATRASADO');

  select d.managerial_operating_result, d.month into v_resultado_mes, v_resultado_month
    from public.get_dre_monthly(p_company_id) d
    order by d.month desc
    limit 1;

  select count(*) into v_ativos_monitorados
    from public.asset_units where company_id = p_company_id and status = 'ATIVO';

  select count(*) into v_estoque_criticos
    from public.products where company_id = p_company_id and is_active and current_stock <= min_stock;

  select coalesce(sum(amount), 0) into v_aportes_mes
    from public.partner_contributions
    where company_id = p_company_id and status = 'REALIZADO'
      and id not in (select reversed_contribution_id from public.partner_contributions where reversed_contribution_id is not null)
      and date_trunc('month', coalesce(realized_date, created_at::date)) = date_trunc('month', now());

  return jsonb_build_object(
    'saldo_disponivel', jsonb_build_object('disponivel', false, 'motivo', 'sem motor de caixa ainda'),
    'projecao_caixa', jsonb_build_object('disponivel', false, 'motivo', 'sem motor de projecao de caixa ainda'),
    'a_receber', v_a_receber,
    'a_pagar', v_a_pagar,
    'resultado_mes', jsonb_build_object('disponivel', v_resultado_mes is not null, 'valor', v_resultado_mes, 'mes', v_resultado_month),
    'ativos_monitorados', v_ativos_monitorados,
    'estoque_criticos', v_estoque_criticos,
    'aportes_mes', v_aportes_mes,
    'gerado_em', now()
  );
end;
$function$;

-- DRE: o status da obrigação nunca vira PAGO (o saldo é derivado dos vales pagos), então o filtro antigo somava zero.
-- A folha entra no mês da competência quando a obrigação está quitada, no mesmo critério das demais despesas (só pagas).
create or replace function public.get_dre_monthly(p_company_id uuid)
returns table (month date, gross_revenue numeric, deductions numeric, other_revenue numeric, net_revenue numeric, cmv_cpv numeric,
               gross_profit numeric, operating_expenses numeric, financial_charges numeric, managerial_operating_result numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not private.has_permission(p_company_id, 'dre.read') then
    raise exception 'permission denied for dre.read';
  end if;

  return query
  with revenue_months as (
    select o.company_id, date_trunc('month', b.confirmed_at)::date as mth, sum(o.total_amount) as gross_revenue, sum(o.discount_amount) as deductions
    from billings b join orders o on o.id = b.order_id
    where b.status = 'CONFIRMADO' and o.company_id = p_company_id
    group by o.company_id, date_trunc('month', b.confirmed_at)
  ), other_revenue_months as (
    select rv.company_id, date_trunc('month', rr.effective_date)::date as mth, sum(rr.principal) as other_revenue
    from revenue_receivables rr join revenues rv on rv.id = rr.revenue_id
    where rr.status = 'RECEBIDO' and rv.company_id = p_company_id
    group by rv.company_id, date_trunc('month', rr.effective_date)
  ), expense_months as (
    select company_id, date_trunc('month', due_date)::date as mth, sum(amount) filter (where nature <> 'INVESTIMENTO') as operating_expenses
    from expenses
    where status = 'PAGO' and company_id = p_company_id
    group by company_id, date_trunc('month', due_date)
  ), salary_months as (
    select p_company_id as company_id, date_trunc('month', b.competence)::date as mth, sum(b.base_salary) as salary_expenses
    from private.salary_balances(p_company_id) b
    where b.base_salary > 0 and b.remaining <= 0
    group by date_trunc('month', b.competence)
  ), all_months as (
    select company_id, mth from revenue_months
    union select company_id, mth from other_revenue_months
    union select company_id, mth from expense_months
    union select company_id, mth from salary_months
  )
  select m.mth,
    coalesce(rm.gross_revenue, 0),
    coalesce(rm.deductions, 0),
    coalesce(orm.other_revenue, 0),
    (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0)),
    0::numeric,
    (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0)),
    (coalesce(em.operating_expenses, 0) + coalesce(sm.salary_expenses, 0)),
    0::numeric,
    (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0)) - (coalesce(em.operating_expenses, 0) + coalesce(sm.salary_expenses, 0))
  from all_months m
  left join revenue_months rm on rm.company_id = m.company_id and rm.mth = m.mth
  left join other_revenue_months orm on orm.company_id = m.company_id and orm.mth = m.mth
  left join expense_months em on em.company_id = m.company_id and em.mth = m.mth
  left join salary_months sm on sm.company_id = m.company_id and sm.mth = m.mth
  order by m.mth desc;
end;
$function$;
