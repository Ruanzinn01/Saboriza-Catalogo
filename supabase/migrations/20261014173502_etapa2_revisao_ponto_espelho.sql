-- Etapa 2 — Ponto, apuração e Espelho.
-- (a) o dia passa a ser o dia civil no fuso da empresa (antes era UTC);
-- (b) ajustes de batida passam a entrar no cálculo, sem alterar a batida original (append-only);
-- (c) revisão imutável da apuração por competência, com conferência e consolidação;
-- (d) Espelho de Ponto emitido sobre uma revisão autorizada, com versões preservadas;
-- (e) fonte única de horas aprovadas para a etapa salarial.

-- ============ Ajustes: modelo de sobreposição ============
alter table public.time_adjustments
  add column if not exists kind text not null default 'CORRECT_TIME',
  add column if not exists punch_type text,
  add column if not exists new_time timestamptz,
  add column if not exists target_adjustment_id uuid references public.time_adjustments (id),
  add column if not exists employment_id uuid references public.employee_employments (id);

alter table public.time_adjustments drop constraint if exists time_adjustments_kind_check;
alter table public.time_adjustments add constraint time_adjustments_kind_check check (
  (kind = 'CORRECT_TIME' and punch_id is not null and new_time is not null)
  or (kind in ('VOID_PUNCH', 'RESTORE_PUNCH') and punch_id is not null)
  or (kind = 'ADD_PUNCH' and punch_id is null and new_time is not null and punch_type in ('ENTRADA', 'INTERVALO', 'RETORNO', 'SAIDA'))
  or (kind = 'VOID_ADDED' and target_adjustment_id is not null)
) not valid;

-- Escrita de ajuste só pela RPC (valida, exige motivo e audita).
revoke insert, update, delete on public.time_adjustments from anon, authenticated;

-- ============ Batidas efetivas (original + ajustes) ============
create or replace function private.effective_punches(p_employee_id uuid, p_from timestamptz, p_to timestamptz)
returns table (ref_id uuid, type text, at timestamptz, origin text, punch_id uuid, adjustment_id uuid, photo_path text)
language sql
stable
set search_path to ''
as $$
  with base as (
    select p.id, p.type::text as type, p.photo_path, p.server_time,
      (select a.new_time from public.time_adjustments a
        where a.punch_id = p.id and a.kind = 'CORRECT_TIME' and a.new_time is not null
        order by a.created_at desc, a.id desc limit 1) as corrected_at,
      (select a.id from public.time_adjustments a
        where a.punch_id = p.id and a.kind = 'CORRECT_TIME' and a.new_time is not null
        order by a.created_at desc, a.id desc limit 1) as corrected_by,
      (select a.kind from public.time_adjustments a
        where a.punch_id = p.id and a.kind in ('VOID_PUNCH', 'RESTORE_PUNCH')
        order by a.created_at desc, a.id desc limit 1) as last_void_kind
    from public.time_punches p
    where p.employee_id = p_employee_id
      and ((p.server_time >= p_from - interval '7 days' and p.server_time < p_to + interval '7 days')
           or exists (select 1 from public.time_adjustments a where a.punch_id = p.id and a.kind = 'CORRECT_TIME'))
  )
  select b.id, b.type, coalesce(b.corrected_at, b.server_time),
         case when b.corrected_at is not null then 'AJUSTADA' else 'BATIDA' end,
         b.id, b.corrected_by, b.photo_path
  from base b
  where coalesce(b.last_void_kind, '') <> 'VOID_PUNCH'
    and coalesce(b.corrected_at, b.server_time) >= p_from
    and coalesce(b.corrected_at, b.server_time) < p_to
  union all
  select a.id, a.punch_type, a.new_time, 'ADICIONADA', null::uuid, a.id, null::text
  from public.time_adjustments a
  where a.employee_id = p_employee_id and a.kind = 'ADD_PUNCH'
    and a.new_time >= p_from and a.new_time < p_to
    and not exists (select 1 from public.time_adjustments v where v.kind = 'VOID_ADDED' and v.target_adjustment_id = a.id)
$$;

