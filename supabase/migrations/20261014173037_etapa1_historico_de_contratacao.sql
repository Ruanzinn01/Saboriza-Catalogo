-- Etapa 1 — Identidade e vínculo: cada período de contratação vira uma linha própria e imutável depois de encerrado.
-- Recontratar abre um período novo; o período anterior permanece íntegro. employees continua sendo o cadastro atual.
-- Aditivo: nenhuma coluna existente é removida. Não destrutivo.

create or replace function private.company_tz(p_company_id uuid)
returns text
language sql
stable
set search_path to ''
as $$
  select coalesce((select c.default_timezone from public.companies c where c.id = p_company_id), 'America/Sao_Paulo')
$$;

create table if not exists public.employee_employments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  employee_id uuid not null,
  sequence integer not null check (sequence > 0),
  start_date date not null,
  end_date date,
  end_reason text,
  unit_id uuid,
  role text,
  department text,
  employment_type text,
  employment_regime text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint employee_employments_dates_check check (end_date is null or end_date >= start_date),
  constraint employee_employments_employee_fk foreign key (company_id, employee_id)
    references public.employees (company_id, id) on delete cascade,
  constraint employee_employments_sequence_key unique (employee_id, sequence)
);

create unique index if not exists employee_employments_one_open_idx
  on public.employee_employments (employee_id) where end_date is null;
create index if not exists employee_employments_company_idx on public.employee_employments (company_id);

alter table public.employee_employments enable row level security;
drop policy if exists employee_employments_select on public.employee_employments;
create policy employee_employments_select on public.employee_employments
  for select using ((select private.is_active_company_member(company_id)));
revoke all on public.employee_employments from anon, authenticated;
grant select on public.employee_employments to authenticated;

-- Backfill idempotente: um período por colaborador que ainda não tem nenhum.
insert into public.employee_employments
  (company_id, employee_id, sequence, start_date, end_date, end_reason, closed_at, unit_id, role, department, employment_type, employment_regime)
select e.company_id, e.id, 1,
  coalesce(e.employment_start_date, e.admission_date, e.created_at::date),
  case when e.status = 'INATIVO'
       then greatest(coalesce(e.employment_start_date, e.admission_date, e.created_at::date),
                     coalesce(e.employment_end_date, e.termination_date, e.updated_at::date)) end,
  case when e.status = 'INATIVO' then e.termination_reason end,
  case when e.status = 'INATIVO' then now() end,
  e.unit_id, e.role, e.department, e.employment_type, e.employment_regime
from public.employees e
where not exists (select 1 from public.employee_employments x where x.employee_id = e.id);

-- Período do colaborador numa data (data civil na empresa).
create or replace function private.employment_at(p_employee_id uuid, p_date date)
returns uuid
language sql
stable
set search_path to ''
as $$
  select id from public.employee_employments
  where employee_id = p_employee_id and start_date <= p_date and (end_date is null or end_date >= p_date)
  order by start_date desc limit 1
$$;

-- Não permite sobreposição de períodos do mesmo colaborador.
create or replace function private.employment_overlap_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if exists (
    select 1 from public.employee_employments o
    where o.employee_id = new.employee_id and o.id <> new.id
      and o.start_date <= coalesce(new.end_date, 'infinity'::date)
      and new.start_date <= coalesce(o.end_date, 'infinity'::date)
  ) then
    raise exception 'PERIODO_SOBREPOSTO: já existe vínculo deste colaborador nesse intervalo de datas';
  end if;
  return new;
end;
$$;

drop trigger if exists employee_employments_overlap_guard on public.employee_employments;
create trigger employee_employments_overlap_guard
  before insert or update on public.employee_employments
  for each row execute function private.employment_overlap_guard();

-- Período encerrado é imutável; no aberto só mudam início, lotação e encerramento.
create or replace function private.employment_immutable_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if old.end_date is not null then
    raise exception 'VINCULO_ENCERRADO_IMUTAVEL: período de contratação encerrado não pode ser alterado';
  end if;
  if new.employee_id <> old.employee_id or new.company_id <> old.company_id or new.sequence <> old.sequence then
    raise exception 'Identidade do período de contratação não pode mudar';
  end if;
  return new;
end;
$$;

drop trigger if exists employee_employments_immutable_guard on public.employee_employments;
create trigger employee_employments_immutable_guard
  before update on public.employee_employments
  for each row execute function private.employment_immutable_guard();

