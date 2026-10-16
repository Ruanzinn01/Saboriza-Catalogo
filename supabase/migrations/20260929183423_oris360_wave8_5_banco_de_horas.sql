-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929183423 · md5 normalizado 42056cd0b1679d86facca8737e1d3a1e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 8.5 — Banco de horas: credita extra/debita atraso por competencia, resolve em pagamento (Despesas) ou compensacao.

alter table public.employees
  add column timesheet_overtime_percent numeric not null default 50;

create table public.time_bank_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  employee_id uuid not null references public.employees(id),
  competencia date,
  type text not null check (type in ('CREDITO_EXTRA','DEBITO_ATRASO','COMPENSADO','PAGO')),
  minutes integer not null check (minutes > 0),
  amount numeric,
  expense_id uuid references public.expenses(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger time_bank_entries_set_company before insert on public.time_bank_entries
  for each row execute function private.set_company_from_employee();

-- Evita creditar a mesma competencia duas vezes (fechamento idempotente).
create unique index time_bank_entries_competencia_unique
  on public.time_bank_entries (employee_id, competencia, type)
  where type in ('CREDITO_EXTRA','DEBITO_ATRASO');

alter table public.time_bank_entries enable row level security;
create policy time_bank_entries_select on public.time_bank_entries for select
  using (private.has_permission(company_id, 'timesheet.apuracao.read'));
create policy time_bank_entries_insert on public.time_bank_entries for insert
  with check (private.has_permission(company_id, 'timesheet.apuracao.manage'));

create or replace function public.oris360_time_bank_balance(p_employee_id uuid)
returns integer
language sql
stable
set search_path to ''
as $$
  select coalesce(sum(
    case
      when type = 'CREDITO_EXTRA' then minutes
      else -minutes
    end
  ), 0)::integer
  from public.time_bank_entries
  where employee_id = p_employee_id
    and private.has_permission(company_id, 'timesheet.apuracao.read')
$$;

-- Fecha a competencia: credita as horas extras e debita os atrasos do mes no banco de horas.
-- Idempotente por competencia (indice unico acima) - fechar duas vezes nao duplica.
create or replace function public.oris360_fechar_competencia_ponto(p_employee_id uuid, p_competencia date)
returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  v_company_id uuid;
  d date;
  last_day date;
  result jsonb;
  v_extra numeric := 0;
  v_late numeric := 0;
begin
  select company_id into v_company_id from public.employees where id = p_employee_id;
  if v_company_id is null or not private.has_permission(v_company_id, 'timesheet.apuracao.manage') then
    raise exception 'sem permissao';
  end if;

  d := date_trunc('month', p_competencia)::date;
  last_day := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;

  while d <= last_day and d <= current_date loop
    result := private.compute_day(p_employee_id, d);
    v_extra := v_extra + (result->>'extra_minutes')::int;
    v_late := v_late + (result->>'late_minutes')::int;
    d := d + 1;
  end loop;

  if v_extra > 0 then
    insert into public.time_bank_entries (employee_id, competencia, type, minutes)
    values (p_employee_id, date_trunc('month', p_competencia)::date, 'CREDITO_EXTRA', round(v_extra)::int)
    on conflict do nothing;
  end if;

  if v_late > 0 then
    insert into public.time_bank_entries (employee_id, competencia, type, minutes)
    values (p_employee_id, date_trunc('month', p_competencia)::date, 'DEBITO_ATRASO', round(v_late)::int)
    on conflict do nothing;
  end if;

  return jsonb_build_object('extra_minutes', round(v_extra)::int, 'late_minutes', round(v_late)::int);
end;
$$;

-- Resolve parte do saldo do banco de horas: PAGO cria despesa (usa monthly_divisor e overtime_percent do colaborador),
-- COMPENSADO so debita o saldo sem gerar despesa.
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
begin
  if p_resolution not in ('PAGO','COMPENSADO') then
    raise exception 'resolucao invalida';
  end if;

  select company_id, salary_base, monthly_divisor, timesheet_overtime_percent
  into v_company_id, v_salary, v_divisor, v_percent
  from public.employees where id = p_employee_id;

  if v_company_id is null or not private.has_permission(v_company_id, 'timesheet.apuracao.manage') then
    raise exception 'sem permissao';
  end if;

  if p_resolution = 'PAGO' then
    if v_salary is null or v_divisor is null or v_divisor = 0 then
      raise exception 'colaborador sem salario/divisor configurado para calcular o valor da hora';
    end if;
    v_hourly := v_salary / v_divisor;
    v_amount := round((p_minutes / 60.0) * v_hourly * (1 + coalesce(v_percent, 0) / 100.0), 2);

    insert into public.expenses (description, category, nature, employee_id, competence, amount, status)
    values (
      'Pagamento de horas extras (' || p_minutes || ' min)',
      'Salários',
      'SALARIO',
      p_employee_id,
      date_trunc('month', current_date)::date,
      v_amount,
      'ABERTO'
    )
    returning id into v_expense_id;
  end if;

  insert into public.time_bank_entries (employee_id, type, minutes, amount, expense_id)
  values (p_employee_id, p_resolution, p_minutes, v_amount, v_expense_id)
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;
;
