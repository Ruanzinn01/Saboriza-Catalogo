-- SEGURANÇA DE CPF, RG E TELEFONE DE COLABORADORES — FASE 1 (aditiva). NÃO APLICADA EM PRODUÇÃO NEM EM HOMOLOGAÇÃO.
-- Não muda nenhum comportamento existente: só cria permissões, funções novas e concede as permissões novas a quem hoje
-- já administra a folha. Reversão: seguranca_cpf_rg_telefone_reverter_1.sql
-- Colunas cobertas (employees): cpf, rg, rg_issuer, phone, emergency_phone. A Fase 2 revoga o acesso direto a elas.

-- 1) Permissões novas
insert into public.permissions (key, name, description, sensitivity) values
  ('colaboradores.documentos.read', 'Ver CPF, RG e telefones dos colaboradores',
   'CPF, RG, órgão emissor, telefone e telefone de emergência do colaborador.', 'SENSITIVE'),
  ('colaboradores.documentos.manage', 'Alterar CPF, RG e telefones dos colaboradores',
   'Altera CPF, RG, órgão emissor, telefone e telefone de emergência (auditado, sem gravar o valor inteiro).', 'CRITICAL')
on conflict (key) do nothing;

-- 2) Preserva o acesso de quem já administra a folha (uma única vez, na aplicação; papéis criados depois NÃO recebem)
insert into public.role_permissions (company_id, role_id, permission_key)
select distinct rp.company_id, rp.role_id, 'colaboradores.documentos.read'
from public.role_permissions rp
where rp.permission_key in ('despesas.manage', 'colaboradores.remuneracao.read', 'colaboradores.remuneracao.manage')
on conflict do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select distinct rp.company_id, rp.role_id, 'colaboradores.documentos.manage'
from public.role_permissions rp
where rp.permission_key in ('despesas.manage', 'colaboradores.remuneracao.manage')
on conflict do nothing;

-- 3) Quem pode ler
create or replace function private.can_read_personal_data(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.has_permission(p_company_id, 'colaboradores.documentos.read')
      or private.has_permission(p_company_id, 'colaboradores.documentos.manage')
$$;

revoke all on function private.can_read_personal_data(uuid) from public, anon;
grant execute on function private.can_read_personal_data(uuid) to authenticated;

-- 4) Leitura por colaborador e em lote
create or replace function public.get_employee_personal_data(p_employee_id uuid)
returns table (employee_id uuid, cpf text, rg text, rg_issuer text, phone text, emergency_phone text)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.can_read_personal_data(v_company) then
    raise exception 'Sem permissão para consultar CPF, RG e telefone deste colaborador';
  end if;
  return query
    select e.id, e.cpf, e.rg, e.rg_issuer, e.phone, e.emergency_phone from public.employees e where e.id = p_employee_id;
end;
$$;

create or replace function public.list_employee_personal_data()
returns table (employee_id uuid, cpf text, rg text, rg_issuer text, phone text, emergency_phone text)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.default_company_id();
begin
  if v_company is null then
    raise exception 'Empresa não identificada';
  end if;
  if not private.can_read_personal_data(v_company) then
    raise exception 'Sem permissão para consultar CPF, RG e telefone dos colaboradores';
  end if;
  return query
    select e.id, e.cpf, e.rg, e.rg_issuer, e.phone, e.emergency_phone from public.employees e where e.company_id = v_company order by e.name;
end;
$$;

-- 5) Gravação única. Normaliza, valida CPF, recusa duplicidade na empresa e audita só máscara + impressão curta.
create or replace function public.set_employee_personal_data(p_employee_id uuid, p_changes jsonb, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_old public.employees;
  v_allowed text[] := array['cpf', 'rg', 'rg_issuer', 'phone', 'emergency_phone'];
  v_key text;
  v_raw text;
  v_new text;
  v_old_val text;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_vals jsonb := '{}'::jsonb;
  v_changed text[] := '{}';
begin
  select * into v_old from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.has_permission(v_old.company_id, 'colaboradores.documentos.manage') then
    raise exception 'Sem permissão para alterar CPF, RG e telefone deste colaborador';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'Informe as alterações';
  end if;

  for v_key in select jsonb_object_keys(p_changes) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'Campo não permitido: %', v_key;
    end if;
    v_raw := p_changes ->> v_key;
    if v_key = 'cpf' then
      v_new := nullif(regexp_replace(coalesce(v_raw, ''), '\D', '', 'g'), '');
      if v_new is not null and not public.is_valid_cpf(v_new) then
        raise exception 'CPF_INVALIDO: informe um CPF válido';
      end if;
    elsif v_key in ('phone', 'emergency_phone') then
      v_new := nullif(btrim(coalesce(v_raw, '')), '');
      if v_new is not null and length(regexp_replace(v_new, '\D', '', 'g')) < 8 then
        raise exception 'TELEFONE_INVALIDO: informe o telefone com DDD';
      end if;
    else
      v_new := nullif(btrim(coalesce(v_raw, '')), '');
    end if;
    v_vals := v_vals || jsonb_build_object(v_key, v_new);
    v_old_val := to_jsonb(v_old) ->> v_key;
    if v_old_val is distinct from v_new then
      v_changed := v_changed || v_key;
      v_before := v_before || jsonb_build_object(v_key, case when v_old_val is null then null else
        jsonb_build_object('mascara', '***' || right(v_old_val, 2), 'impressao', left(md5(v_old_val), 8)) end);
      v_after := v_after || jsonb_build_object(v_key, case when v_new is null then null else
        jsonb_build_object('mascara', '***' || right(v_new, 2), 'impressao', left(md5(v_new), 8)) end);
    end if;
  end loop;

  begin
    update public.employees set
      cpf = case when v_vals ? 'cpf' then v_vals ->> 'cpf' else cpf end,
      rg = case when v_vals ? 'rg' then v_vals ->> 'rg' else rg end,
      rg_issuer = case when v_vals ? 'rg_issuer' then v_vals ->> 'rg_issuer' else rg_issuer end,
      phone = case when v_vals ? 'phone' then v_vals ->> 'phone' else phone end,
      emergency_phone = case when v_vals ? 'emergency_phone' then v_vals ->> 'emergency_phone' else emergency_phone end,
      updated_at = now()
    where id = p_employee_id;
  exception when unique_violation then
    raise exception 'CPF_DUPLICADO: já existe colaborador com este CPF nesta empresa';
  end;

  if array_length(v_changed, 1) is not null then
    perform private.record_audit_event('employee.personal_data_changed', v_old.company_id, 'employee', p_employee_id::text,
      jsonb_build_object('fields', to_jsonb(v_changed), 'before', v_before, 'after', v_after,
                         'reason', nullif(btrim(coalesce(p_reason, '')), '')));
  end if;
end;
$$;

revoke all on function public.get_employee_personal_data(uuid) from public, anon;
revoke all on function public.list_employee_personal_data() from public, anon;
revoke all on function public.set_employee_personal_data(uuid, jsonb, text) from public, anon;
grant execute on function public.get_employee_personal_data(uuid) to authenticated;
grant execute on function public.list_employee_personal_data() to authenticated;
grant execute on function public.set_employee_personal_data(uuid, jsonb, text) to authenticated;