-- Reativação: o cadastro atual deixa de carregar os dados do desligamento (eles ficam no período encerrado).
create or replace function private.employees_rehire_normalize()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if old.status = 'INATIVO' and new.status = 'ATIVO' then
    new.termination_date := null;
    new.employment_end_date := null;
    new.termination_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists employees_rehire_normalize on public.employees;
create trigger employees_rehire_normalize
  before update on public.employees
  for each row execute function private.employees_rehire_normalize();

-- Mantém os períodos a partir do cadastro: abre, encerra, reabre e acompanha a lotação do período aberto.
create or replace function private.employees_employment_sync()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_open public.employee_employments;
  v_prev_end date;
  v_prev_seq integer;
  v_candidate date;
  v_start date;
  v_today date := (now() at time zone private.company_tz(new.company_id))::date;
begin
  if tg_op = 'INSERT' then
    v_start := coalesce(new.employment_start_date, new.admission_date, v_today);
    insert into public.employee_employments
      (company_id, employee_id, sequence, start_date, end_date, end_reason, closed_at, unit_id, role, department, employment_type, employment_regime)
    values
      (new.company_id, new.id, 1, v_start,
       case when new.status = 'INATIVO' then greatest(v_start, coalesce(new.employment_end_date, new.termination_date, v_today)) end,
       case when new.status = 'INATIVO' then new.termination_reason end,
       case when new.status = 'INATIVO' then now() end,
       new.unit_id, new.role, new.department, new.employment_type, new.employment_regime);
    return null;
  end if;

  select * into v_open from public.employee_employments where employee_id = new.id and end_date is null;

  if old.status = 'ATIVO' and new.status = 'INATIVO' then
    if found then
      update public.employee_employments
         set end_date = greatest(start_date, coalesce(new.employment_end_date, new.termination_date, v_today)),
             end_reason = new.termination_reason,
             closed_at = now()
       where id = v_open.id;
    end if;
  elsif old.status = 'INATIVO' and new.status = 'ATIVO' then
    if not found then
      select max(end_date), max(sequence) into v_prev_end, v_prev_seq from public.employee_employments where employee_id = new.id;
      v_candidate := coalesce(new.employment_start_date, new.admission_date);
      v_start := case when v_candidate is not null and (v_prev_end is null or v_candidate > v_prev_end) then v_candidate else v_today end;
      insert into public.employee_employments
        (company_id, employee_id, sequence, start_date, unit_id, role, department, employment_type, employment_regime)
      values
        (new.company_id, new.id, coalesce(v_prev_seq, 0) + 1, v_start,
         new.unit_id, new.role, new.department, new.employment_type, new.employment_regime);
    end if;
  elsif found then
    select max(end_date) into v_prev_end from public.employee_employments where employee_id = new.id and end_date is not null;
    v_candidate := coalesce(new.employment_start_date, new.admission_date, v_open.start_date);
    update public.employee_employments
       set start_date = case when v_prev_end is null or v_candidate > v_prev_end then v_candidate else start_date end,
           unit_id = new.unit_id, role = new.role, department = new.department,
           employment_type = new.employment_type, employment_regime = new.employment_regime
     where id = v_open.id
       and (start_date is distinct from case when v_prev_end is null or v_candidate > v_prev_end then v_candidate else start_date end
            or unit_id is distinct from new.unit_id or role is distinct from new.role or department is distinct from new.department
            or employment_type is distinct from new.employment_type or employment_regime is distinct from new.employment_regime);
  end if;
  return null;
end;
$$;

drop trigger if exists employees_employment_sync on public.employees;
create trigger employees_employment_sync
  after insert or update on public.employees
  for each row execute function private.employees_employment_sync();

-- Eventos do vínculo (sem dados pessoais no payload).
create or replace function private.employment_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.emit_event('employment.opened', new.company_id, 'employment', new.id::text,
      jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.id, 'sequence', new.sequence, 'start_date', new.start_date),
      new.employee_id, null, 'employment.opened:' || new.id);
  elsif old.end_date is null and new.end_date is not null then
    perform private.emit_event('employment.closed', new.company_id, 'employment', new.id::text,
      jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.id, 'sequence', new.sequence, 'end_date', new.end_date),
      new.employee_id, null, 'employment.closed:' || new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists employee_employments_emit_event on public.employee_employments;
