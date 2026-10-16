-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928215742 · md5 normalizado ab6b5704ce1f06d7b37316edae12c73a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.urgent_demands alter column company_id set default private.default_company_id();
alter table public.production_diaries alter column company_id set default private.default_company_id();
alter table public.diary_evaluations alter column company_id set default private.default_company_id();
alter table public.diary_occurrences alter column company_id set default private.default_company_id();
alter table public.diary_other_activities alter column company_id set default private.default_company_id();
