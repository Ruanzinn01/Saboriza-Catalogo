-- SEGURANÇA DE SALÁRIO E PIX — FASE 2 (restritiva). NÃO APLICADA EM PRODUÇÃO: aguarda aprovação específica.
-- Pré-requisito: Fase 1 aplicada E front novo publicado (o front antigo lê employees com select(*) e grava as colunas
-- sensíveis direto na tabela; depois desta fase isso passa a falhar com "permission denied for column").
-- Reversão: seguranca_salario_pix_reverter_2.sql
--
-- Mecanismo: privilégio por COLUNA. A RLS só filtra linhas; para esconder colunas o papel authenticated perde o
-- privilégio de tabela e recebe privilégio apenas nas colunas não sensíveis. Colunas novas ficam sem acesso até
-- serem concedidas de propósito (seguro por padrão). O service_role (funções de borda) não é afetado.

-- 1) Funções que liam as colunas sensíveis como o próprio usuário passam a ser DEFINER com checagem de permissão
create or replace function public.resolve_salary_base(p_employee_id uuid, p_competence date)
returns numeric
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
    raise exception 'Sem permissão para consultar salário deste colaborador';
  end if;

  return coalesce(
    (select sh.salary_base from public.salary_history sh
     where sh.employee_id = p_employee_id and sh.effective_date <= p_competence
     order by sh.effective_date desc limit 1),
    (select e.salary_base from public.employees e where e.id = p_employee_id)
  );
end;
$$;

create or replace function public.update_employee_salary(p_employee_id uuid, p_salary_base numeric, p_effective_date date)
returns void
language plpgsql
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
  if not private.has_permission(v_company, 'colaboradores.remuneracao.manage') then
    raise exception 'Sem permissão para alterar salário';
  end if;
  if p_salary_base < 0 then
    raise exception 'Salário inválido';
  end if;

  insert into public.salary_history (company_id, employee_id, salary_base, effective_date, created_by)
  values (v_company, p_employee_id, p_salary_base, p_effective_date, auth.uid());

  if (select max(effective_date) from public.salary_history where employee_id = p_employee_id) = p_effective_date then
    update public.employees set salary_base = p_salary_base, salary_effective_date = p_effective_date, updated_at = now() where id = p_employee_id;
  end if;

  perform private.record_audit_event('employee.compensation_changed', v_company, 'employee', p_employee_id::text,
    jsonb_build_object('fields', jsonb_build_array('salary_base', 'salary_effective_date'),
                       'after', jsonb_build_object('salary_base', p_salary_base, 'salary_effective_date', p_effective_date),
                       'origin', 'update_employee_salary'));
end;
$$;

-- o pagamento de horas extras lê salário/divisor/percentual: precisa rodar como DEFINER (a checagem de permissão já existe)
create or replace function public.oris360_resolver_banco_horas(p_employee_id uuid, p_minutes integer, p_resolution text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company_id uuid;
  v_salary numeric;
  v_divisor numeric;
  v_percent numeric;
  v_hourly numeric;
  v_amount numeric;
  v_expense_id uuid;
  v_entry_id uuid;
  v_balance integer;
begin
  if p_resolution not in ('PAGO','COMPENSADO') then
    raise exception 'resolucao invalida';
  end if;
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'Informe uma quantidade de minutos maior que zero';
  end if;

  select company_id, salary_base, monthly_divisor, timesheet_overtime_percent
    into v_company_id, v_salary, v_divisor, v_percent
    from public.employees where id = p_employee_id;

  if v_company_id is null or not private.has_permission(v_company_id, 'timesheet.apuracao.manage') then
    raise exception 'sem permissao';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('banco_horas' || p_employee_id::text, 0));

  select coalesce(sum(case when type = 'CREDITO_EXTRA' then minutes else -minutes end), 0)::integer
    into v_balance from public.time_bank_entries where employee_id = p_employee_id;
  if p_minutes > v_balance then
    raise exception 'SALDO_INSUFICIENTE: o banco de horas tem % minuto(s) e foram pedidos %', v_balance, p_minutes;
  end if;

  if p_resolution = 'PAGO' then
    if v_salary is null or v_divisor is null or v_divisor = 0 then
      raise exception 'colaborador sem salario/divisor configurado para calcular o valor da hora';
    end if;
    v_hourly := v_salary / v_divisor;
    v_amount := round((p_minutes / 60.0) * v_hourly * (1 + coalesce(v_percent, 0) / 100.0), 2);

    insert into public.expenses (description, category, nature, employee_id, competence, amount, status)
    values (
      'Pagamento de horas extras (' || p_minutes || ' min)', 'Salários', 'SALARIO', p_employee_id,
      date_trunc('month', current_date)::date, v_amount, 'ABERTO'
    ) returning id into v_expense_id;
  end if;

  insert into public.time_bank_entries (employee_id, type, minutes, amount, expense_id)
  values (p_employee_id, p_resolution, p_minutes, v_amount, v_expense_id)
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- 2) Histórico salarial: leitura só com permissão de remuneração; escrita só pelas funções acima
drop policy if exists salary_history_select on public.salary_history;
drop policy if exists salary_history_insert on public.salary_history;
create policy salary_history_select on public.salary_history
  for select to authenticated using (private.can_read_compensation(company_id));
revoke all on public.salary_history from anon;
revoke insert, update, delete, truncate on public.salary_history from authenticated;

-- 3) employees: privilégio por coluna. Sem delete pela API (o front nunca exclui; desligamento é por status)
drop policy if exists employees_delete on public.employees;
do $$
declare
  v_sensitive text[] := array['salary_base', 'salary_additions', 'salary_benefits', 'salary_effective_date',
                              'monthly_divisor', 'timesheet_overtime_percent', 'commission_rate_percent', 'pix_key'];
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'employees' and column_name <> all (v_sensitive);

  execute 'revoke all on public.employees from authenticated';
  execute 'revoke all on public.employees from anon';
  execute format('grant select (%s) on public.employees to authenticated', v_cols);
  execute format('grant insert (%s) on public.employees to authenticated', v_cols);
  execute format('grant update (%s) on public.employees to authenticated', v_cols);
  execute 'grant references on public.employees to authenticated';
end;
$$;
