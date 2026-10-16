-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928152708 · md5 normalizado 800badb23926f236ee791ee83f3a4c8f · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Fase 3 / Onda 1 — Fundação SaaS/IAM
-- Aplicado após Onda 0 (reconciliação): commit real 823e03d, repo Ruanzinn01/Saboriza-Catalogo confirmados.
-- 100% aditivo: nenhuma tabela legada é tocada aqui.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  legal_name text,
  document text,
  segment text not null check (segment in ('INDUSTRY','COMMERCE','REPRESENTATION','DELIVERY')),
  default_timezone text not null default 'America/Belem',
  environment_status text not null default 'SETUP' check (environment_status in ('SETUP','ACTIVE','SUSPENDED')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','SUSPENDED')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists companies_document_unique
  on public.companies(lower(document)) where document is not null and btrim(document) <> '';

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  timezone text not null default 'America/Belem',
  document text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,name)
);
create index if not exists units_company_idx on public.units(company_id,status);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('INVITED','ACTIVE','SUSPENDED','ENDED')),
  scope_mode text not null default 'COMPANY' check (scope_mode in ('COMPANY','UNIT_LIST')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,user_id),
  unique(company_id,id),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists memberships_user_idx on public.memberships(user_id,status,company_id);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  key text not null check (btrim(key) <> ''),
  name text not null check (btrim(name) <> ''),
  description text,
  is_system boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,key),
  unique(company_id,id)
);

