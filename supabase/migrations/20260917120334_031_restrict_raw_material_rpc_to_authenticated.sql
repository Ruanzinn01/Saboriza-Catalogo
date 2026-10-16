-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260917120334 · md5 normalizado 1b6178234b63d7db92c3481a164aeaeb · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
revoke execute on function public.confirm_raw_material_entry(uuid) from public, anon;
revoke execute on function public.reverse_raw_material_entry(uuid, text) from public, anon;
grant execute on function public.confirm_raw_material_entry(uuid) to authenticated;
grant execute on function public.reverse_raw_material_entry(uuid, text) to authenticated;
