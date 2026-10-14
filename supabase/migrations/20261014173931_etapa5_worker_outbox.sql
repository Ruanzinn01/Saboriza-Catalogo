-- Etapa 5 — Worker da outbox, consumidores, tentativas, reprocessamento, monitoramento e ordenação.
-- O worker é uma função (private.process_outbox_batch). NÃO há agendamento ativo: até a validação, os eventos
-- seguem apenas registrados. Para ativar depois: select cron.schedule('outbox-worker', '* * * * *', 'select private.process_outbox_batch(50)');

alter table public.transactional_outbox add column if not exists seq bigint generated always as identity;
create unique index if not exists transactional_outbox_seq_idx on public.transactional_outbox (seq);

create table if not exists public.outbox_consumers (
  name text primary key,
  description text not null,
  event_types text[] not null,
  handler text not null check (handler ~ '^private\.consume_[a-z0-9_]+$'),
  ordering text not null default 'ALL' check (ordering in ('ALL', 'LATEST_WINS')),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.outbox_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.transactional_outbox (id),
  consumer text not null references public.outbox_consumers (name),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'APPLIED', 'RETRYABLE', 'FAILED', 'SKIPPED_STALE')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbox_deliveries_event_consumer_key unique (event_id, consumer)
);
create index if not exists outbox_deliveries_due_idx on public.outbox_deliveries (status, next_attempt_at);

create table if not exists public.outbox_consumer_cursors (
  consumer text not null references public.outbox_consumers (name),
  entity_type text not null,
  entity_id text not null,
  last_seq bigint not null,
  updated_at timestamptz not null default now(),
  primary key (consumer, entity_type, entity_id)
);

-- Projeções mantidas pelos consumidores internos.
create table if not exists public.integration_event_ledger (
  event_id uuid primary key references public.transactional_outbox (id),
  seq bigint not null,
  company_id uuid,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  employee_id uuid,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null,
  entity_revision integer
);
create index if not exists integration_event_ledger_company_seq_idx on public.integration_event_ledger (company_id, seq);

