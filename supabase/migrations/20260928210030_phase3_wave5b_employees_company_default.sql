-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928210030 · md5 normalizado ea453a70b754e0a42c64cace32948993 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.employees alter column company_id set default private.default_company_id();
