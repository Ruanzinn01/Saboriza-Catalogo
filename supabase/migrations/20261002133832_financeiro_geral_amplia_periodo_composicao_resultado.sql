-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002133832 · md5 normalizado 297d109f03f8739bbe0aaf24578998e5 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Amplia o Financeiro Geral (RFC Financeiro Geral §3/§6/§8): filtro global de período sincronizado,
-- composição das saídas por origem (consumindo expenses.origin já criado pelo pacote Despesas),
-- retiradas de sócio, e Resultado da Empresa ligado ao DRE já existente (sem duplicar cálculo).
-- saldo_disponivel/projecao_caixa continuam indisponíveis — motor de caixa fica fora desta rodada (decisão registrada).
create or replace function public.get_financeiro_geral_summary(p_company_id uuid, p_period text default 'month')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date;
  v_to date;
  v_entradas_vendas numeric;
  v_entradas_outras numeric;
  v_entradas_aportes numeric;
  v_entradas_total numeric;
  v_saidas_operacionais numeric;
  v_saidas_investimentos numeric;
  v_saidas_retiradas numeric;
  v_saidas_total numeric;
  v_a_receber numeric;
  v_a_pagar numeric;
  v_despesas_atrasadas_qtd int;
  v_despesas_atrasadas_valor numeric;
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
  from public.receivables
  where company_id = p_company_id and status = 'PAGO'
    and paid_at::date between v_from and v_to;

  select coalesce(sum(rr.principal), 0) into v_entradas_outras
  from public.revenue_receivables rr
  join public.revenues rv on rv.id = rr.revenue_id
  where rv.company_id = p_company_id and rr.status = 'RECEBIDO'
    and rr.effective_date between v_from and v_to;

  select coalesce(sum(amount), 0) into v_entradas_aportes
  from public.partner_contributions
  where company_id = p_company_id and status = 'REALIZADO'
    and id not in (select reversed_contribution_id from public.partner_contributions where reversed_contribution_id is not null)
    and coalesce(realized_date, created_at::date) between v_from and v_to;

  v_entradas_total := v_entradas_vendas + v_entradas_outras + v_entradas_aportes;

  select coalesce(sum(paid_amount), 0) into v_saidas_operacionais
  from public.expenses
  where company_id = p_company_id and nature <> 'INVESTIMENTO' and origin <> 'partner' and paid_amount > 0
    and paid_at::date between v_from and v_to;

  select coalesce(sum(paid_amount), 0) into v_saidas_investimentos
  from public.expenses
  where company_id = p_company_id and nature = 'INVESTIMENTO' and paid_amount > 0
    and paid_at::date between v_from and v_to;

  select coalesce(sum(paid_amount), 0) into v_saidas_retiradas
  from public.expenses
  where company_id = p_company_id and origin = 'partner' and paid_amount > 0
    and paid_at::date between v_from and v_to;

  v_saidas_total := v_saidas_operacionais + v_saidas_investimentos + v_saidas_retiradas;

  select coalesce(sum(amount), 0) into v_a_receber
  from public.receivables where company_id = p_company_id and status = 'ABERTO';

  select coalesce(sum(amount - coalesce(paid_amount, 0)), 0) into v_a_pagar
  from public.expenses where company_id = p_company_id and status in ('ABERTO', 'AGENDADO', 'ATRASADO');

  select count(*), coalesce(sum(amount - coalesce(paid_amount, 0)), 0) into v_despesas_atrasadas_qtd, v_despesas_atrasadas_valor
  from public.expenses where company_id = p_company_id and status = 'ATRASADO';

  select count(*), coalesce(sum(amount), 0) into v_receber_vencido_qtd, v_receber_vencido_valor
  from public.receivables where company_id = p_company_id and status = 'VENCIDO';

  select count(*) into v_estoque_criticos
  from public.products where company_id = p_company_id and is_active and current_stock <= min_stock;

  -- Composição das saídas por origem, dentro do período filtrado (PRD Financeiro Geral §11/§13)
  select coalesce(jsonb_agg(jsonb_build_object('origin', origin, 'total', total) order by total desc), '[]'::jsonb)
  into v_composicao
  from (
    select origin, sum(paid_amount) as total
    from public.expenses
    where company_id = p_company_id and paid_amount > 0 and paid_at::date between v_from and v_to
    group by origin
  ) t;

  -- Resultado da Empresa: consome o DRE já existente, não recalcula (PRD §4 / RFC §6)
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
  ), jsonb_build_object('disponivel', false, 'motivo', 'DRE ainda sem apuração para esta competência'))
  into v_resultado
  from public.get_dre_monthly(p_company_id) d
  where d.month = date_trunc('month', now())::date;

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
$$;

revoke execute on function public.get_financeiro_geral_summary(uuid, text) from public;
grant execute on function public.get_financeiro_geral_summary(uuid, text) to authenticated;
;
