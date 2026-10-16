-- REVERSÃO DA FASE 2. GERADA pelo teste a partir do estado anterior à fase 2 (corpos, políticas e grants literais).
-- Mantém a Fase 1. Verificada por hash: depois de aplicar, grants/políticas/funções ficam IGUAIS ao estado anterior.

CREATE OR REPLACE FUNCTION public.resolve_salary_base(p_employee_id uuid, p_competence date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_company uuid;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.is_active_company_member(v_company) then
    raise exception 'Sem permissão para consultar salário deste colaborador';
  end if;

  return coalesce(
    (select sh.salary_base from public.salary_history sh
     where sh.employee_id = p_employee_id and sh.effective_date <= p_competence
     order by sh.effective_date desc limit 1),
    (select e.salary_base from public.employees e where e.id = p_employee_id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_employee_salary(p_employee_id uuid, p_salary_base numeric, p_effective_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_company uuid;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.is_active_company_member(v_company) then
    raise exception 'Sem permissão para alterar salário';
  end if;
  if p_salary_base < 0 then
    raise exception 'Salário inválido';
  end if;

  insert into public.salary_history (company_id, employee_id, salary_base, effective_date, created_by)
  values (v_company, p_employee_id, p_salary_base, p_effective_date, auth.uid());

  if (select max(effective_date) from public.salary_history where employee_id = p_employee_id) = p_effective_date then
    update public.employees
    set salary_base = p_salary_base, salary_effective_date = p_effective_date, updated_at = now()
    where id = p_employee_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.oris360_resolver_banco_horas(p_employee_id uuid, p_minutes integer, p_resolution text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

drop policy if exists salary_history_select on public.salary_history;
drop policy if exists salary_history_insert on public.salary_history;
drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees for delete to authenticated using (( SELECT private.is_active_company_member(employees.company_id) AS is_active_company_member));
create policy salary_history_insert on public.salary_history for insert to public with check (private.is_active_company_member(company_id));
create policy salary_history_select on public.salary_history for select to public using (private.is_active_company_member(company_id));

revoke all on public.salary_history from authenticated, anon;
grant delete, insert, references, select, trigger, update on public.salary_history to authenticated;
grant delete, insert, references, select, trigger, update on public.salary_history to anon;

revoke all on public.employees from authenticated, anon;
grant delete, insert, references, select, trigger, update on public.employees to authenticated;
