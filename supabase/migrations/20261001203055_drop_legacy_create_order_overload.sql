-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001203055 · md5 normalizado 92362277419b4a9e0e1d7b784af8dc4b · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
drop function if exists public.create_order(text, text, text, jsonb, text, text, text, text, text, text, text, text, text, text, uuid);
