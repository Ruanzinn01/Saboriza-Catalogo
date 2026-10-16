-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001001326 · md5 normalizado 860bc340cfee3fed9d093721d7ca2da7 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
revoke execute on function public.get_platform_companies() from anon, public;
grant execute on function public.get_platform_companies() to authenticated;

revoke execute on function public.handle_order_cancelled_reversal() from anon, public;
revoke execute on function public.handle_separation_finished() from anon, public;