-- ============ Cálculo do dia: fuso da empresa + batidas efetivas ============
create or replace function private.compute_day(p_employee_id uuid, p_date date)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  punch record;
  session_open boolean := false;
  session_start timestamptz;
  total_minutes numeric := 0;
  sessions jsonb := '[]'::jsonb;
  punches jsonb := '[]'::jsonb;
  inconsistency text := null;
  is_first boolean := true;
  first_entrada timestamptz := null;
  emp record;
  expected_minutes numeric := 0;
  normal_minutes numeric := 0;
  extra_minutes numeric := 0;
  late_minutes numeric := 0;
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
begin
  select company_id, timesheet_expected_start, timesheet_expected_end, timesheet_break_minutes, timesheet_tolerance_minutes
    into emp from public.employees where id = p_employee_id;

  v_tz := private.company_tz(emp.company_id);
  v_from := p_date::timestamp at time zone v_tz;
  v_to := (p_date + 1)::timestamp at time zone v_tz;

  for punch in
    select * from private.effective_punches(p_employee_id, v_from, v_to) order by at asc, ref_id
  loop
    punches := punches || jsonb_build_object(
      'id', punch.ref_id, 'type', punch.type, 'server_time', punch.at,
      'photo_path', punch.photo_path, 'origin', punch.origin, 'adjustment_id', punch.adjustment_id
    );

    if punch.type = 'ENTRADA' and first_entrada is null then
      first_entrada := punch.at;
    end if;

    if punch.type in ('ENTRADA', 'RETORNO') then
      if session_open then
        inconsistency := coalesce(inconsistency, 'SEQUENCIA_INVALIDA');
      elsif is_first and punch.type = 'RETORNO' then
        inconsistency := coalesce(inconsistency, 'PRIMEIRO_EVENTO_INESPERADO');
        session_open := true;
        session_start := punch.at;
      else
        session_open := true;
        session_start := punch.at;
      end if;
    else
      if not session_open then
        inconsistency := coalesce(inconsistency, case when is_first then 'PRIMEIRO_EVENTO_INESPERADO' else 'SEQUENCIA_INVALIDA' end);
      else
        total_minutes := total_minutes + extract(epoch from (punch.at - session_start)) / 60;
        sessions := sessions || jsonb_build_object('start', session_start, 'end', punch.at);
        session_open := false;
      end if;
    end if;
    is_first := false;
  end loop;

  if session_open and p_date < (now() at time zone v_tz)::date then
    inconsistency := coalesce(inconsistency, 'ABERTURA_SEM_FECHAMENTO');
  end if;

  if emp.timesheet_expected_start is not null and emp.timesheet_expected_end is not null then
    expected_minutes := greatest(0, extract(epoch from (emp.timesheet_expected_end - emp.timesheet_expected_start)) / 60 - emp.timesheet_break_minutes);
    normal_minutes := least(total_minutes, expected_minutes);
    extra_minutes := greatest(0, total_minutes - expected_minutes);
    if first_entrada is not null then
      late_minutes := greatest(0, extract(epoch from ((first_entrada at time zone v_tz)::time - emp.timesheet_expected_start)) / 60 - emp.timesheet_tolerance_minutes);
    end if;
  end if;

  return jsonb_build_object(
    'worked_minutes', round(total_minutes)::int,
    'normal_minutes', round(normal_minutes)::int,
    'extra_minutes', round(extra_minutes)::int,
    'late_minutes', round(late_minutes)::int,
    'sessions', sessions,
    'punches', punches,
    'inconsistency_type', inconsistency,
    'open_session_start', case when session_open then session_start else null end
  );
end;
$$;

-- Ocorrência do dia sincronizada pelo dia civil da empresa (antes: UTC).
create or replace function private.sync_occurrence_after_punch()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  perform private.sync_day_occurrence(new.employee_id, (new.server_time at time zone private.company_tz(new.company_id))::date);
  return new;
end;
$$;

-- ============ Revisão da apuração e Espelho ============
create table if not exists public.time_attendance_revisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  employee_id uuid not null,
  employment_id uuid references public.employee_employments (id),
  competence date not null,
  revision_number integer not null check (revision_number > 0),
  timezone text not null,
  cutoff_date date not null,
  as_of timestamptz not null default now(),
  input_digest text not null,
  pending_count integer not null default 0,
  totals jsonb not null,
  days jsonb not null,
  reason text,
  supersedes_id uuid references public.time_attendance_revisions (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint time_attendance_revisions_employee_fk foreign key (company_id, employee_id)
    references public.employees (company_id, id) on delete cascade,
  constraint time_attendance_revisions_number_key unique (employee_id, competence, revision_number)
);

create table if not exists public.time_mirrors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  employee_id uuid not null,
  employment_id uuid references public.employee_employments (id),
  competence date not null,
  version integer not null check (version > 0),
  revision_id uuid not null references public.time_attendance_revisions (id),
  content jsonb not null,
  content_hash text not null,
  issued_by uuid default auth.uid(),
  issued_at timestamptz not null default now(),
  supersedes_id uuid references public.time_mirrors (id),
  constraint time_mirrors_employee_fk foreign key (company_id, employee_id)
    references public.employees (company_id, id) on delete cascade,
  constraint time_mirrors_version_key unique (employee_id, competence, version)
);

