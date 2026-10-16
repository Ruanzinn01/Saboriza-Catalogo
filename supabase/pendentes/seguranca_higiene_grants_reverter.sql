-- Reversão de seguranca_higiene_grants.sql: devolve EXECUTE a PUBLIC e anon nas mesmas funções (estado de produção em 2026-10-15).
-- (get_platform_companies e create_production/2 já não tinham acesso anon: não são reabertas)
do $$
declare
  v_nomes text[] := array[
    'create_platform_company','get_platform_company_detail','get_platform_company_entitlements',
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
     where n.nspname = 'public' and p.prokind = 'f' and p.proname = any(v_nomes) and not (p.proname = 'create_production' and p.pronargs = 2)
  loop
    execute format('grant execute on function %s to public, anon', v_fn.assinatura);
  end loop;
end;
$$;
