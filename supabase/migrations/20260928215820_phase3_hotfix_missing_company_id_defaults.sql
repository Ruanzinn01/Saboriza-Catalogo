-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928215820 · md5 normalizado 5ff6cff6a4df253b2697e32b04559843 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- CORREÇÃO URGENTE: categories/products/raw_materials/raw_material_categories/suppliers
-- ficaram sem DEFAULT em company_id desde a Onda 1/2 — isso quebrava a criação de
-- registros novos nessas 5 telas (já em uso em produção) porque o formulário não
-- envia company_id explicitamente. Nenhuma outra tabela tem esse problema (auditado
-- via information_schema.columns contra todas as tabelas com coluna company_id).
alter table public.categories alter column company_id set default private.default_company_id();
alter table public.products alter column company_id set default private.default_company_id();
alter table public.raw_materials alter column company_id set default private.default_company_id();
alter table public.raw_material_categories alter column company_id set default private.default_company_id();
alter table public.suppliers alter column company_id set default private.default_company_id();
alter table public.settings alter column company_id set default private.default_company_id();
