-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930220614 · md5 normalizado 8a5157de57c94143beaafe4fce8769d4 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
revoke execute on function public.create_production_release(uuid, integer, text, text, uuid, text, uuid) from public;
revoke execute on function public.floor_assume_execution(uuid, uuid) from public;
revoke execute on function public.floor_advance_quantity(uuid, integer) from public;
revoke execute on function public.floor_complete_execution(uuid) from public;
revoke execute on function public.confirm_production_release(uuid, integer, uuid, uuid, text) from public;
revoke execute on function public.publish_production_route(uuid, text[]) from public;

grant execute on function public.create_production_release(uuid, integer, text, text, uuid, text, uuid) to authenticated;
grant execute on function public.floor_assume_execution(uuid, uuid) to authenticated;
grant execute on function public.floor_advance_quantity(uuid, integer) to authenticated;
grant execute on function public.floor_complete_execution(uuid) to authenticated;
grant execute on function public.confirm_production_release(uuid, integer, uuid, uuid, text) to authenticated;
grant execute on function public.publish_production_route(uuid, text[]) to authenticated;
