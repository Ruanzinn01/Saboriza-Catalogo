-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929160817 · md5 normalizado a29228c8049742735ae834863e20d49f · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 8.3 — Motor de Apuração do Ponto Óris
-- Interpreta por estado de jornada (sessões abertas/fechadas), nunca por contagem simples de batidas.

-- Evita duplicar a mesma ocorrência em aberto pro mesmo dia/tipo.
create unique index time_occurrences_open_unique
  on public.time_occurrences (employee_id, occurrence_date, occurrence_type)
  where status = 'ABERTA';

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
  inconsistency text := null;
  is_first boolean := true;
begin
  for punch in
    select type, server_time
    from public.time_punches
    where employee_id = p_employee_id
      and server_time::date = p_date
    order by server_time asc
  loop
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

  return jsonb_build_object(
    'worked_minutes', round(total_minutes)::int,
    'sessions', sessions,
    'inconsistency_type', inconsistency,
    'open_session_start', case when session_open then session_start else null end
  );
end;
$$;

-- Sincroniza a Fila de Ocorrências com o resultado do dia (chamado pelo trigger de batida).
create or replace function private.sync_day_occurrence(p_employee_id uuid, p_date date)
returns void
language plpgsql
set search_path to ''
as $$
declare
  result jsonb;
  v_inconsistency text;
begin
  result := private.compute_day(p_employee_id, p_date);
  v_inconsistency := result->>'inconsistency_type';

  if v_inconsistency is not null then
    insert into public.time_occurrences (employee_id, occurrence_date, occurrence_type, priority)
    values (p_employee_id, p_date, v_inconsistency, 'ALTA')
    on conflict (employee_id, occurrence_date, occurrence_type) where status = 'ABERTA' do nothing;
  else
    update public.time_occurrences
    set status = 'RESOLVIDA', resolved_at = now()
    where employee_id = p_employee_id
      and occurrence_date = p_date
      and status = 'ABERTA';
  end if;
end;
$$;

create or replace function private.sync_occurrence_after_punch()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  perform private.sync_day_occurrence(new.employee_id, (new.server_time)::date);
  return new;
end;
$$;

create trigger time_punches_sync_occurrence after insert on public.time_punches
  for each row execute function private.sync_occurrence_after_punch();

-- Leitura para o Espelho de Ponto (dia a dia) — permissão timesheet.apuracao.read.
create or replace function public.oris360_apurar_dia(p_employee_id uuid, p_date date)
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

create or replace function public.oris360_apurar_mes(p_employee_id uuid, p_competencia date)
returns table (dia date, worked_minutes int, inconsistency_type text, open_session_start timestamptz)
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
    inconsistency_type := result->>'inconsistency_type';
    open_session_start := (result->>'open_session_start')::timestamptz;
    return next;
    d := d + 1;
  end loop;
end;
$$;
;
