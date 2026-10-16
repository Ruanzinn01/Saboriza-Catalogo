-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001092310 · md5 normalizado b316c660d8f7000bc284c9467df3f6fa · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.get_financeiro_geral_summary(p_company_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_entradas_vendas numeric;
  v_entradas_outras numeric;
  v_entradas_aportes numeric;
  v_entradas_total numeric;
  v_saidas_operacionais numeric;
  v_saidas_investimentos numeric;
  v_saidas_total numeric;
  v_a_receber numeric;
  v_a_pagar numeric;
  v_despesas_atrasadas_qtd int;
  v_despesas_atrasadas_valor numeric;
  v_receber_vencido_qtd int;
  v_receber_vencido_valor numeric;
  v_estoque_criticos int;
begin
  if not private.has_permission(p_company_id, 'financeiro_geral.read') then
    raise exception 'sem permissao para ver o financeiro geral';
  end if;

  select coalesce(sum(amount), 0) into v_entradas_vendas
  from public.receivables
  where company_id = p_company_id and status = 'PAGO'
    and date_trunc('month', paid_at) = date_trunc('month', now());

  select coalesce(sum(rr.principal), 0) into v_entradas_outras
  from public.revenue_receivables rr
  join public.revenues rv on rv.id = rr.revenue_id
  where rv.company_id = p_company_id and rr.status = 'RECEBIDO'
    and date_trunc('month', rr.effective_date) = date_trunc('month', now());

  select coalesce(sum(amount), 0) into v_entradas_aportes
  from public.partner_contributions
  where company_id = p_company_id and status = 'REALIZADO'
    and id not in (select reversed_contribution_id from public.partner_contributions where reversed_contribution_id is not null)
    and date_trunc('month', coalesce(realized_date, created_at::date)) = date_trunc('month', now());

  v_entradas_total := v_entradas_vendas + v_entradas_outras + v_entradas_aportes;

  select coalesce(sum(paid_amount), 0) into v_saidas_operacionais
  from public.expenses
  where company_id = p_company_id and nature <> 'INVESTIMENTO' and paid_amount > 0
    and date_trunc('month', paid_at) = date_trunc('month', now());

  select coalesce(sum(paid_amount), 0) into v_saidas_investimentos
  from public.expenses
  where company_id = p_company_id and nature = 'INVESTIMENTO' and paid_amount > 0
    and date_trunc('month', paid_at) = date_trunc('month', now());

  v_saidas_total := v_saidas_operacionais + v_saidas_investimentos;

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

  return jsonb_build_object(
    'saldo_disponivel', jsonb_build_object('disponivel', false, 'motivo', 'sem motor de caixa/conta bancaria ainda'),
    'projecao_caixa', jsonb_build_object('disponivel', false, 'motivo', 'depende do saldo disponivel, ainda sem motor de caixa'),
    'entradas_mes', jsonb_build_object('total', v_entradas_total, 'vendas', v_entradas_vendas, 'outras_receitas', v_entradas_outras, 'aportes', v_entradas_aportes),
    'saidas_mes', jsonb_build_object('total', v_saidas_total, 'operacionais', v_saidas_operacionais, 'investimentos', v_saidas_investimentos),
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

revoke all on function public.get_financeiro_geral_summary(uuid) from public, anon;
grant execute on function public.get_financeiro_geral_summary(uuid) to authenticated;
;
