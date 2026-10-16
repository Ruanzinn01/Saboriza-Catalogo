-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930184746 · md5 normalizado 9dbe639758eee8dee49563c1f537d15a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
revoke execute on function public.create_production_release(uuid, integer, text, text, uuid, text) from anon;
revoke execute on function public.floor_assume_execution(uuid, uuid) from anon;
revoke execute on function public.floor_advance_quantity(uuid, integer) from anon;
revoke execute on function public.floor_complete_execution(uuid) from anon;
revoke execute on function public.confirm_production_release(uuid, integer, uuid, uuid, text) from anon;