alter table public.time_period_states
  add column if not exists revision_id uuid references public.time_attendance_revisions (id),
  add column if not exists employment_id uuid references public.employee_employments (id),
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists consolidated_by uuid;

alter table public.time_attendance_revisions enable row level security;
alter table public.time_mirrors enable row level security;
drop policy if exists time_attendance_revisions_select on public.time_attendance_revisions;
create policy time_attendance_revisions_select on public.time_attendance_revisions
  for select using (private.has_permission(company_id, 'timesheet.apuracao.read'));
drop policy if exists time_mirrors_select on public.time_mirrors;
create policy time_mirrors_select on public.time_mirrors
  for select using (private.has_permission(company_id, 'timesheet.apuracao.read'));

revoke all on public.time_attendance_revisions from anon, authenticated;
revoke all on public.time_mirrors from anon, authenticated;
grant select on public.time_attendance_revisions to authenticated;
grant select on public.time_mirrors to authenticated;
-- O estado do período só muda pelas RPCs de conferência/consolidação.
revoke insert, update, delete on public.time_period_states from anon, authenticated;

create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception '% é append-only — correção cria nova versão, nunca altera a anterior', tg_table_name;
end;
$$;

drop trigger if exists time_attendance_revisions_append_only on public.time_attendance_revisions;
create trigger time_attendance_revisions_append_only
  before update on public.time_attendance_revisions
  for each row execute function private.reject_append_only_mutation();
drop trigger if exists time_mirrors_append_only on public.time_mirrors;
create trigger time_mirrors_append_only
  before update on public.time_mirrors
  for each row execute function private.reject_append_only_mutation();

-- Resumo das entradas da competência: se mudar, a revisão fica desatualizada.
create or replace function private.attendance_digest(p_employee_id uuid, p_competence date)
returns text
language plpgsql
stable
set search_path to ''
as $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_punches text;
  v_adjustments text;
begin
  v_tz := private.company_tz((select company_id from public.employees where id = p_employee_id));
  v_from := p_competence::timestamp at time zone v_tz;
  v_to := (p_competence + interval '1 month')::timestamp at time zone v_tz;

  select string_agg(ref_id::text || '|' || type || '|' || extract(epoch from at)::text || '|' || origin, ';' order by at, ref_id)
    into v_punches from private.effective_punches(p_employee_id, v_from, v_to);
  select string_agg(a.id::text, ',' order by a.id) into v_adjustments from public.time_adjustments a
    where a.employee_id = p_employee_id and a.adjustment_date >= p_competence
      and a.adjustment_date < (p_competence + interval '1 month')::date;

  return md5(coalesce(v_punches, '') || '#' || coalesce(v_adjustments, ''));
end;
$$;

