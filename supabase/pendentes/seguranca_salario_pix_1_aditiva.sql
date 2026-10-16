-- SEGURANÇA DE SALÁRIO E PIX — FASE 1 (aditiva). NÃO APLICADA EM PRODUÇÃO: aguarda aprovação específica.
-- Não muda nenhum comportamento existente: só cria permissões, funções novas e concede as permissões novas
-- a quem hoje já tem acesso total (papéis que possuem despesas.manage). Reversão: seguranca_salario_pix_reverter_1.sql

-- 1) Permissões novas (o catálogo é a tabela public.permissions; role_permissions tem FK para ela)
insert into public.permissions (key, name, description, sensitivity) values
  ('colaboradores.remuneracao.read', 'Ver remuneração e Pix dos colaboradores',
   'Salário-base, adicionais, benefícios, divisor, percentual de hora extra, percentual de comissão e chave Pix.', 'SENSITIVE'),
  ('colaboradores.remuneracao.manage', 'Alterar remuneração e Pix dos colaboradores',
   'Altera salário (com histórico e motivo), parâmetros de remuneração e chave Pix.', 'CRITICAL')
on conflict (key) do nothing;

-- 2) Preserva o acesso atual (uma única vez, na aplicação): quem tem despesas.manage hoje recebe as duas permissões.
--    Papéis criados depois NÃO recebem automaticamente.
insert into public.role_permissions (company_id, role_id, permission_key)
select rp.company_id, rp.role_id, k.key
from public.role_permissions rp
cross join (values ('colaboradores.remuneracao.read'), ('colaboradores.remuneracao.manage')) as k(key)
where rp.permission_key = 'despesas.manage'
on conflict do nothing;

-- 3) Quem pode ler remuneração
create or replace function private.can_read_compensation(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.has_permission(p_company_id, 'colaboradores.remuneracao.read')
      or private.has_permission(p_company_id, 'colaboradores.remuneracao.manage')
$$;

-- usada em política de RLS (avaliada com o privilégio de quem consulta): authenticated precisa de EXECUTE, como em has_permission
revoke all on function private.can_read_compensation(uuid) from public, anon;
grant execute on function private.can_read_compensation(uuid) to authenticated;

-- 4) Leitura por colaborador. Despesas (despesas.manage) também lê, porque gera a folha.
--    Gancho para o acesso do próprio colaborador (Meu 360/Meu Dinheiro): hoje não há vínculo usuário-colaborador;
--    quando houver, a leitura própria deve entrar aqui, por sessão pessoal, sem passar pela permissão de RH.
create or replace function public.get_employee_compensation(p_employee_id uuid)
returns table (
  employee_id uuid, salary_base numeric, salary_additions numeric, salary_benefits text, salary_effective_date date,
  monthly_divisor numeric, timesheet_overtime_percent numeric, commission_rate_percent numeric, pix_key text
)
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
  if not (private.can_read_compensation(v_company) or private.has_permission(v_company, 'despesas.manage')) then
    raise exception 'Sem permissão para consultar a remuneração deste colaborador';
  end if;
  return query
    select e.id, e.salary_base, e.salary_additions, e.salary_benefits, e.salary_effective_date,
           e.monthly_divisor, e.timesheet_overtime_percent, e.commission_rate_percent, e.pix_key
    from public.employees e where e.id = p_employee_id;
end;
$$;

-- 5) Leitura em lote da empresa do usuário (listas de folha)
create or replace function public.list_employee_compensation()
returns table (
  employee_id uuid, salary_base numeric, salary_additions numeric, salary_benefits text, salary_effective_date date,
  monthly_divisor numeric, timesheet_overtime_percent numeric, commission_rate_percent numeric, pix_key text
)
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
  if not (private.can_read_compensation(v_company) or private.has_permission(v_company, 'despesas.manage')) then
    raise exception 'Sem permissão para consultar a remuneração dos colaboradores';
  end if;
  return query
    select e.id, e.salary_base, e.salary_additions, e.salary_benefits, e.salary_effective_date,
           e.monthly_divisor, e.timesheet_overtime_percent, e.commission_rate_percent, e.pix_key
    from public.employees e where e.company_id = v_company order by e.name;
end;
$$;

