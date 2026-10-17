-- DEF-07: o inventário não respeitava o escopo de app. Um usuário confinado só ao app Entrega listava itens e
-- iniciava contagem (reproduzido por HTTP real em homologação). Depende de 20261014221500 (private.can_use_app).
-- Não altera a regra de unidade: troca can_access_unit por um helper que exige também o app Separa Confere
-- para usuário confinado. Gestor/admin (não confinados) seguem como antes.
create or replace function private.can_access_inventory_unit(p_company_id uuid, p_unit_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select (select private.can_access_unit(p_company_id, p_unit_id))
     and (select private.can_use_app(p_company_id, 'separa_confere'))
$$;
revoke all on function private.can_access_inventory_unit(uuid, uuid) from public, anon;
grant execute on function private.can_access_inventory_unit(uuid, uuid) to authenticated;

do $$
declare
  f text;
  v_def text;
  v_new text;
begin
  foreach f in array array['inventory_begin_count', 'inventory_register_count', 'inventory_session_items', 'inventory_list_sessions'] loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = f;
    v_new := replace(v_def, 'private.can_access_unit(', 'private.can_access_inventory_unit(');
    if v_new = v_def then
      raise exception 'Função % não contém can_access_unit; revisar a migration', f;
    end if;
    execute v_new;
  end loop;
end $$;