-- Estado atual (última revisão) com a leitura de desatualização.
create or replace function public.oris360_status_ponto(p_employee_id uuid, p_competencia date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_comp date := date_trunc('month', p_competencia)::date;
  v_state public.time_period_states;
  v_rev public.time_attendance_revisions;
  v_stale boolean;
  v_effective text;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null or not private.has_permission(v_company, 'timesheet.apuracao.read') then
    return null;
  end if;

  select * into v_state from public.time_period_states
    where employee_id = p_employee_id and competencia = v_comp order by revision_number desc limit 1;
  if not found then
    return jsonb_build_object('status', 'SEM_REVISAO', 'competence', v_comp);
  end if;

  select * into v_rev from public.time_attendance_revisions where id = v_state.revision_id;
  v_stale := v_rev.input_digest <> private.attendance_digest(p_employee_id, v_comp);
  v_effective := case
    when v_stale and v_state.status = 'CONFERIDO' then 'CONFERENCIA_INVALIDADA'
    when v_stale and v_state.status = 'CONSOLIDADO' then 'IMPACTO_PENDENTE'
    when v_stale then 'DESATUALIZADA'
    else v_state.status end;

  return jsonb_build_object(
    'competence', v_comp, 'revision_number', v_state.revision_number, 'revision_id', v_rev.id,
    'recorded_status', v_state.status, 'status', v_effective, 'stale', v_stale,
    'pending_count', v_rev.pending_count, 'as_of', v_rev.as_of, 'cutoff_date', v_rev.cutoff_date,
    'totals', v_rev.totals, 'employment_id', v_rev.employment_id,
    'reviewed_at', v_state.reviewed_at, 'consolidated_at', v_state.consolidated_at
  );
end;
$$;

-- Gera uma revisão (snapshot) da competência. Retry com os mesmos dados devolve a revisão existente.
create or replace function public.oris360_gerar_revisao_ponto(p_employee_id uuid, p_competencia date, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_comp date := date_trunc('month', p_competencia)::date;
  v_tz text;
  v_today date;
  v_last date;
  v_employment uuid;
  v_digest text;
  v_prev public.time_period_states;
  v_prev_rev public.time_attendance_revisions;
  d date;
  v_day jsonb;
  v_days jsonb := '[]'::jsonb;
  v_worked int := 0; v_normal int := 0; v_extra int := 0; v_late int := 0; v_pending int := 0; v_worked_days int := 0;
  v_number int;
  v_status text;
  v_id uuid;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null or not private.has_permission(v_company, 'timesheet.apuracao.manage') then
    raise exception 'Sem permissão para gerar revisão do ponto';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_employee_id::text || v_comp::text, 0));

  v_tz := private.company_tz(v_company);
  v_today := (now() at time zone v_tz)::date;
  v_last := least((v_comp + interval '1 month - 1 day')::date, v_today);
  if v_last < v_comp then
    raise exception 'Competência ainda não iniciada';
  end if;

  select x.id into v_employment from public.employee_employments x
    where x.employee_id = p_employee_id and x.start_date <= (v_comp + interval '1 month - 1 day')::date
      and (x.end_date is null or x.end_date >= v_comp)
    order by x.start_date desc limit 1;

  v_digest := private.attendance_digest(p_employee_id, v_comp);

  select * into v_prev from public.time_period_states
    where employee_id = p_employee_id and competencia = v_comp order by revision_number desc limit 1;
  if found then
    select * into v_prev_rev from public.time_attendance_revisions where id = v_prev.revision_id;
    if v_prev_rev.input_digest = v_digest and v_prev_rev.cutoff_date = v_last then
      return v_prev_rev.id;
    end if;
  end if;

  d := v_comp;
  while d <= v_last loop
    v_day := private.compute_day(p_employee_id, d);
    v_worked := v_worked + (v_day->>'worked_minutes')::int;
    v_normal := v_normal + (v_day->>'normal_minutes')::int;
    v_extra := v_extra + (v_day->>'extra_minutes')::int;
    v_late := v_late + (v_day->>'late_minutes')::int;
    if (v_day->>'worked_minutes')::int > 0 or jsonb_array_length(v_day->'punches') > 0 then
      v_worked_days := v_worked_days + 1;
    end if;
    if v_day->>'inconsistency_type' is not null then
      v_pending := v_pending + 1;
    end if;
    if jsonb_array_length(v_day->'punches') > 0 or v_day->>'inconsistency_type' is not null then
      v_days := v_days || jsonb_build_object(
        'date', d, 'worked_minutes', v_day->'worked_minutes', 'normal_minutes', v_day->'normal_minutes',
        'extra_minutes', v_day->'extra_minutes', 'late_minutes', v_day->'late_minutes',
        'inconsistency', v_day->'inconsistency_type', 'sessions', v_day->'sessions',
        'punches', v_day->'punches', 'open_session_start', v_day->'open_session_start');
    end if;
    d := d + 1;
  end loop;

  v_number := coalesce(v_prev.revision_number, 0) + 1;
  if v_prev.status = 'CONSOLIDADO' then
    if length(trim(coalesce(p_reason, ''))) < 5 then
      raise exception 'RETIFICACAO_EXIGE_MOTIVO: o período já foi consolidado; informe o motivo da retificação';
    end if;
    v_status := 'RETIFICADO';
  elsif v_pending > 0 then
    v_status := 'COM_PENDENCIAS';
  else
    v_status := 'EM_APURACAO';
  end if;

  insert into public.time_attendance_revisions
    (company_id, employee_id, employment_id, competence, revision_number, timezone, cutoff_date, input_digest,
     pending_count, totals, days, reason, supersedes_id)
  values
    (v_company, p_employee_id, v_employment, v_comp, v_number, v_tz, v_last, v_digest, v_pending,
     jsonb_build_object('worked_minutes', v_worked, 'normal_minutes', v_normal, 'extra_minutes', v_extra,
                        'late_minutes', v_late, 'worked_days', v_worked_days, 'pending_days', v_pending),
     v_days, nullif(trim(coalesce(p_reason, '')), ''), v_prev_rev.id)
  returning id into v_id;

  insert into public.time_period_states (company_id, employee_id, competencia, status, revision_number, revision_id, employment_id)
  values (v_company, p_employee_id, v_comp, v_status, v_number, v_id, v_employment);

  perform private.emit_event('attendance.revision_generated', v_company, 'attendance_revision', v_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'employment_id', v_employment, 'competence', v_comp,
      'revision_number', v_number, 'status', v_status, 'pending_count', v_pending),
    p_employee_id, v_number, 'attendance.revision_generated:' || v_id);
  perform private.record_audit_event('attendance.revision_generated', v_company, 'attendance_revision', v_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'competence', v_comp, 'revision_number', v_number,
      'status', v_status, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
  return v_id;
end;
$$;

-- Conferência: valida a revisão corrente, sem pendências e sem mudança nos dados.
create or replace function public.oris360_conferir_ponto(p_employee_id uuid, p_competencia date, p_expected_revision integer)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_comp date := date_trunc('month', p_competencia)::date;
  v_state public.time_period_states;
  v_rev public.time_attendance_revisions;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null or not private.has_permission(v_company, 'timesheet.apuracao.manage') then
    raise exception 'Sem permissão para conferir o ponto';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_employee_id::text || v_comp::text, 0));
  select * into v_state from public.time_period_states
    where employee_id = p_employee_id and competencia = v_comp order by revision_number desc limit 1 for update;
  if not found then
    raise exception 'Sem revisão para esta competência';
  end if;
  if v_state.revision_number <> p_expected_revision then
    raise exception 'REVISION_CONFLICT: a revisão corrente é % e não %', v_state.revision_number, p_expected_revision;
  end if;
  if v_state.status in ('CONFERIDO', 'CONSOLIDADO') then
    return;
  end if;

  select * into v_rev from public.time_attendance_revisions where id = v_state.revision_id;
  if v_rev.input_digest <> private.attendance_digest(p_employee_id, v_comp) then
    raise exception 'REVISION_CONFLICT: os dados do ponto mudaram depois da revisão; gere uma nova revisão';
  end if;
  if v_rev.pending_count > 0 then
    raise exception 'PENDENCIAS_ABERTAS: % dia(s) com inconsistência precisam de ajuste antes da conferência', v_rev.pending_count;
  end if;

  update public.time_period_states set status = 'CONFERIDO', reviewed_by = auth.uid(), reviewed_at = now() where id = v_state.id;
  perform private.emit_event('attendance.revision_reviewed', v_company, 'attendance_revision', v_rev.id::text,
    jsonb_build_object('employee_id', p_employee_id, 'employment_id', v_rev.employment_id, 'competence', v_comp, 'revision_number', v_state.revision_number),
    p_employee_id, v_state.revision_number, 'attendance.revision_reviewed:' || v_rev.id);
  perform private.record_audit_event('attendance.revision_reviewed', v_company, 'attendance_revision', v_rev.id::text,
    jsonb_build_object('employee_id', p_employee_id, 'competence', v_comp, 'revision_number', v_state.revision_number));
