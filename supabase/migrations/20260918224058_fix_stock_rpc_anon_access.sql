-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260918224058 · md5 normalizado bee6f5d6c5b576628b60ea7d6f0ca355 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

revoke execute on function public.create_stock_entry(uuid, numeric, text) from public;
revoke execute on function public.create_stock_entry(uuid, numeric, text) from anon;
grant execute on function public.create_stock_entry(uuid, numeric, text) to authenticated;

revoke execute on function public.adjust_stock(uuid, numeric, text) from public;
revoke execute on function public.adjust_stock(uuid, numeric, text) from anon;
grant execute on function public.adjust_stock(uuid, numeric, text) to authenticated;
;