create trigger employee_employments_emit_event
  after insert or update on public.employee_employments
  for each row execute function private.employment_emit_event();

-- Fatos passam a apontar para o período em que aconteceram.
alter table public.salary_obligations add column if not exists employment_id uuid references public.employee_employments (id);
alter table public.time_punches add column if not exists employment_id uuid references public.employee_employments (id);

update public.salary_obligations o
   set employment_id = (
     select x.id from public.employee_employments x
     where x.employee_id = o.employee_id
       and x.start_date <= (o.competence + interval '1 month - 1 day')::date
       and (x.end_date is null or x.end_date >= o.competence)
     order by x.start_date desc limit 1)
 where o.employment_id is null;

create or replace function private.salary_obligation_set_employment()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.employment_id is null then
    select x.id into new.employment_id from public.employee_employments x
    where x.employee_id = new.employee_id
      and x.start_date <= (new.competence + interval '1 month - 1 day')::date
      and (x.end_date is null or x.end_date >= new.competence)
    order by x.start_date desc limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists salary_obligations_set_employment on public.salary_obligations;
create trigger salary_obligations_set_employment
  before insert on public.salary_obligations
  for each row execute function private.salary_obligation_set_employment();

-- Elegibilidade da batida no banco (defesa em profundidade): vínculo vigente na data local e ponto habilitado.
create or replace function private.time_punch_eligibility()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_company uuid;
  v_enabled boolean;
  v_date date;
begin
  select company_id, timesheet_enabled into v_company, v_enabled from public.employees where id = new.employee_id;
  if v_company is null then
    raise exception 'Colaborador não encontrado';
  end if;
  if not coalesce(v_enabled, false) then
    raise exception 'PONTO_NAO_HABILITADO: o colaborador não está habilitado para registrar jornada';
  end if;
  v_date := (coalesce(new.server_time, now()) at time zone private.company_tz(v_company))::date;
  new.employment_id := private.employment_at(new.employee_id, v_date);
  if new.employment_id is null then
    raise exception 'VINCULO_INVALIDO: colaborador sem vínculo vigente na data da batida';
  end if;
  return new;
end;
$$;

drop trigger if exists time_punches_eligibility on public.time_punches;
create trigger time_punches_eligibility
  before insert on public.time_punches
  for each row execute function private.time_punch_eligibility();

-- Eventos de folha e batida passam a levar o vínculo real (employment_id), não o id do colaborador.
create or replace function private.salary_obligation_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.emit_event('salary_obligation.created', new.company_id, 'salary_obligation', new.id::text,
      jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'competence', new.competence,
        'due_date', new.due_date, 'due_date_source', new.due_date_source),
      new.employee_id, null, 'salary_obligation.created:' || new.id);
  else
    if new.due_date is distinct from old.due_date then
      perform private.emit_event('salary_obligation.due_date_changed', new.company_id, 'salary_obligation', new.id::text,
        jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'competence', new.competence,
          'due_date', new.due_date, 'previous_due_date', old.due_date, 'due_date_source', new.due_date_source),
        new.employee_id, null,
        'salary_obligation.due_date_changed:' || new.id || ':' || old.due_date || '>' || new.due_date || ':' || txid_current());
    end if;
    if new.base_salary is distinct from old.base_salary or new.net_amount is distinct from old.net_amount then
      perform private.emit_event('salary_obligation.updated', new.company_id, 'salary_obligation', new.id::text,
        jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'competence', new.competence),
        new.employee_id, null, 'salary_obligation.updated:' || new.id || ':' || txid_current());
    end if;
  end if;
  return null;
end;
$$;

create or replace function private.salary_advance_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_employee uuid;
  v_employment uuid;
  v_competence date;
