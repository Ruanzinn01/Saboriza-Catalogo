-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929181730 · md5 normalizado 079f3821ef54c0c358b854a390bfc229 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 8.4 — Jornada estruturada + classificacao normal/extra/atraso + detalhe de batidas no Espelho.
-- timesheet_standard_hours etc continuam como rotulo em texto; estes campos novos sao os unicos usados pelo motor.

alter table public.employees
  add column timesheet_expected_start time,
  add column timesheet_expected_end time,
  add column timesheet_break_minutes integer not null default 0,
  add column timesheet_tolerance_minutes integer not null default 10;

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
begin
  select timesheet_expected_start, timesheet_expected_end, timesheet_break_minutes, timesheet_tolerance_minutes
  into emp
  from public.employees where id = p_employee_id;

  for punch in
    select id, type, server_time, photo_path
    from public.time_punches
    where employee_id = p_employee_id
      and server_time::date = p_date
    order by server_time asc
  loop
    punches := punches || jsonb_build_object(
      'id', punch.id, 'type', punch.type, 'server_time', punch.server_time, 'photo_path', punch.photo_path
    );

    if punch.type = 'ENTRADA' and first_entrada is null then
      first_entrada := punch.server_time;
    end if;

    if punch.type in ('ENTRADA','RETORNO') then
      if session_open then
        inconsistency := coalesce(inconsistency, 'SEQUENCIA_INVALIDA');
      elsif is_first and punch.type = 'RETORNO' then
        inconsistency := coalesce(inconsistency, 'PRIMEIRO_EVENTO_INESPERADO');
        session_open := true;
        session_start := punch.server_time;
      else
        session_open := true;
        session_start := punch.server_time;
      end if;
    else -- INTERVALO ou SAIDA
      if not session_open then
        inconsistency := coalesce(inconsistency, case when is_first then 'PRIMEIRO_EVENTO_INESPERADO' else 'SEQUENCIA_INVALIDA' end);
      else
        total_minutes := total_minutes + extract(epoch from (punch.server_time - session_start)) / 60;
        sessions := sessions || jsonb_build_object('start', session_start, 'end', punch.server_time);
        session_open := false;
      end if;
    end if;
    is_first := false;
  end loop;

  if session_open and p_date < current_date then
    inconsistency := coalesce(inconsistency, 'ABERTURA_SEM_FECHAMENTO');
  end if;

  if emp.timesheet_expected_start is not null and emp.timesheet_expected_end is not null then
    expected_minutes := greatest(0, extract(epoch from (emp.timesheet_expected_end - emp.timesheet_expected_start)) / 60 - emp.timesheet_break_minutes);
    normal_minutes := least(total_minutes, expected_minutes);
    extra_minutes := greatest(0, total_minutes - expected_minutes);

    if first_entrada is not null then
      late_minutes := greatest(0, extract(epoch from (first_entrada::time - emp.timesheet_expected_start)) / 60 - emp.timesheet_tolerance_minutes);
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

create function public.oris360_apurar_mes(p_employee_id uuid, p_competencia date)
returns table (
  dia date, worked_minutes int, normal_minutes int, extra_minutes int, late_minutes int,
  inconsistency_type text, open_session_start timestamptz
)
language plpgsql
stable
set search_path to ''
as $$
declare
  v_company_id uuid;
  d date;
  last_day date;
  result jsonb;
begin
  select company_id into v_company_id from public.employees where id = p_employee_id;
  if v_company_id is null or not private.has_permission(v_company_id, 'timesheet.apuracao.read') then
    return;
  end if;

  d := date_trunc('month', p_competencia)::date;
  last_day := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;

  while d <= last_day and d <= current_date loop
    result := private.compute_day(p_employee_id, d);
    dia := d;
    worked_minutes := (result->>'worked_minutes')::int;
    normal_minutes := (result->>'normal_minutes')::int;
    extra_minutes := (result->>'extra_minutes')::int;
    late_minutes := (result->>'late_minutes')::int;
    inconsistency_type := result->>'inconsistency_type';
    open_session_start := (result->>'open_session_start')::timestamptz;
    return next;
    d := d + 1;
  end loop;
end;
$$;

create or replace function public.oris360_apurar_dia_detalhado(p_employee_id uuid, p_date date)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select case
    when private.has_permission(
      (select company_id from public.employees where id = p_employee_id),
      'timesheet.apuracao.read'
    )
    then private.compute_day(p_employee_id, p_date)
    else null
  end
$$;
;