end;
$$;

-- Consolidação: só a partir de uma revisão conferida e ainda atual.
create or replace function public.oris360_consolidar_ponto(p_employee_id uuid, p_competencia date, p_expected_revision integer)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_comp date := date_trunc('month', p_competencia)::date;
  v_state public.time_period_states;
  v_rev public.time_attendance_revisions;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null or not private.has_permission(v_company, 'timesheet.apuracao.manage') then
    raise exception 'Sem permissão para consolidar o ponto';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_employee_id::text || v_comp::text, 0));
  select * into v_state from public.time_period_states
    where employee_id = p_employee_id and competencia = v_comp order by revision_number desc limit 1 for update;
  if not found then
    raise exception 'Sem revisão para esta competência';
  end if;
  if v_state.revision_number <> p_expected_revision then
    raise exception 'REVISION_CONFLICT: a revisão corrente é % e não %', v_state.revision_number, p_expected_revision;
  end if;
  if v_state.status = 'CONSOLIDADO' then
    return;
  end if;
  if v_state.status <> 'CONFERIDO' then
    raise exception 'Só uma revisão conferida pode ser consolidada (situação atual: %)', v_state.status;
  end if;

  select * into v_rev from public.time_attendance_revisions where id = v_state.revision_id;
  if v_rev.input_digest <> private.attendance_digest(p_employee_id, v_comp) then
    raise exception 'REVISION_CONFLICT: os dados do ponto mudaram depois da conferência; gere nova revisão e confira de novo';
  end if;

  update public.time_period_states
     set status = 'CONSOLIDADO', consolidated_at = now(), consolidated_by = auth.uid() where id = v_state.id;
  perform private.emit_event('attendance.revision_consolidated', v_company, 'attendance_revision', v_rev.id::text,
    jsonb_build_object('employee_id', p_employee_id, 'employment_id', v_rev.employment_id, 'competence', v_comp, 'revision_number', v_state.revision_number),
    p_employee_id, v_state.revision_number, 'attendance.revision_consolidated:' || v_rev.id);
  perform private.record_audit_event('attendance.revision_consolidated', v_company, 'attendance_revision', v_rev.id::text,
    jsonb_build_object('employee_id', p_employee_id, 'competence', v_comp, 'revision_number', v_state.revision_number));
