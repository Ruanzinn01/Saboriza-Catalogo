-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260919004226 · md5 normalizado 41ea27594b62c99d8d53353ab95a73b6 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

revoke execute on function public.handle_order_completed() from public;
revoke execute on function public.handle_order_completed() from anon;
revoke execute on function public.handle_order_completed() from authenticated;
;
