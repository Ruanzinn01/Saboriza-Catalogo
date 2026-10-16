-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001092334 · md5 normalizado 7c97eba97b4391dff2c55a5d3fc543f8 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

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

  select coalesce(sum(amount - coalesce(paid_amount, 0)), 0) into v_a_pagar
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
;
