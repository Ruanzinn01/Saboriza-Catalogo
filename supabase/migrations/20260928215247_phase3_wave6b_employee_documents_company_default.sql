-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928215247 · md5 normalizado 1ca04eb1bb4cc67a10e8b0097e6cd4fd · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.employee_documents alter column company_id set default private.default_company_id();
