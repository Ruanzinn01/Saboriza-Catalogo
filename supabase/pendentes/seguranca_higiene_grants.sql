-- HIGIENE DE GRANTS (aditiva em segurança, NÃO APLICADA EM PRODUÇÃO: aguarda aprovação específica).
-- Só remove EXECUTE de PUBLIC e anon (nunca de authenticated/service_role) em funções do schema public que, hoje em produção
-- (consulta somente leitura em 2026-10-15), estão abertas ao papel anon sem necessidade:
--   A) funções da plataforma (exigem platform_admins por dentro);
--   B) RPCs administrativas que checam permissão por dentro (a superfície anon é inútil);
--   C) RPCs SECURITY DEFINER sem checagem alguma, usadas só por sessão autenticada (admin/operador logado).
-- Fora do escopo (exigem decisão, ver docs/homologacao/DECISOES_PENDENTES.md): corpo sem checagem de empresa/permissão.
-- create_order permanece aberta ao anon: é o checkout público. Reversão: seguranca_higiene_grants_reverter.sql
do $$
declare
  v_nomes text[] := array[
    'create_platform_company','get_platform_companies','get_platform_company_detail','get_platform_company_entitlements',
    'platform_bootstrap_company_owner','set_platform_company_entitlement','set_platform_company_status',
    'get_pulso_today','get_owner_panel_summary','get_sales_commissions_report','set_monthly_close_automation',
    'oris360_apurar_dia','oris360_apurar_dia_detalhado','oris360_apurar_mes','oris360_billing_confirm','oris360_billing_context',
    'oris360_billing_quote','oris360_fechar_competencia_ponto','oris360_list_company_members','oris360_list_roles',
    'oris360_resolver_banco_horas','oris360_time_bank_balance',
    'confirm_production_release','create_production','reverse_production','update_order_items'
  ];
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.proname = any(v_nomes)
  loop
    execute format('revoke execute on function %s from public, anon', v_fn.assinatura);
    execute format('grant execute on function %s to authenticated, service_role', v_fn.assinatura);
  end loop;
end;
$$;