begin
  select o.employee_id, o.employment_id, o.competence into v_employee, v_employment, v_competence
    from public.salary_obligations o where o.id = new.salary_obligation_id;

  if tg_op = 'INSERT' then
    if new.status = 'ESTORNADO' and new.reversed_advance_id is not null then
      perform private.emit_event('salary_advance.reversed', new.company_id, 'salary_advance', new.reversed_advance_id::text,
        jsonb_build_object('salary_obligation_id', new.salary_obligation_id, 'employee_id', v_employee,
          'employment_id', v_employment, 'competence', v_competence, 'reversal_id', new.id),
        v_employee, null, 'salary_advance.reversed:' || new.reversed_advance_id);
    else
      perform private.emit_event('salary_advance.created', new.company_id, 'salary_advance', new.id::text,
        jsonb_build_object('salary_obligation_id', new.salary_obligation_id, 'employee_id', v_employee,
          'employment_id', v_employment, 'competence', v_competence, 'status', new.status),
        v_employee, null, 'salary_advance.created:' || new.id);
    end if;
  elsif new.status = 'PAGO' and old.status is distinct from 'PAGO' then
    perform private.emit_event('salary_advance.paid', new.company_id, 'salary_advance', new.id::text,
      jsonb_build_object('salary_obligation_id', new.salary_obligation_id, 'employee_id', v_employee,
        'employment_id', v_employment, 'competence', v_competence),
      v_employee, null, 'salary_advance.paid:' || new.id);
  end if;
  return null;
end;
$$;

create or replace function private.time_punch_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform private.emit_event('punch.recorded', new.company_id, 'time_punch', new.id::text,
    jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'type', new.type,
      'server_time', new.server_time, 'device_id', new.device_id),
    new.employee_id, null, 'punch.recorded:' || new.id);
  return null;
end;
$$;

-- A geração da obrigação valida o vínculo pelos períodos, não pelas colunas atuais do cadastro.
create or replace function public.generate_salary_obligation(
  p_employee_id uuid,
  p_competence date,
  p_due_date date,
  p_due_date_source text default 'competence_closing'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_emp public.employees;
  v_comp date;
  v_comp_end date;
  v_employment uuid;
  v_base numeric;
  v_existing public.salary_obligations;
  v_id uuid;
begin
  select * into v_emp from public.employees where id = p_employee_id;
  if not found then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.has_permission(v_emp.company_id, 'despesas.manage') then
    raise exception 'Sem permissão para gerar obrigação salarial';
  end if;
  if p_due_date is null then
    raise exception 'VENCIMENTO_OBRIGATORIO: informe a data de vencimento da folha desta competência';
  end if;
  if p_due_date_source not in ('payroll_calendar', 'competence_closing') then
    raise exception 'Origem de vencimento inválida: %', p_due_date_source;
  end if;

  v_comp := date_trunc('month', p_competence)::date;
  v_comp_end := (v_comp + interval '1 month - 1 day')::date;

  select x.id into v_employment from public.employee_employments x
    where x.employee_id = p_employee_id and x.start_date <= v_comp_end and (x.end_date is null or x.end_date >= v_comp)
    order by x.start_date desc limit 1;
  if v_employment is null then
    raise exception 'O colaborador não tinha vínculo vigente nesta competência';
  end if;

  v_base := public.resolve_salary_base(p_employee_id, v_comp);
  if v_base is null or v_base <= 0 then
    raise exception 'Colaborador sem salário vigente para esta competência';
  end if;

  select * into v_existing from public.salary_obligations
    where employee_id = p_employee_id and competence = v_comp for update;

  if found then
    if v_existing.base_salary = 0 and v_existing.net_amount = 0 then
      update public.salary_obligations
         set base_salary = v_base, net_amount = v_base
       where id = v_existing.id;
      perform private.record_audit_event('salary_obligation.updated', v_emp.company_id, 'salary_obligation', v_existing.id::text,
        jsonb_build_object('reason', 'reconcilia_obligacao_criada_por_vale', 'employee_id', p_employee_id,
          'employment_id', v_existing.employment_id, 'competence', v_comp, 'salary_base', v_base, 'due_date', v_existing.due_date));
    end if;
    return v_existing.id;
  end if;

  insert into public.salary_obligations (company_id, employee_id, employment_id, competence, base_salary, net_amount, status, due_date, due_date_source)
  values (v_emp.company_id, p_employee_id, v_employment, v_comp, v_base, v_base, 'ABERTO', p_due_date, p_due_date_source)
  on conflict (employee_id, competence) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.salary_obligations where employee_id = p_employee_id and competence = v_comp;
    return v_id;
  end if;

  perform private.record_audit_event('salary_obligation.created', v_emp.company_id, 'salary_obligation', v_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'employment_id', v_employment, 'competence', v_comp,
      'salary_base', v_base, 'due_date', p_due_date, 'due_date_source', p_due_date_source,
      'idempotency_key', 'salary:' || v_emp.company_id || ':' || v_employment || ':' || v_comp));
  return v_id;
end;
$$;
