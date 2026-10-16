-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930184539 · md5 normalizado aaa03d30bdb5cc528e85ec58fe577daa · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

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
  values (p_company_id, p_capability_key, p_enabled, 'OVERRIDE', now())
  on conflict (company_id, capability_key)
  do update set enabled = p_enabled, source = 'OVERRIDE', updated_at = now();
end;
$function$;
;
