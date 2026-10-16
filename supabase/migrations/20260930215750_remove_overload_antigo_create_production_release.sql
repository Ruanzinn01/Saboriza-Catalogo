-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930215750 · md5 normalizado c837c65604230df0fd76d9395da3d6fd · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
drop function if exists public.create_production_release(uuid, integer, text, text, uuid, text);
