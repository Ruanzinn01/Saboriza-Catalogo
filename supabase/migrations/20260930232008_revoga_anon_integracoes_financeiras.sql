-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930232008 · md5 normalizado 31a3bfcb7332017beafb64b10ca44344 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
revoke execute on function public.save_integration_credential(text, text, text, text, text) from anon;
revoke execute on function public.remove_integration_credential(text, text) from anon;
