# Higiene de grants (NÃO APLICADA)

Arquivos: `supabase/pendentes/seguranca_higiene_grants.sql`, `seguranca_higiene_grants_reverter.sql`, `testes_seguranca_higiene_grants.mjs`.
Levantamento: produção só com SELECT (`pg_proc`/`aclexplode`) em 2026-10-15; a trilha reconstruída em PGlite tem a MESMA lista de funções com EXECUTE para anon (26 alvos).

## Achados
A) Plataforma com anon EXECUTE (checam `platform_admins` por dentro; anon já é barrado no corpo, mas a superfície é inútil): create_platform_company, get_platform_company_detail, get_platform_company_entitlements, platform_bootstrap_company_owner, set_platform_company_entitlement, set_platform_company_status.
B) RPCs administrativas com anon EXECUTE que checam permissão por dentro: get_pulso_today, get_owner_panel_summary, get_sales_commissions_report, set_monthly_close_automation e 10 oris360_* (apurar_dia/detalhado/mes, billing_confirm/context/quote, fechar_competencia_ponto, list_company_members, list_roles, resolver_banco_horas, time_bank_balance).
C) SEM checagem alguma no corpo e com anon EXECUTE (SECURITY DEFINER, ignoram RLS): update_order_items, reverse_production, create_production (3 e 4 args), confirm_production_release (usa `default_company_id`). A migration 20260930184746 já tentava revogar anon do bloco de produção, mas recriações posteriores reabriram. Uso real no front: só `confirm_production_release` (sessão de operador logado) e `update_order_items` (editor admin logado); create/reverse_production não são chamadas em `src/`.
`create_order` fica aberta ao anon de propósito (checkout público).

## O que a migration faz
Remove EXECUTE de PUBLIC e anon desses nomes (todas as sobrecargas) e reafirma EXECUTE a authenticated e service_role. Não altera corpo de função.
Testes PGlite: 16 OK, 0 falhas (nenhum alvo aberto ao anon; authenticated/service_role mantidos; nada fora do escopo mudou; anon recebe 42501; authenticated chega ao corpo; idempotente; reversão restaura anon/auth/service_role).

## RPCs abertas a qualquer membro/autenticado (fora desta migration, precisam de decisão: mudam corpo)
- Só `is_active_company_member`, sem permissão: update_employee_salary e resolve_salary_base (cobertas pela fase 2 de salário), inventory_begin_count, inventory_register_count, inventory_session_items, purchase_catalog, stock_integration_status, stock_lots, stock_position.
- DEFINER sem NENHUMA checagem de empresa/permissão e executáveis por authenticated (cross-tenant): adjust_stock, confirm_raw_material_entry, create_stock_entry, floor_advance_quantity, floor_assume_execution, floor_complete_execution, create_production, reverse_production, update_order_items. Ver DECISOES_PENDENTES.md.
