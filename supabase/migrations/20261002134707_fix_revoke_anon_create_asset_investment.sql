-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002134707 · md5 normalizado b6a6b97b91642c0990c19cd05c5d7c85 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

revoke execute on function public.create_asset_investment(text, text, numeric, date, date, text, text) from anon, public;
grant execute on function public.create_asset_investment(text, text, numeric, date, date, text, text) to authenticated;
;
