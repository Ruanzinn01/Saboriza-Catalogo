-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002134612 · md5 normalizado c4c1cd3770e5f116bc6159b8774d7901 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

revoke execute on function public.get_financeiro_geral_summary(uuid, text) from public;
grant execute on function public.get_financeiro_geral_summary(uuid, text) to authenticated;

revoke execute on function public.get_dre_monthly(uuid) from public;
grant execute on function public.get_dre_monthly(uuid) to authenticated;
;