end;
$$;

-- Ajuste de batida: valida, exige motivo e preserva a batida original.
create or replace function public.oris360_ajustar_batida(
  p_employee_id uuid,
  p_kind text,
  p_punch_id uuid default null,
  p_punch_type text default null,
  p_new_time timestamptz default null,
  p_target_adjustment_id uuid default null,
  p_reason text default null,
  p_expected_revision integer default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_tz text;
  v_punch public.time_punches;
  v_target public.time_adjustments;
  v_last_void text;
  v_before text;
  v_after text;
  v_field text;
  v_instant timestamptz;
  v_adj_date date;
  v_comp date;
  v_employment uuid;
  v_current_rev int;
  v_id uuid;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null or not private.has_permission(v_company, 'timesheet.apuracao.manage') then
    raise exception 'Sem permissão para ajustar o ponto';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo do ajuste';
  end if;
  v_tz := private.company_tz(v_company);

  if p_kind in ('CORRECT_TIME', 'VOID_PUNCH', 'RESTORE_PUNCH') then
    select * into v_punch from public.time_punches where id = p_punch_id and employee_id = p_employee_id;
    if not found then
      raise exception 'Batida não encontrada para este colaborador';
    end if;
    select a.kind into v_last_void from public.time_adjustments a
      where a.punch_id = p_punch_id and a.kind in ('VOID_PUNCH', 'RESTORE_PUNCH') order by a.created_at desc, a.id desc limit 1;
  end if;

  if p_kind = 'CORRECT_TIME' then
    if p_new_time is null or p_new_time > now() then
      raise exception 'Informe um horário válido (não pode ser futuro)';
    end if;
    if v_last_void = 'VOID_PUNCH' then
      raise exception 'Batida anulada: restaure antes de corrigir o horário';
    end if;
    v_before := coalesce((select a.new_time::text from public.time_adjustments a
      where a.punch_id = p_punch_id and a.kind = 'CORRECT_TIME' order by a.created_at desc, a.id desc limit 1), v_punch.server_time::text);
    v_after := p_new_time::text; v_field := 'server_time'; v_instant := p_new_time;
  elsif p_kind = 'VOID_PUNCH' then
    if v_last_void = 'VOID_PUNCH' then
      raise exception 'Batida já anulada';
    end if;
    v_before := 'ATIVA'; v_after := 'ANULADA'; v_field := 'void'; v_instant := v_punch.server_time;
  elsif p_kind = 'RESTORE_PUNCH' then
    if v_last_void is distinct from 'VOID_PUNCH' then
      raise exception 'Batida não está anulada';
    end if;
    v_before := 'ANULADA'; v_after := 'ATIVA'; v_field := 'restore'; v_instant := v_punch.server_time;
  elsif p_kind = 'ADD_PUNCH' then
    if p_punch_type not in ('ENTRADA', 'INTERVALO', 'RETORNO', 'SAIDA') then
      raise exception 'Tipo de batida inválido';
    end if;
    if p_new_time is null or p_new_time > now() then
      raise exception 'Informe um horário válido (não pode ser futuro)';
    end if;
    v_before := null; v_after := p_punch_type || ' ' || p_new_time::text; v_field := 'add_punch'; v_instant := p_new_time;
  elsif p_kind = 'VOID_ADDED' then
    select * into v_target from public.time_adjustments where id = p_target_adjustment_id and employee_id = p_employee_id and kind = 'ADD_PUNCH';
    if not found then
      raise exception 'Batida adicionada não encontrada';
    end if;
    if exists (select 1 from public.time_adjustments v where v.kind = 'VOID_ADDED' and v.target_adjustment_id = p_target_adjustment_id) then
      raise exception 'Batida adicionada já anulada';
    end if;
    v_before := 'ATIVA'; v_after := 'ANULADA'; v_field := 'void_added'; v_instant := v_target.new_time;
  else
    raise exception 'Tipo de ajuste inválido: %', p_kind;
  end if;

  v_adj_date := (v_instant at time zone v_tz)::date;
  v_comp := date_trunc('month', v_adj_date)::date;
  v_employment := private.employment_at(p_employee_id, v_adj_date);
  if v_employment is null then
    raise exception 'VINCULO_INVALIDO: colaborador sem vínculo vigente na data do ajuste';
  end if;

  if p_expected_revision is not null then
    select coalesce(max(revision_number), 0) into v_current_rev from public.time_period_states
      where employee_id = p_employee_id and competencia = v_comp;
    if v_current_rev <> p_expected_revision then
      raise exception 'REVISION_CONFLICT: a revisão corrente é % e não %', v_current_rev, p_expected_revision;
    end if;
  end if;

  insert into public.time_adjustments
    (company_id, employee_id, punch_id, adjustment_date, field_changed, before_value, after_value, reason, created_by,
     kind, punch_type, new_time, target_adjustment_id, employment_id)
  values
    (v_company, p_employee_id, case when p_kind in ('CORRECT_TIME', 'VOID_PUNCH', 'RESTORE_PUNCH') then p_punch_id end,
     v_adj_date, v_field, v_before, v_after, trim(p_reason), auth.uid(),
     p_kind, case when p_kind = 'ADD_PUNCH' then p_punch_type end,
     case when p_kind in ('CORRECT_TIME', 'ADD_PUNCH') then p_new_time end,
     case when p_kind = 'VOID_ADDED' then p_target_adjustment_id end, v_employment)
  returning id into v_id;
  return v_id;
end;
$$;

-- Depois de um ajuste: ocorrências do dia atualizadas e evento registrado.
create or replace function private.time_adjustment_after_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_tz text := private.company_tz(new.company_id);
begin
  perform private.sync_day_occurrence(new.employee_id, new.adjustment_date);
  if new.new_time is not null and (new.new_time at time zone v_tz)::date <> new.adjustment_date then
    perform private.sync_day_occurrence(new.employee_id, (new.new_time at time zone v_tz)::date);
  end if;
  perform private.emit_event('time_adjustment.created', new.company_id, 'time_adjustment', new.id::text,
    jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'kind', new.kind,
      'adjustment_date', new.adjustment_date, 'punch_id', new.punch_id),
    new.employee_id, null, 'time_adjustment.created:' || new.id);
  return null;
