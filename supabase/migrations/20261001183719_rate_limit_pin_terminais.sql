-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001183719 · md5 normalizado 5fc911681321504cad88dd6c1bcab425 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Protecao contra forca bruta de PIN nos terminais (Ponto Oris / Meu 360).
-- So service role grava/le isso - nunca exposto via PostgREST direto.
create table public.pin_attempts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  employee_id uuid,
  success boolean not null,
  created_at timestamptz not null default now()
);

alter table public.pin_attempts enable row level security;
-- Sem nenhuma policy de proposito: so service role (das Edge Functions) acessa.

create index idx_pin_attempts_device_recent on public.pin_attempts(device_id, created_at desc);

-- Limpeza: nao deixa a tabela crescer pra sempre.
create index idx_pin_attempts_created on public.pin_attempts(created_at);

create or replace function public.check_pin_rate_limit(p_device_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select count(*) < 5
  from public.pin_attempts
  where device_id = p_device_id
    and success = false
    and created_at > now() - interval '5 minutes'
$$;

create or replace function public.record_pin_attempt(p_device_id uuid, p_employee_id uuid, p_success boolean)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.pin_attempts (device_id, employee_id, success) values (p_device_id, p_employee_id, p_success)
$$;

revoke execute on function public.check_pin_rate_limit(uuid) from anon, public, authenticated;
revoke execute on function public.record_pin_attempt(uuid, uuid, boolean) from anon, public, authenticated;
grant execute on function public.check_pin_rate_limit(uuid) to service_role;
grant execute on function public.record_pin_attempt(uuid, uuid, boolean) to service_role;
;
