-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001183328 · md5 normalizado 437228dfafc9aa500cd2afec69d7f798 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.platform_bootstrap_company_owner(p_company_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_membership_id uuid;
  v_membership_status text;
  v_role_id uuid;
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from companies where id = p_company_id) then
    raise exception 'empresa não encontrada';
  end if;

  select id, status into v_membership_id, v_membership_status
  from memberships
  where company_id = p_company_id and user_id = auth.uid();

  if v_membership_id is null then
    insert into memberships (company_id, user_id, status)
    values (p_company_id, auth.uid(), 'ACTIVE')
    returning id into v_membership_id;
  elsif v_membership_status <> 'ACTIVE' then
    update memberships set status = 'ACTIVE', ends_at = null where id = v_membership_id;
  end if;

  select id into v_role_id
  from roles
  where company_id = p_company_id and key = 'OWNER'
  limit 1;

  if v_role_id is null then
    insert into roles (company_id, key, name, is_system, status)
    values (p_company_id, 'OWNER', 'Proprietário', true, 'ACTIVE')
    returning id into v_role_id;

    insert into role_permissions (company_id, role_id, permission_key)
    select p_company_id, v_role_id, key from permissions;
  end if;

  if not exists (
    select 1 from membership_roles
    where membership_id = v_membership_id and role_id = v_role_id
  ) then
    insert into membership_roles (company_id, membership_id, role_id)
    values (p_company_id, v_membership_id, v_role_id);
  end if;

  return v_membership_id;
end;
$function$;

grant execute on function public.platform_bootstrap_company_owner(uuid) to authenticated;
;
