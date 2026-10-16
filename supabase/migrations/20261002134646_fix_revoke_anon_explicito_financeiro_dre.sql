-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002134646 · md5 normalizado 4705ae74d6d52253521d11efc7c4f6c7 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

revoke execute on function public.get_financeiro_geral_summary(uuid, text) from anon, public;
revoke execute on function public.get_dre_monthly(uuid) from anon, public;
grant execute on function public.get_financeiro_geral_summary(uuid, text) to authenticated;
grant execute on function public.get_dre_monthly(uuid) to authenticated;
;