end;
$$;

drop trigger if exists time_adjustments_after_insert on public.time_adjustments;
create trigger time_adjustments_after_insert
  after insert on public.time_adjustments
  for each row execute function private.time_adjustment_after_insert();

-- Espelho de Ponto: emitido sobre revisão conferida/consolidada e atual; versões anteriores ficam preservadas.
create or replace function public.oris360_emitir_espelho(p_employee_id uuid, p_competencia date)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_emp public.employees;
  v_comp date := date_trunc('month', p_competencia)::date;
  v_state public.time_period_states;
  v_rev public.time_attendance_revisions;
  v_prev public.time_mirrors;
  v_company_name text;
  v_content jsonb;
  v_hash text;
  v_version int;
  v_id uuid;
begin
  select * into v_emp from public.employees where id = p_employee_id;
  if not found or not private.has_permission(v_emp.company_id, 'timesheet.apuracao.manage') then
    raise exception 'Sem permissão para emitir o Espelho de Ponto';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('espelho' || p_employee_id::text || v_comp::text, 0));

  select * into v_state from public.time_period_states
    where employee_id = p_employee_id and competencia = v_comp order by revision_number desc limit 1;
  if not found then
    raise exception 'Sem revisão para esta competência';
  end if;
  if v_state.status not in ('CONFERIDO', 'CONSOLIDADO') then
    raise exception 'O Espelho só é emitido sobre revisão conferida ou consolidada (situação atual: %)', v_state.status;
  end if;
  select * into v_rev from public.time_attendance_revisions where id = v_state.revision_id;
  if v_rev.input_digest <> private.attendance_digest(p_employee_id, v_comp) then
    raise exception 'REVISION_CONFLICT: os dados do ponto mudaram depois da revisão; gere nova revisão';
  end if;

  select display_name into v_company_name from public.companies where id = v_emp.company_id;

  v_content := jsonb_build_object(
    'company', v_company_name,
    'employee', jsonb_build_object(
      'name', v_emp.name, 'code', v_emp.code,
      'cpf_masked', case when v_emp.cpf is null then null else '***.***.***-' || right(regexp_replace(v_emp.cpf, '\D', '', 'g'), 2) end,
      'role', v_emp.role),
    'employment_id', v_rev.employment_id,
    'competence', v_comp,
    'timezone', v_rev.timezone,
    'revision', jsonb_build_object('number', v_rev.revision_number, 'status', v_state.status, 'cutoff_date', v_rev.cutoff_date,
                                   'as_of', v_rev.as_of, 'reason', v_rev.reason),
    'totals', v_rev.totals,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d->>'date',
        'worked_minutes', d->'worked_minutes', 'extra_minutes', d->'extra_minutes', 'late_minutes', d->'late_minutes',
        'inconsistency', d->'inconsistency',
        'punches', (select coalesce(jsonb_agg(jsonb_build_object(
            'type', p->>'type',
            'time', to_char(((p->>'server_time')::timestamptz at time zone v_rev.timezone), 'HH24:MI'),
            'origin', coalesce(p->>'origin', 'BATIDA')) order by p->>'server_time'), '[]'::jsonb)
          from jsonb_array_elements(d->'punches') p)) order by d->>'date')
      from jsonb_array_elements(v_rev.days) d), '[]'::jsonb),
    'adjustments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'date', a.adjustment_date, 'reason', a.reason,
        'before', a.before_value, 'after', a.after_value, 'author_id', a.created_by, 'at', a.created_at) order by a.created_at, a.id)
      from public.time_adjustments a
      where a.employee_id = p_employee_id and a.adjustment_date >= v_comp
        and a.adjustment_date < (v_comp + interval '1 month')::date), '[]'::jsonb)
  );
  v_hash := md5(v_content::text);

  select * into v_prev from public.time_mirrors where employee_id = p_employee_id and competence = v_comp order by version desc limit 1;
  if found and v_prev.revision_id = v_rev.id and v_prev.content_hash = v_hash then
    return v_prev.id;
  end if;
  v_version := coalesce(v_prev.version, 0) + 1;

  insert into public.time_mirrors (company_id, employee_id, employment_id, competence, version, revision_id, content, content_hash, supersedes_id)
  values (v_emp.company_id, p_employee_id, v_rev.employment_id, v_comp, v_version, v_rev.id,
          v_content || jsonb_build_object('issued_at', now(), 'version', v_version), v_hash, v_prev.id)
  returning id into v_id;

  perform private.emit_event('attendance.mirror_issued', v_emp.company_id, 'time_mirror', v_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'employment_id', v_rev.employment_id, 'competence', v_comp,
      'revision_number', v_rev.revision_number, 'version', v_version),
    p_employee_id, v_rev.revision_number, 'attendance.mirror_issued:' || v_id);
  perform private.record_audit_event('attendance.mirror_issued', v_emp.company_id, 'time_mirror', v_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'competence', v_comp, 'revision_number', v_rev.revision_number, 'version', v_version));
  return v_id;
