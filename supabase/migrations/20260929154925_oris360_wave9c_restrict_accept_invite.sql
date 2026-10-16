-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929154925 · md5 normalizado e7b0e0c282d767e8d376f5d16df76fc6 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

revoke execute on function public.oris360_accept_invite() from anon;
revoke execute on function public.oris360_accept_invite() from public;
grant execute on function public.oris360_accept_invite() to authenticated;
;
