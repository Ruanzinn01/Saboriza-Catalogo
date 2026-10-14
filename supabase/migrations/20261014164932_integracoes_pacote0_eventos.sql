-- Integrações Mestre V2 — Pacote 0: caminho único de emissão de eventos (outbox transacional).
-- Aditivo: nenhuma tabela nova. Os fatos continuam escritos pelos donos de sempre; os gatilhos só registram o evento
-- na MESMA transação. Payload sem PIN, salário, dados bancários ou foto (contrato V2, event.public_payload_excludes).

create or replace function private.emit_event(
  p_event_type text,
  p_company_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_payload jsonb default '{}'::jsonb,
  p_employee_id uuid default null,
  p_entity_revision integer default null,
  p_idempotency_key text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.transactional_outbox (
    event_type, company_id, actor_type, actor_user_id, employee_id, entity_type, entity_id, payload, idempotency_key
  ) values (
    p_event_type, p_company_id, case when v_actor is null then 'SYSTEM' else 'USER' end, v_actor, p_employee_id,
    p_entity_type, p_entity_id,
    (coalesce(p_payload, '{}'::jsonb) - 'pin' - 'pix_key' - 'photo_path' - 'salary' - 'amount' - 'bank')
      || jsonb_strip_nulls(jsonb_build_object('entity_revision', p_entity_revision)),
    p_idempotency_key
  )
  on conflict (company_id, idempotency_key) where idempotency_key is not null do nothing;
end;
$$;

revoke all on function private.emit_event(text, uuid, text, text, jsonb, uuid, integer, text) from public, anon, authenticated;

-- Obrigação salarial: criada / vencimento alterado / valor-base reconciliado.
create or replace function private.salary_obligation_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.emit_event('salary_obligation.created', new.company_id, 'salary_obligation', new.id::text,
      jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employee_id, 'competence', new.competence,
        'due_date', new.due_date, 'due_date_source', new.due_date_source),
      new.employee_id, null, 'salary_obligation.created:' || new.id);
  else
    if new.due_date is distinct from old.due_date then
      perform private.emit_event('salary_obligation.due_date_changed', new.company_id, 'salary_obligation', new.id::text,
        jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employee_id, 'competence', new.competence,
          'due_date', new.due_date, 'previous_due_date', old.due_date, 'due_date_source', new.due_date_source),
        new.employee_id, null, 'salary_obligation.due_date_changed:' || new.id || ':' || clock_timestamp());
    end if;
    if new.base_salary is distinct from old.base_salary or new.net_amount is distinct from old.net_amount then
      perform private.emit_event('salary_obligation.updated', new.company_id, 'salary_obligation', new.id::text,
        jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employee_id, 'competence', new.competence),
        new.employee_id, null, 'salary_obligation.updated:' || new.id || ':' || clock_timestamp());
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists salary_obligations_emit_event on public.salary_obligations;
create trigger salary_obligations_emit_event
  after insert or update on public.salary_obligations
  for each row execute function private.salary_obligation_emit_event();

-- Vale: solicitado / pago / estornado. Não leva valor no payload; consumidor lê pelo id.
create or replace function private.salary_advance_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_employee uuid;
  v_competence date;
begin
  select o.employee_id, o.competence into v_employee, v_competence
    from public.salary_obligations o where o.id = new.salary_obligation_id;

  if tg_op = 'INSERT' then
    if new.status = 'ESTORNADO' and new.reversed_advance_id is not null then
      perform private.emit_event('salary_advance.reversed', new.company_id, 'salary_advance', new.reversed_advance_id::text,
        jsonb_build_object('salary_obligation_id', new.salary_obligation_id, 'employee_id', v_employee,
          'employment_id', v_employee, 'competence', v_competence, 'reversal_id', new.id),
        v_employee, null, 'salary_advance.reversed:' || new.reversed_advance_id);
    else
      perform private.emit_event('salary_advance.created', new.company_id, 'salary_advance', new.id::text,
        jsonb_build_object('salary_obligation_id', new.salary_obligation_id, 'employee_id', v_employee,
          'employment_id', v_employee, 'competence', v_competence, 'status', new.status),
        v_employee, null, 'salary_advance.created:' || new.id);
    end if;
  elsif new.status = 'PAGO' and old.status is distinct from 'PAGO' then
    perform private.emit_event('salary_advance.paid', new.company_id, 'salary_advance', new.id::text,
      jsonb_build_object('salary_obligation_id', new.salary_obligation_id, 'employee_id', v_employee,
        'employment_id', v_employee, 'competence', v_competence),
      v_employee, null, 'salary_advance.paid:' || new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists salary_advances_emit_event on public.salary_advances;
create trigger salary_advances_emit_event
  after insert or update of status on public.salary_advances
  for each row execute function private.salary_advance_emit_event();

-- Batida registrada: fato bruto, sem foto e sem PIN (evento PunchRecorded do contrato).
create or replace function private.time_punch_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform private.emit_event('punch.recorded', new.company_id, 'time_punch', new.id::text,
    jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employee_id, 'type', new.type,
      'server_time', new.server_time, 'device_id', new.device_id),
    new.employee_id, null, 'punch.recorded:' || new.id);
  return null;
end;
$$;

drop trigger if exists time_punches_emit_event on public.time_punches;
create trigger time_punches_emit_event
  after insert on public.time_punches
  for each row execute function private.time_punch_emit_event();
