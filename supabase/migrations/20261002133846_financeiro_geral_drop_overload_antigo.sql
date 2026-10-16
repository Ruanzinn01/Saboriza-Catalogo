-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002133846 · md5 normalizado 7c1d58963da456fb0f6f2cea31076c14 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
drop function if exists public.get_financeiro_geral_summary(uuid);
