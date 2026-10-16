-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929132310 · md5 normalizado 07d3252b6514c9936aa20c64d663e803 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 8.1 — Ponto Óris: fundação de dados (Terminal + Apuração + Espelho)
-- Batida original é imutável (fato capturado); ajuste é registro novo vinculado (nunca UPDATE na origem).

create type public.time_punch_type as enum ('ENTRADA','INTERVALO','RETORNO','SAIDA');

-- 1) Dispositivos autorizados do terminal (credencial separada do PIN do colaborador)
create table public.time_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  unit_id uuid references public.units(id),
  label text not null,
  credential_hash text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger time_devices_set_updated_at before update on public.time_devices
  for each row execute function public.set_updated_at();
create trigger time_devices_company_immutable before update on public.time_devices
  for each row execute function private.guard_company_id_immutable();

alter table public.time_devices enable row level security;

create policy time_devices_select on public.time_devices for select
  using (private.is_active_company_member(company_id));
create policy time_devices_insert on public.time_devices for insert
  with check (private.has_permission(company_id, 'timesheet.devices.manage'));
create policy time_devices_update on public.time_devices for update
  using (private.has_permission(company_id, 'timesheet.devices.manage'))
  with check (private.has_permission(company_id, 'timesheet.devices.manage'));

-- 2) PIN do ponto (hash — nunca texto puro, nunca em log/auditoria)
alter table public.employees add column timesheet_pin_hash text;

-- 3) Batida original — imutável, idempotente, confirmada pelo servidor
create table public.time_punches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  unit_id uuid,
  employee_id uuid not null references public.employees(id),
  device_id uuid not null references public.time_devices(id),
  type public.time_punch_type not null,
  server_time timestamptz not null default now(),
  device_reported_time timestamptz,
  photo_path text not null,
  location jsonb,
  idempotency_key text not null,
  created_by text not null default 'ponto_oris_terminal',
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create or replace function private.set_company_from_time_device()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select d.company_id, d.unit_id into new.company_id, new.unit_id
  from public.time_devices d
  where d.id = new.device_id and d.revoked_at is null;

  if new.company_id is null then
    raise exception 'dispositivo do Ponto Óris inválido ou revogado';
  end if;

  return new;
end;
$$;

create trigger time_punches_set_company before insert on public.time_punches
  for each row execute function private.set_company_from_time_device();

create or replace function private.reject_time_punch_mutation()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'time_punches é imutável — batida original nunca é alterada ou removida';
end;
$$;

create trigger time_punches_immutable before update or delete on public.time_punches
  for each row execute function private.reject_time_punch_mutation();

create index time_punches_employee_time_idx on public.time_punches (employee_id, server_time);
create index time_punches_company_idx on public.time_punches (company_id);

alter table public.time_punches enable row level security;

create policy time_punches_select on public.time_punches for select
  using (private.has_permission(company_id, 'timesheet.apuracao.read'));
-- sem policy de insert/update/delete: só service_role (edge function do terminal) grava, e mesmo essa nunca faz update/delete.

-- 4) Ajuste administrativo — nunca apaga o original, sempre novo registro com antes/depois/motivo/autor
create table public.time_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  employee_id uuid not null references public.employees(id),
  punch_id uuid references public.time_punches(id),
  adjustment_date date not null,
  field_changed text not null,
  before_value text,
  after_value text not null,
  reason text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function private.set_company_from_employee()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select e.company_id into new.company_id from public.employees e where e.id = new.employee_id;
  return new;
end;
$$;

create trigger time_adjustments_set_company before insert on public.time_adjustments
  for each row execute function private.set_company_from_employee();

create or replace function private.reject_time_adjustment_mutation()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'time_adjustments é append-only — correção cria novo registro, nunca altera o anterior';
end;
$$;

create trigger time_adjustments_immutable before update or delete on public.time_adjustments
  for each row execute function private.reject_time_adjustment_mutation();

-- Trilha cruzada com a Central Geral de Auditoria (audit_events já existente, append-only)
create or replace function private.log_time_adjustment_to_audit()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  insert into public.audit_events (
    event_type, company_id, actor_type, actor_user_id, employee_id,
    entity_type, entity_id, payload
  ) values (
    'TIME_ADJUSTMENT_CREATED', new.company_id, 'USER', auth.uid(), new.employee_id,
    'time_adjustment', new.id::text,
    jsonb_build_object(
      'punch_id', new.punch_id,
      'adjustment_date', new.adjustment_date,
      'field_changed', new.field_changed,
      'before_value', new.before_value,
      'after_value', new.after_value,
      'reason', new.reason
    )
  );
  return new;