create table if not exists public.integration_entity_state (
  entity_type text not null,
  entity_id text not null,
  company_id uuid,
  last_seq bigint not null,
  last_event_id uuid not null,
  last_event_type text not null,
  last_revision integer,
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

alter table public.outbox_consumers enable row level security;
alter table public.outbox_deliveries enable row level security;
alter table public.outbox_consumer_cursors enable row level security;
alter table public.integration_event_ledger enable row level security;
alter table public.integration_entity_state enable row level security;
revoke all on public.outbox_consumers, public.outbox_deliveries, public.outbox_consumer_cursors from anon, authenticated;
revoke all on public.integration_event_ledger, public.integration_entity_state from anon, authenticated;

drop policy if exists integration_event_ledger_select on public.integration_event_ledger;
create policy integration_event_ledger_select on public.integration_event_ledger
  for select using (private.has_permission(company_id, 'audit.read'));
drop policy if exists integration_entity_state_select on public.integration_entity_state;
create policy integration_entity_state_select on public.integration_entity_state
  for select using (private.has_permission(company_id, 'audit.read'));
grant select on public.integration_event_ledger, public.integration_entity_state to authenticated;

-- Consumidores internos. Cada um é idempotente por evento.
create or replace function private.consume_event_ledger(p_event public.transactional_outbox)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.integration_event_ledger
    (event_id, seq, company_id, event_type, entity_type, entity_id, employee_id, occurred_at, recorded_at, entity_revision)
  values
    (p_event.id, p_event.seq, p_event.company_id, p_event.event_type, p_event.entity_type, p_event.entity_id,
     p_event.employee_id, p_event.occurred_at, p_event.recorded_at, nullif(p_event.payload->>'entity_revision', '')::integer)
  on conflict (event_id) do nothing;
end;
$$;

create or replace function private.consume_entity_state(p_event public.transactional_outbox)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.integration_entity_state
    (entity_type, entity_id, company_id, last_seq, last_event_id, last_event_type, last_revision)
  values
    (p_event.entity_type, p_event.entity_id, p_event.company_id, p_event.seq, p_event.id, p_event.event_type,
     nullif(p_event.payload->>'entity_revision', '')::integer)
  on conflict (entity_type, entity_id) do update
    set last_seq = excluded.last_seq, last_event_id = excluded.last_event_id, last_event_type = excluded.last_event_type,
        last_revision = excluded.last_revision, company_id = excluded.company_id, updated_at = now()
    where excluded.last_seq > public.integration_entity_state.last_seq;
end;
$$;

revoke all on function private.consume_event_ledger(public.transactional_outbox) from public, anon, authenticated;
revoke all on function private.consume_entity_state(public.transactional_outbox) from public, anon, authenticated;

insert into public.outbox_consumers (name, description, event_types, handler, ordering) values
  ('event_ledger', 'Livro durável de eventos; base para recuperar lacunas por cursor', array['*'], 'private.consume_event_ledger', 'ALL'),
  ('entity_state', 'Último estado conhecido por entidade; o evento mais recente vence', array['*'], 'private.consume_entity_state', 'LATEST_WINS')
on conflict (name) do nothing;

-- Worker: distribui os eventos pendentes às entregas e processa as entregas devidas.
create or replace function private.process_outbox_batch(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  ev record;
  dv record;
  c public.outbox_consumers;
  v_event public.transactional_outbox;
  v_cursor bigint;
  v_err text;
  v_attempt integer;
  v_fanned int := 0;
  v_applied int := 0;
  v_retry int := 0;
  v_failed int := 0;
  v_stale int := 0;
begin
  for ev in
    select * from public.transactional_outbox
    where status = 'PENDING' and (next_attempt_at is null or next_attempt_at <= now())
    order by seq limit p_limit for update skip locked
  loop
    insert into public.outbox_deliveries (event_id, consumer)
    select ev.id, k.name from public.outbox_consumers k
    where k.enabled and ('*' = any (k.event_types) or ev.event_type = any (k.event_types))
    on conflict (event_id, consumer) do nothing;
    update public.transactional_outbox set status = 'PUBLISHED', published_at = now() where id = ev.id;
    v_fanned := v_fanned + 1;
  end loop;

  for dv in
    select d.id, d.event_id, d.consumer, d.attempts
    from public.outbox_deliveries d join public.transactional_outbox o on o.id = d.event_id
    where d.status in ('PENDING', 'RETRYABLE') and d.next_attempt_at <= now()
    order by o.seq limit p_limit for update of d skip locked
  loop
    select * into v_event from public.transactional_outbox where id = dv.event_id;
    select * into c from public.outbox_consumers where name = dv.consumer;
    if not found or not c.enabled then
      continue;
    end if;

    if c.ordering = 'LATEST_WINS' then
      select last_seq into v_cursor from public.outbox_consumer_cursors
        where consumer = c.name and entity_type = v_event.entity_type and entity_id = v_event.entity_id;
      if v_cursor is not null and v_event.seq <= v_cursor then
        update public.outbox_deliveries set status = 'SKIPPED_STALE', updated_at = now() where id = dv.id;
        v_stale := v_stale + 1;
        continue;
      end if;
    end if;

    begin
      execute format('select %s($1)', c.handler) using v_event;
      update public.outbox_deliveries
         set status = 'APPLIED', attempts = dv.attempts + 1, applied_at = now(), last_error = null, updated_at = now()
       where id = dv.id;
      if c.ordering = 'LATEST_WINS' then
        insert into public.outbox_consumer_cursors (consumer, entity_type, entity_id, last_seq)
        values (c.name, v_event.entity_type, v_event.entity_id, v_event.seq)
        on conflict (consumer, entity_type, entity_id) do update
          set last_seq = greatest(public.outbox_consumer_cursors.last_seq, excluded.last_seq), updated_at = now();
      end if;
      v_applied := v_applied + 1;
    exception when others then
      get stacked diagnostics v_err = message_text;
      v_attempt := dv.attempts + 1;
      if v_attempt >= c.max_attempts then
        update public.outbox_deliveries
           set status = 'FAILED', attempts = v_attempt, last_error = left(v_err, 500), updated_at = now()
         where id = dv.id;
        v_failed := v_failed + 1;
      else
        update public.outbox_deliveries
           set status = 'RETRYABLE', attempts = v_attempt, last_error = left(v_err, 500),
               next_attempt_at = now() + make_interval(mins => power(2, v_attempt)::int), updated_at = now()
         where id = dv.id;
        v_retry := v_retry + 1;
      end if;
    end;
  end loop;

  return jsonb_build_object('fanned_out', v_fanned, 'applied', v_applied, 'retryable', v_retry,
                            'failed', v_failed, 'skipped_stale', v_stale);
end;
$$;

revoke all on function private.process_outbox_batch(integer) from public, anon, authenticated;

-- Reprocessamento seguro de entrega com falha definitiva ou ignorada por ordem.
create or replace function public.outbox_reprocess_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_status text;
begin
  select o.company_id, d.status into v_company, v_status
    from public.outbox_deliveries d join public.transactional_outbox o on o.id = d.event_id
   where d.id = p_delivery_id for update of d;
  if not found then
    raise exception 'Entrega não encontrada';
  end if;
  if not private.has_permission(v_company, 'saas.company.manage') then
    raise exception 'Sem permissão para reprocessar entregas';
  end if;
  if v_status not in ('FAILED', 'SKIPPED_STALE') then
    raise exception 'Somente entrega com falha definitiva ou ignorada pode ser reprocessada (situação: %)', v_status;
  end if;
  update public.outbox_deliveries
     set status = 'RETRYABLE', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
   where id = p_delivery_id;
  perform private.record_audit_event('outbox.delivery_reprocess_requested', v_company, 'outbox_delivery', p_delivery_id::text,
    jsonb_build_object('previous_status', v_status));
end;
$$;

-- Monitoramento de acúmulo, falhas e atraso por consumidor.
create or replace function public.get_outbox_health(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_events jsonb;
  v_deliveries jsonb;
  v_consumers jsonb;
  v_alerts jsonb := '[]'::jsonb;
  v_pending int;
  v_oldest numeric;
  v_published int;
  v_failed int;
  v_retry int;
begin
  if not private.has_permission(p_company_id, 'audit.read') then
    raise exception 'Sem permissão para ver o monitoramento de eventos';
  end if;

  select count(*) filter (where status = 'PENDING'), count(*) filter (where status = 'PUBLISHED'),
         extract(epoch from now() - min(recorded_at) filter (where status = 'PENDING'))
    into v_pending, v_published, v_oldest
    from public.transactional_outbox where company_id = p_company_id;
  v_events := jsonb_build_object('pending', v_pending, 'published', v_published, 'oldest_pending_seconds', round(coalesce(v_oldest, 0)));

  select count(*) filter (where d.status = 'FAILED'), count(*) filter (where d.status = 'RETRYABLE')
    into v_failed, v_retry
    from public.outbox_deliveries d join public.transactional_outbox o on o.id = d.event_id where o.company_id = p_company_id;

  select jsonb_object_agg(s, n) into v_deliveries from (
    select d.status s, count(*) n from public.outbox_deliveries d join public.transactional_outbox o on o.id = d.event_id
    where o.company_id = p_company_id group by d.status) x;

  select coalesce(jsonb_agg(jsonb_build_object(
      'consumer', k.name, 'enabled', k.enabled,
      'pending', coalesce(t.pending, 0), 'retryable', coalesce(t.retryable, 0), 'failed', coalesce(t.failed, 0),
      'lag_seconds', round(coalesce(t.lag, 0))) order by k.name), '[]'::jsonb)
    into v_consumers
    from public.outbox_consumers k
    left join lateral (
      select count(*) filter (where d.status = 'PENDING') pending, count(*) filter (where d.status = 'RETRYABLE') retryable,
             count(*) filter (where d.status = 'FAILED') failed,
             extract(epoch from now() - min(o.recorded_at) filter (where d.status in ('PENDING', 'RETRYABLE'))) lag
      from public.outbox_deliveries d join public.transactional_outbox o on o.id = d.event_id
      where d.consumer = k.name and o.company_id = p_company_id) t on true;

  if v_pending > 0 and coalesce(v_oldest, 0) > 300 then
    v_alerts := v_alerts || to_jsonb('ACUMULO_NA_OUTBOX'::text);
  end if;
  if v_failed > 0 then
    v_alerts := v_alerts || to_jsonb('ENTREGAS_COM_FALHA_DEFINITIVA'::text);
  end if;
  if v_retry > 0 then
    v_alerts := v_alerts || to_jsonb('ENTREGAS_EM_RETENTATIVA'::text);
  end if;

  return jsonb_build_object('events', v_events, 'deliveries', coalesce(v_deliveries, '{}'::jsonb),
                            'consumers', v_consumers, 'alerts', v_alerts, 'generated_at', now());
end;
$$;

-- Recuperação de lacunas após reconexão: o consumidor guarda o último seq e pede o que veio depois.
create or replace function public.get_integration_events_since(p_company_id uuid, p_after_seq bigint default 0, p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not private.has_permission(p_company_id, 'audit.read') then
    raise exception 'Sem permissão para consultar eventos';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'seq', l.seq, 'event_id', l.event_id, 'event_type', l.event_type, 'entity_type', l.entity_type,
      'entity_id', l.entity_id, 'employee_id', l.employee_id, 'occurred_at', l.occurred_at,
      'entity_revision', l.entity_revision) order by l.seq)
    from (select * from public.integration_event_ledger
           where company_id = p_company_id and seq > p_after_seq order by seq limit least(greatest(p_limit, 1), 500)) l
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.outbox_reprocess_delivery(uuid) from public, anon;
revoke all on function public.get_outbox_health(uuid) from public, anon;
revoke all on function public.get_integration_events_since(uuid, bigint, integer) from public, anon;
grant execute on function public.outbox_reprocess_delivery(uuid) to authenticated;
grant execute on function public.get_outbox_health(uuid) to authenticated;
grant execute on function public.get_integration_events_since(uuid, bigint, integer) to authenticated;