create table if not exists public.permissions (
  key text primary key,
  name text not null,
  description text,
  sensitivity text not null default 'NORMAL' check (sensitivity in ('NORMAL','SENSITIVE','CRITICAL')),
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  company_id uuid not null,
  role_id uuid not null,
  permission_key text not null references public.permissions(key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(role_id,permission_key),
  foreign key(company_id,role_id) references public.roles(company_id,id) on delete cascade
);
create index if not exists role_permissions_company_idx on public.role_permissions(company_id,permission_key);

create table if not exists public.membership_roles (
  company_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(membership_id,role_id),
  foreign key(company_id,membership_id) references public.memberships(company_id,id) on delete cascade,
  foreign key(company_id,role_id) references public.roles(company_id,id) on delete cascade
);
create index if not exists membership_roles_company_idx on public.membership_roles(company_id,membership_id);

create table if not exists public.membership_unit_scopes (
  company_id uuid not null,
  membership_id uuid not null,
  unit_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(membership_id,unit_id),
  foreign key(company_id,membership_id) references public.memberships(company_id,id) on delete cascade,
  foreign key(company_id,unit_id) references public.units(company_id,id) on delete cascade
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','RETIRED')),
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  unique(plan_id,version)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  plan_version_id uuid not null references public.plan_versions(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  capability_key text not null check (btrim(capability_key) <> ''),
  enabled boolean not null default true,
  source text not null default 'PLAN' check (source in ('PLAN','OVERRIDE','TRIAL','MIGRATION')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,capability_key),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED','ARCHIVED')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,version)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  schema_version integer not null default 1 check (schema_version > 0),
  company_id uuid references public.companies(id) on delete restrict,
  unit_id uuid,
  actor_type text not null check (actor_type in ('USER','SYSTEM','INTEGRATION','SUPPORT')),
  actor_user_id uuid references auth.users(id) on delete set null,
  employee_id uuid,
  entity_type text not null,
  entity_id text not null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  correlation_id uuid not null default gen_random_uuid(),
  causation_id uuid,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  foreign key(company_id,unit_id) references public.units(company_id,id) on delete restrict,
  check (unit_id is null or company_id is not null)
);
create index if not exists audit_events_company_time_idx on public.audit_events(company_id,occurred_at desc);
create index if not exists audit_events_entity_idx on public.audit_events(company_id,entity_type,entity_id,occurred_at desc);

create table if not exists public.transactional_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  schema_version integer not null default 1 check (schema_version > 0),
  company_id uuid references public.companies(id) on delete restrict,
  unit_id uuid,
  actor_type text not null check (actor_type in ('USER','SYSTEM','INTEGRATION','SUPPORT')),
  actor_user_id uuid references auth.users(id) on delete set null,
  employee_id uuid,
  entity_type text not null,
  entity_id text not null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  correlation_id uuid not null default gen_random_uuid(),
  causation_id uuid,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','PUBLISHED','FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  published_at timestamptz,
  last_error text,
  foreign key(company_id,unit_id) references public.units(company_id,id) on delete restrict,
  check (unit_id is null or company_id is not null)
);
create unique index if not exists transactional_outbox_company_idempotency_unique
  on public.transactional_outbox(company_id,idempotency_key)
  where idempotency_key is not null;
create index if not exists transactional_outbox_dispatch_idx
  on public.transactional_outbox(status,next_attempt_at,recorded_at);

create or replace function private.guard_company_id_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id é imutável; crie um novo vínculo/recurso para outra empresa';
  end if;
  return new;
end
$$;

create or replace function private.guard_membership_identity_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id
     or new.user_id is distinct from old.user_id then
    raise exception 'company_id e user_id da Membership são imutáveis';
  end if;
  return new;
end
$$;

create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'audit_events é append-only';
end
$$;

create trigger units_company_immutable before update on public.units
for each row execute function private.guard_company_id_immutable();
create trigger memberships_identity_immutable before update on public.memberships
for each row execute function private.guard_membership_identity_immutable();
create trigger roles_company_immutable before update on public.roles
for each row execute function private.guard_company_id_immutable();
create trigger onboarding_company_immutable before update on public.onboarding_checklists
for each row execute function private.guard_company_id_immutable();
create trigger audit_events_append_only before update or delete on public.audit_events
for each row execute function private.reject_audit_mutation();

revoke all on function private.guard_company_id_immutable() from public,anon,authenticated;
revoke all on function private.guard_membership_identity_immutable() from public,anon,authenticated;
revoke all on function private.reject_audit_mutation() from public,anon,authenticated;

insert into public.permissions(key,name,description,sensitivity) values
  ('saas.company.manage','Gerenciar empresa','Alterar dados estruturais da empresa.','CRITICAL'),
  ('saas.units.read','Consultar unidades','Consultar unidades autorizadas.','NORMAL'),
  ('saas.units.manage','Gerenciar unidades','Criar e manter unidades operacionais.','CRITICAL'),
  ('saas.entitlements.read','Consultar capacidades','Consultar módulos/capacidades habilitados.','NORMAL'),
  ('saas.onboarding.manage','Gerenciar implantação','Atualizar checklist de implantação.','SENSITIVE'),
  ('iam.memberships.read','Consultar acessos','Consultar vínculos de acesso da empresa.','SENSITIVE'),
  ('iam.memberships.manage','Gerenciar acessos','Criar, suspender ou encerrar Memberships.','CRITICAL'),
  ('iam.roles.read','Consultar papéis','Consultar papéis e permissões.','SENSITIVE'),
  ('iam.roles.manage','Gerenciar papéis','Alterar papéis e permissões.','CRITICAL'),
  ('audit.read','Consultar auditoria','Consultar eventos de auditoria autorizados.','SENSITIVE'),
  ('audit.read_sensitive','Consultar auditoria sensível','Consultar payloads sensíveis autorizados.','CRITICAL'),
  ('saas.support.impersonate','Acesso assistido','Autorizar acesso assistido temporário e auditado.','CRITICAL'),
  ('operations.factory.manage','Gerenciar operação da fábrica','Cadastrar/editar/excluir insumos, produtos, produção e estoque (Fases 0-4).','SENSITIVE'),
  ('operations.factory.read','Consultar operação da fábrica','Consultar insumos, produtos, produção, estoque e indicadores (Fases 0-4).','NORMAL')
on conflict(key) do update set
  name=excluded.name,
  description=excluded.description,
  sensitivity=excluded.sensitivity;

create or replace function private.active_membership_id(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.memberships m
  where m.company_id=p_company_id
    and m.user_id=(select auth.uid())
    and m.status='ACTIVE'
    and m.starts_at<=now()
    and (m.ends_at is null or m.ends_at>now())
  limit 1
$$;

create or replace function private.is_active_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.active_membership_id(p_company_id)) is not null
$$;

create or replace function private.has_permission(p_company_id uuid,p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.memberships m
    join public.membership_roles mr
      on mr.company_id=m.company_id and mr.membership_id=m.id
    join public.roles r
      on r.company_id=mr.company_id and r.id=mr.role_id and r.status='ACTIVE'
    join public.role_permissions rp
      on rp.company_id=r.company_id and rp.role_id=r.id
    where m.company_id=p_company_id
      and m.user_id=(select auth.uid())
      and m.status='ACTIVE'
      and m.starts_at<=now()
      and (m.ends_at is null or m.ends_at>now())
      and rp.permission_key=p_permission_key
  )
$$;

create or replace function private.can_access_unit(p_company_id uuid,p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.memberships m
    where m.id=(select private.active_membership_id(p_company_id))
      and (
        m.scope_mode='COMPANY'
        or exists(
          select 1 from public.membership_unit_scopes mus
          where mus.company_id=p_company_id
            and mus.membership_id=m.id
            and mus.unit_id=p_unit_id
        )
      )
  )
$$;

create or replace function private.oris360_storage_company_id(p_name text)
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when split_part(p_name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(p_name,'/',1)::uuid
    else null
  end
$$;

create or replace function private.default_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.company_id
  from public.memberships m
  where m.user_id=(select auth.uid())
    and m.status='ACTIVE'
  order by m.created_at asc
  limit 1
$$;

revoke all on function private.active_membership_id(uuid) from public,anon;
revoke all on function private.is_active_company_member(uuid) from public,anon;
revoke all on function private.has_permission(uuid,text) from public,anon;
revoke all on function private.can_access_unit(uuid,uuid) from public,anon;
revoke all on function private.oris360_storage_company_id(text) from public,anon;
revoke all on function private.default_company_id() from public,anon;
grant execute on function private.active_membership_id(uuid) to authenticated;
grant execute on function private.is_active_company_member(uuid) to authenticated;
grant execute on function private.has_permission(uuid,text) to authenticated;
grant execute on function private.can_access_unit(uuid,uuid) to authenticated;
grant execute on function private.oris360_storage_company_id(text) to authenticated;
grant execute on function private.default_company_id() to authenticated;

create or replace function public.oris360_has_permission(p_company_id uuid,p_permission_key text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_permission(p_company_id,p_permission_key)
$$;
revoke all on function public.oris360_has_permission(uuid,text) from public,anon;
grant execute on function public.oris360_has_permission(uuid,text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'companies','units','memberships','roles','permissions','role_permissions',
    'membership_roles','membership_unit_scopes','plans','plan_versions',
    'subscriptions','entitlements','onboarding_checklists','audit_events',
    'transactional_outbox'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon,authenticated',t);
  end loop;
end $$;

grant select,update on public.companies to authenticated;
grant select,insert,update,delete on public.units to authenticated;
grant select,insert,update,delete on public.memberships to authenticated;
grant select,insert,update,delete on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select,insert,delete on public.role_permissions to authenticated;
grant select,insert,update,delete on public.membership_roles to authenticated;
grant select,insert,update,delete on public.membership_unit_scopes to authenticated;
grant select on public.plans,public.plan_versions,public.subscriptions,public.entitlements to authenticated;
grant select,update on public.onboarding_checklists to authenticated;
grant select on public.audit_events to authenticated;

create policy companies_select on public.companies
  for select to authenticated
  using ((select private.is_active_company_member(id)));
create policy companies_update on public.companies
  for update to authenticated
  using ((select private.has_permission(id,'saas.company.manage')))
  with check ((select private.has_permission(id,'saas.company.manage')));

create policy units_select on public.units
  for select to authenticated
  using ((select private.can_access_unit(company_id,id)));
create policy units_insert on public.units
  for insert to authenticated
  with check ((select private.has_permission(company_id,'saas.units.manage')));
create policy units_update on public.units
  for update to authenticated
  using ((select private.has_permission(company_id,'saas.units.manage')))
  with check ((select private.has_permission(company_id,'saas.units.manage')));
create policy units_delete on public.units
  for delete to authenticated
  using ((select private.has_permission(company_id,'saas.units.manage')));

create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id=(select auth.uid())
    or (select private.has_permission(company_id,'iam.memberships.read'))
    or (select private.has_permission(company_id,'iam.memberships.manage'))
  );
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check ((select private.has_permission(company_id,'iam.memberships.manage')));
create policy memberships_update on public.memberships
  for update to authenticated
  using ((select private.has_permission(company_id,'iam.memberships.manage')))
  with check ((select private.has_permission(company_id,'iam.memberships.manage')));
create policy memberships_delete on public.memberships
  for delete to authenticated
  using ((select private.has_permission(company_id,'iam.memberships.manage')));

create policy roles_select on public.roles
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy roles_insert on public.roles
  for insert to authenticated
  with check ((select private.has_permission(company_id,'iam.roles.manage')));
create policy roles_update on public.roles
  for update to authenticated
  using ((select private.has_permission(company_id,'iam.roles.manage')))
  with check ((select private.has_permission(company_id,'iam.roles.manage')));
create policy roles_delete on public.roles
  for delete to authenticated
  using ((select private.has_permission(company_id,'iam.roles.manage')));

create policy permissions_select on public.permissions
  for select to authenticated using (true);

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy role_permissions_insert on public.role_permissions
  for insert to authenticated
  with check ((select private.has_permission(company_id,'iam.roles.manage')));
create policy role_permissions_delete on public.role_permissions
  for delete to authenticated
  using ((select private.has_permission(company_id,'iam.roles.manage')));

create policy membership_roles_select on public.membership_roles
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy membership_roles_insert on public.membership_roles
  for insert to authenticated
  with check ((select private.has_permission(company_id,'iam.roles.manage')));
create policy membership_roles_delete on public.membership_roles
  for delete to authenticated
  using ((select private.has_permission(company_id,'iam.roles.manage')));

create policy membership_unit_scopes_select on public.membership_unit_scopes
  for select to authenticated
  using (
    membership_id=(select private.active_membership_id(company_id))
    or (select private.has_permission(company_id,'iam.memberships.read'))
    or (select private.has_permission(company_id,'iam.memberships.manage'))
  );
create policy membership_unit_scopes_insert on public.membership_unit_scopes
  for insert to authenticated
  with check ((select private.has_permission(company_id,'iam.memberships.manage')));
create policy membership_unit_scopes_delete on public.membership_unit_scopes
  for delete to authenticated
  using ((select private.has_permission(company_id,'iam.memberships.manage')));

create policy plans_select on public.plans
  for select to authenticated using (true);
create policy plan_versions_select on public.plan_versions
  for select to authenticated using (true);
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy entitlements_select on public.entitlements
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy onboarding_checklists_select on public.onboarding_checklists
  for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy onboarding_checklists_update on public.onboarding_checklists
  for update to authenticated
  using ((select private.has_permission(company_id,'saas.onboarding.manage')))
  with check ((select private.has_permission(company_id,'saas.onboarding.manage')));

create policy audit_events_select on public.audit_events
  for select to authenticated
  using (company_id is not null and (select private.has_permission(company_id,'audit.read')));

insert into storage.buckets(id,name,public,file_size_limit)
values('oris360-private','oris360-private',false,26214400)
on conflict(id) do nothing;

create policy oris360_private_read
on storage.objects for select to authenticated
using (
  bucket_id='oris360-private'
  and (select private.is_active_company_member(private.oris360_storage_company_id(name)))
);

-- Seed: empresa inicial Saboriza, unidade matriz, papel Proprietário e memberships dos 2 usuários reais.
do $$
declare
  v_company_id uuid;
  v_unit_id uuid;
  v_role_id uuid;
  v_perm text;
begin
  insert into public.companies(display_name, legal_name, segment, default_timezone, environment_status, status)
  values ('Saboriza', 'Saboriza Temperos e Condimentos', 'INDUSTRY', 'America/Bahia', 'ACTIVE', 'ACTIVE')
  returning id into v_company_id;

  insert into public.units(company_id, name, timezone, status)
  values (v_company_id, 'Matriz', 'America/Bahia', 'ACTIVE')
  returning id into v_unit_id;

  insert into public.roles(company_id, key, name, description, is_system, status)
  values (v_company_id, 'OWNER', 'Proprietário', 'Acesso irrestrito à empresa durante a fundação SaaS.', true, 'ACTIVE')
  returning id into v_role_id;

  for v_perm in select key from public.permissions loop
    insert into public.role_permissions(company_id, role_id, permission_key)
    values (v_company_id, v_role_id, v_perm)
    on conflict do nothing;
  end loop;

  insert into public.memberships(company_id, user_id, status, scope_mode)
  values
    (v_company_id, 'bdf16019-e1cb-4a1f-b920-86cf7e23452d', 'ACTIVE', 'COMPANY'),
    (v_company_id, 'ffafba32-7378-4aa9-8860-66c918b87dca', 'ACTIVE', 'COMPANY')
  on conflict (company_id,user_id) do nothing;

  insert into public.membership_roles(company_id, membership_id, role_id)
  select v_company_id, m.id, v_role_id
  from public.memberships m
  where m.company_id = v_company_id
  on conflict do nothing;

  insert into public.onboarding_checklists(company_id, version, status, items)
  values (v_company_id, 1, 'IN_PROGRESS', '[]'::jsonb)
  on conflict do nothing;
end $$;

commit;
;
