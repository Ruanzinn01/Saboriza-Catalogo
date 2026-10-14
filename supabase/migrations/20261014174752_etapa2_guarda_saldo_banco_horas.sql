-- Etapa 2 — Banco de horas: o mesmo minuto não pode ser compensado e pago duas vezes (E12).
-- Antes, oris360_resolver_banco_horas aceitava resolver mais minutos que o saldo. Agora recusa e serializa por colaborador.
-- O pagamento ainda cria despesa direta (terceira porta para Despesas); o redirecionamento para a obrigação salarial
-- fica documentado na etapa 3 e não foi alterado aqui.

create or replace function public.oris360_resolver_banco_horas(p_employee_id uuid, p_minutes integer, p_resolution text)
returns uuid
language plpgsql
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
