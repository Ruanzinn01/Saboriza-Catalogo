-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001182946 · md5 normalizado 9dd615d254a5220a14a54dc592ea2537 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

insert into public.permissions (key, name, description, sensitivity) values
  ('sistema.erros.read', 'Ver Erros do Sistema', 'Ver log de erros client-side capturados da propria empresa', 'NORMAL')
on conflict (key) do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select m.company_id, mr.role_id, 'sistema.erros.read'
from public.memberships m
join public.membership_roles mr on mr.membership_id = m.id
join public.roles r on r.id = mr.role_id and r.name = 'Proprietário'
group by m.company_id, mr.role_id
on conflict do nothing;

create or replace function public.get_client_errors(p_limit integer default 50)
returns setof public.client_errors
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid := private.default_company_id();
begin
  if private.is_platform_admin() then
    return query select * from public.client_errors order by created_at desc limit p_limit;
  end if;

  if v_company is null or not private.has_permission(v_company, 'sistema.erros.read') then
    raise exception 'Sem permissao para ver erros do sistema';
  end if;

  return query select * from public.client_errors where company_id = v_company order by created_at desc limit p_limit;
end;
$$;

revoke execute on function public.get_client_errors(integer) from anon, public;
grant execute on function public.get_client_errors(integer) to authenticated;
;