-- 6) Gravação única de remuneração e Pix. Salário passa pelo histórico versionado, com motivo e auditoria.
create or replace function public.set_employee_compensation(p_employee_id uuid, p_changes jsonb, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_old public.employees;
  v_allowed text[] := array['salary_base', 'salary_additions', 'salary_benefits', 'salary_effective_date', 'monthly_divisor', 'timesheet_overtime_percent', 'pix_key'];
  v_key text;
  v_new_base numeric;
  v_new_date date;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
begin
  select * into v_old from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.has_permission(v_old.company_id, 'colaboradores.remuneracao.manage') then
    raise exception 'Sem permissão para alterar a remuneração deste colaborador';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'Informe as alterações';
  end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'Campo de remuneração não permitido: %', v_key;
    end if;
  end loop;

  if p_changes ? 'salary_base' then
    v_new_base := nullif(p_changes->>'salary_base', '')::numeric;
    if v_new_base is null or v_new_base < 0 then
      raise exception 'Salário inválido';
    end if;
    v_new_date := coalesce(nullif(p_changes->>'salary_effective_date', '')::date, current_date);
    if v_new_base is distinct from v_old.salary_base then
      if length(trim(coalesce(p_reason, ''))) < 5 then
        raise exception 'MOTIVO_OBRIGATORIO: informe o motivo da alteração salarial';
      end if;
      v_before := v_before || jsonb_build_object('salary_base', v_old.salary_base, 'salary_effective_date', v_old.salary_effective_date);
      v_after := v_after || jsonb_build_object('salary_base', v_new_base, 'salary_effective_date', v_new_date);
      insert into public.salary_history (company_id, employee_id, salary_base, effective_date, created_by)
      values (v_old.company_id, p_employee_id, v_new_base, v_new_date, auth.uid());
      if (select max(effective_date) from public.salary_history where employee_id = p_employee_id) = v_new_date then
        update public.employees set salary_base = v_new_base, salary_effective_date = v_new_date where id = p_employee_id;
      end if;
    end if;
  elsif p_changes ? 'salary_effective_date' then
    update public.employees set salary_effective_date = nullif(p_changes->>'salary_effective_date', '')::date where id = p_employee_id;
  end if;

  if p_changes ? 'pix_key' then
    -- a chave inteira nunca vai para a auditoria: só máscara (4 últimos) + impressão digital curta,
    -- para que a troca por outra chave de mesmo final continue visível
    if coalesce(v_old.pix_key, '') is distinct from coalesce(p_changes->>'pix_key', '') then
      v_before := v_before || jsonb_build_object('pix_key', case when coalesce(v_old.pix_key, '') = '' then null
        else jsonb_build_object('mascara', '***' || right(v_old.pix_key, 4), 'impressao', left(md5(v_old.pix_key), 8)) end);
      v_after := v_after || jsonb_build_object('pix_key', case when coalesce(p_changes->>'pix_key', '') = '' then null
        else jsonb_build_object('mascara', '***' || right(p_changes->>'pix_key', 4), 'impressao', left(md5(p_changes->>'pix_key'), 8)) end);
    end if;
  end if;
  foreach v_key in array array['salary_additions', 'salary_benefits', 'monthly_divisor', 'timesheet_overtime_percent'] loop
    if p_changes ? v_key then
      v_before := v_before || jsonb_build_object(v_key, to_jsonb(v_old) -> v_key);
      v_after := v_after || jsonb_build_object(v_key, p_changes -> v_key);
    end if;
  end loop;

  update public.employees set
    salary_additions = case when p_changes ? 'salary_additions' then coalesce(nullif(p_changes->>'salary_additions', '')::numeric, 0) else salary_additions end,
    salary_benefits = case when p_changes ? 'salary_benefits' then nullif(p_changes->>'salary_benefits', '') else salary_benefits end,
    monthly_divisor = case when p_changes ? 'monthly_divisor' then (p_changes->>'monthly_divisor')::numeric else monthly_divisor end,
    timesheet_overtime_percent = case when p_changes ? 'timesheet_overtime_percent' then (p_changes->>'timesheet_overtime_percent')::numeric else timesheet_overtime_percent end,
    pix_key = case when p_changes ? 'pix_key' then nullif(p_changes->>'pix_key', '') else pix_key end,
    updated_at = now()
  where id = p_employee_id;

  perform private.record_audit_event('employee.compensation_changed', v_old.company_id, 'employee', p_employee_id::text,
    jsonb_build_object('fields', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(p_changes) k),
                       'before', v_before, 'after', v_after, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
end;
$$;

-- 7) Percentual de comissão: vendas.manage ou remuneração. Leitura em lote para a Força de Vendas.
create or replace function public.set_employee_commission_rate(p_employee_id uuid, p_rate numeric)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_before numeric;
begin
  select company_id, commission_rate_percent into v_company, v_before from public.employees where id = p_employee_id for update;
  if v_company is null then
    raise exception 'Colaborador não encontrado';
  end if;
  if not (private.has_permission(v_company, 'vendas.manage') or private.has_permission(v_company, 'colaboradores.remuneracao.manage')) then
    raise exception 'Sem permissão para alterar a comissão';
  end if;
  if p_rate is not null and (p_rate < 0 or p_rate > 100) then
    raise exception 'Percentual de comissão inválido';
  end if;
  update public.employees set commission_rate_percent = p_rate, updated_at = now() where id = p_employee_id;
  perform private.record_audit_event('employee.commission_rate_changed', v_company, 'employee', p_employee_id::text,
    jsonb_build_object('before', v_before, 'after', p_rate));
end;
$$;

create or replace function public.list_commission_rates()
returns table (employee_id uuid, commission_rate_percent numeric)
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
  if not (private.has_permission(v_company, 'vendas.read') or private.has_permission(v_company, 'vendas.manage') or private.can_read_compensation(v_company)) then
    raise exception 'Sem permissão para consultar comissões';
  end if;
  return query select e.id, e.commission_rate_percent from public.employees e where e.company_id = v_company;
end;
$$;

revoke all on function public.get_employee_compensation(uuid) from public, anon;
revoke all on function public.list_employee_compensation() from public, anon;
revoke all on function public.set_employee_compensation(uuid, jsonb, text) from public, anon;
revoke all on function public.set_employee_commission_rate(uuid, numeric) from public, anon;
revoke all on function public.list_commission_rates() from public, anon;
grant execute on function public.get_employee_compensation(uuid) to authenticated;
grant execute on function public.list_employee_compensation() to authenticated;
grant execute on function public.set_employee_compensation(uuid, jsonb, text) to authenticated;
grant execute on function public.set_employee_commission_rate(uuid, numeric) to authenticated;
grant execute on function public.list_commission_rates() to authenticated;