end;
$$;

create trigger time_adjustments_audit after insert on public.time_adjustments
  for each row execute function private.log_time_adjustment_to_audit();

create index time_adjustments_employee_date_idx on public.time_adjustments (employee_id, adjustment_date);

alter table public.time_adjustments enable row level security;

create policy time_adjustments_select on public.time_adjustments for select
  using (private.has_permission(company_id, 'timesheet.apuracao.read'));
create policy time_adjustments_insert on public.time_adjustments for insert
  with check (private.has_permission(company_id, 'timesheet.apuracao.manage'));

-- 5) Fila de ocorrências — só o que exige decisão administrativa
create table public.time_occurrences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  employee_id uuid not null references public.employees(id),
  occurrence_date date not null,
  occurrence_type text not null check (occurrence_type in (
    'SEQUENCIA_INVALIDA','ABERTURA_SEM_FECHAMENTO','FECHAMENTO_SEM_ABERTURA',
    'PRIMEIRO_EVENTO_INESPERADO','BATIDA_AUSENTE','BATIDA_DUPLICADA',
    'HORARIO_INCOERENTE','SOLICITACAO_AJUSTE'
  )),
  priority text not null default 'MEDIA' check (priority in ('ALTA','MEDIA','BAIXA')),
  status text not null default 'ABERTA' check (status in ('ABERTA','RESOLVIDA')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger time_occurrences_set_company before insert on public.time_occurrences
  for each row execute function private.set_company_from_employee();
create trigger time_occurrences_set_updated_at before update on public.time_occurrences
  for each row execute function public.set_updated_at();
create trigger time_occurrences_company_immutable before update on public.time_occurrences
  for each row execute function private.guard_company_id_immutable();

create index time_occurrences_company_status_idx on public.time_occurrences (company_id, status);

alter table public.time_occurrences enable row level security;

create policy time_occurrences_select on public.time_occurrences for select
  using (private.has_permission(company_id, 'timesheet.apuracao.read'));
create policy time_occurrences_insert on public.time_occurrences for insert
  with check (private.has_permission(company_id, 'timesheet.apuracao.manage'));
create policy time_occurrences_update on public.time_occurrences for update
  using (private.has_permission(company_id, 'timesheet.apuracao.manage'))
  with check (private.has_permission(company_id, 'timesheet.apuracao.manage'));

-- 6) Estado da competência (Em apuração / Com pendências / Conferido / Consolidado / Retificado)
create table public.time_period_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  employee_id uuid not null references public.employees(id),
  competencia date not null,
  status text not null default 'EM_APURACAO' check (status in (
    'EM_APURACAO','COM_PENDENCIAS','CONFERIDO','CONSOLIDADO','RETIFICADO'
  )),
  revision_number integer not null default 1,
  consolidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, competencia, revision_number)
);

create trigger time_period_states_set_company before insert on public.time_period_states
  for each row execute function private.set_company_from_employee();
create trigger time_period_states_set_updated_at before update on public.time_period_states
  for each row execute function public.set_updated_at();
create trigger time_period_states_company_immutable before update on public.time_period_states
  for each row execute function private.guard_company_id_immutable();

alter table public.time_period_states enable row level security;

create policy time_period_states_select on public.time_period_states for select
  using (private.has_permission(company_id, 'timesheet.apuracao.read'));
create policy time_period_states_insert on public.time_period_states for insert
  with check (private.has_permission(company_id, 'timesheet.apuracao.manage'));
create policy time_period_states_update on public.time_period_states for update
  using (private.has_permission(company_id, 'timesheet.apuracao.manage'))
  with check (private.has_permission(company_id, 'timesheet.apuracao.manage'));

-- 7) Permissões novas + concessão às roles existentes (Proprietário)
insert into public.permissions (key, name, description, sensitivity) values
  ('timesheet.devices.manage', 'Gerenciar dispositivos do Ponto Óris', 'Cadastrar/revogar tablets autorizados a registrar batidas', 'CRITICAL'),
  ('timesheet.apuracao.read', 'Consultar Ponto Óris', 'Ver batidas, apuração e espelho de ponto', 'SENSITIVE'),
  ('timesheet.apuracao.manage', 'Gerenciar apuração do Ponto Óris', 'Corrigir, ajustar e liberar apuração para a folha', 'CRITICAL');

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, p.key
from public.roles r
cross join (values
  ('timesheet.devices.manage'),
  ('timesheet.apuracao.read'),
  ('timesheet.apuracao.manage')
) as p(key);
;
