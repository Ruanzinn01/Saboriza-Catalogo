-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910014639 · md5 normalizado e85342f1a12c6adb97ddacdb8ff85483 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
DROP FUNCTION IF EXISTS public.create_order(text, text, text, jsonb);
