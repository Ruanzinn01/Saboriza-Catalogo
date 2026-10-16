-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930184524 · md5 normalizado 5192701067930f5e22b9b8963914ab2a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.get_platform_company_entitlements(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'capability_key', e.capability_key, 'enabled', e.enabled,
    'source', e.source, 'starts_at', e.starts_at, 'ends_at', e.ends_at
  ) order by e.capability_key), '[]'::jsonb) into v_result
  from entitlements e
  where e.company_id = p_company_id;

  return v_result;
end;
$function$;

create or replace function public.set_platform_company_entitlement(p_company_id uuid, p_capability_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into entitlements (company_id, capability_key, enabled, source, starts_at)
  values (p_company_id, p_capability_key, p_enabled, 'PLATFORM_ADMIN', now())
  on conflict (company_id, capability_key)
  do update set enabled = p_enabled, source = 'PLATFORM_ADMIN', updated_at = now();
end;
$function$;
;