end;
$$;

-- Fonte única de horas aprovadas (consumida pela etapa salarial): só revisão conferida/consolidada e atual.
create or replace function public.oris360_horas_aprovadas(p_employee_id uuid, p_competencia date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_comp date := date_trunc('month', p_competencia)::date;
  v_status jsonb;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null or not private.has_permission(v_company, 'timesheet.apuracao.read') then
    return null;
  end if;
  v_status := public.oris360_status_ponto(p_employee_id, v_comp);
  if v_status->>'status' not in ('CONFERIDO', 'CONSOLIDADO') then
    return jsonb_build_object('approved', false, 'competence', v_comp, 'reason',
      case v_status->>'status'
        when 'SEM_REVISAO' then 'SEM_REVISAO'
        when 'COM_PENDENCIAS' then 'PENDENCIAS_ABERTAS'
        when 'CONFERENCIA_INVALIDADA' then 'DADOS_ALTERADOS'
        when 'IMPACTO_PENDENTE' then 'DADOS_ALTERADOS'
        when 'DESATUALIZADA' then 'DADOS_ALTERADOS'
        else 'NAO_CONFERIDA' end);
  end if;
  return jsonb_build_object('approved', true, 'competence', v_comp, 'status', v_status->>'status',
    'revision_id', v_status->'revision_id', 'revision_number', v_status->'revision_number',
    'employment_id', v_status->'employment_id', 'totals', v_status->'totals');
end;
$$;

revoke all on function public.oris360_status_ponto(uuid, date) from public, anon;
revoke all on function public.oris360_gerar_revisao_ponto(uuid, date, text) from public, anon;
revoke all on function public.oris360_conferir_ponto(uuid, date, integer) from public, anon;
revoke all on function public.oris360_consolidar_ponto(uuid, date, integer) from public, anon;
revoke all on function public.oris360_ajustar_batida(uuid, text, uuid, text, timestamptz, uuid, text, integer) from public, anon;
revoke all on function public.oris360_emitir_espelho(uuid, date) from public, anon;
revoke all on function public.oris360_horas_aprovadas(uuid, date) from public, anon;
grant execute on function public.oris360_status_ponto(uuid, date) to authenticated;
grant execute on function public.oris360_gerar_revisao_ponto(uuid, date, text) to authenticated;
grant execute on function public.oris360_conferir_ponto(uuid, date, integer) to authenticated;
grant execute on function public.oris360_consolidar_ponto(uuid, date, integer) to authenticated;
grant execute on function public.oris360_ajustar_batida(uuid, text, uuid, text, timestamptz, uuid, text, integer) to authenticated;
grant execute on function public.oris360_emitir_espelho(uuid, date) to authenticated;
grant execute on function public.oris360_horas_aprovadas(uuid, date) to authenticated;
