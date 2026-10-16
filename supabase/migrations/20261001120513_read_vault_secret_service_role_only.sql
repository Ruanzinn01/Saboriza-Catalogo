-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001120513 · md5 normalizado fab458897ae6f42b0153c938bcca6d01 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.read_vault_secret(p_secret_id uuid)
 returns text
 language sql
 security definer
 set search_path to ''
as $function$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id;
$function$;

revoke all on function public.read_vault_secret(uuid) from public, anon, authenticated;
grant execute on function public.read_vault_secret(uuid) to service_role;
;
