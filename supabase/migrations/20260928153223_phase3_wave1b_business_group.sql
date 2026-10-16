-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928153223 · md5 normalizado be1b5e227148e267d0d9453ea7be6940 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Complemento à Onda 1 — Grupo Empresarial (opcional) acima da Empresa/Organização.
-- Hierarquia final: Plataforma -> Grupo Empresarial (opcional) -> Empresa/Organização -> Unidade -> Operação.
-- Não altera companies/units/memberships já criados: Company continua o tenant operacional isolado.
-- Grupo só habilita visão consolidada autorizada; nunca acesso operacional automático a outra empresa.

begin;

create table if not exists public.business_groups (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma empresa pertence a, no máximo, um grupo (unique em company_id). Pertencer a grupo é opcional.
create table if not exists public.group_companies (
  group_id uuid not null references public.business_groups(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (group_id, company_id),
  unique (company_id)
);
create index if not exists group_companies_group_idx on public.group_companies(group_id);

-- Autorização de grupo é independente da Membership por empresa (mesma identidade de usuário, vínculo à parte).
create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.business_groups(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('INVITED','ACTIVE','SUSPENDED','ENDED')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id),
  unique (group_id, id),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists group_memberships_user_idx on public.group_memberships(user_id, status, group_id);

create table if not exists public.group_permissions (
  key text primary key,
  name text not null,
  description text,
  sensitivity text not null default 'NORMAL' check (sensitivity in ('NORMAL','SENSITIVE','CRITICAL')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_roles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.business_groups(id) on delete restrict,
  key text not null check (btrim(key) <> ''),
  name text not null check (btrim(name) <> ''),
  description text,
  is_system boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id,key),
  unique(group_id,id)
);

create table if not exists public.group_role_permissions (
  group_id uuid not null,
  role_id uuid not null,
  permission_key text not null references public.group_permissions(key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(role_id,permission_key),
  foreign key(group_id,role_id) references public.group_roles(group_id,id) on delete cascade
);

create table if not exists public.group_membership_roles (
  group_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(membership_id,role_id),
  foreign key(group_id,membership_id) references public.group_memberships(group_id,id) on delete cascade,
  foreign key(group_id,role_id) references public.group_roles(group_id,id) on delete cascade
);
create index if not exists group_membership_roles_group_idx on public.group_membership_roles(group_id,membership_id);

insert into public.group_permissions(key,name,description,sensitivity) values
  ('group.companies.manage','Gerenciar empresas do grupo','Incluir/remover empresas do grupo empresarial.','CRITICAL'),
  ('group.dashboard.read','Consultar indicadores consolidados','Ver visão executiva consolidada do grupo (valores agregados).','SENSITIVE'),
  ('group.dashboard.read_sensitive','Consultar indicadores consolidados sensíveis','Ver quebra sensível dos indicadores consolidados do grupo.','CRITICAL'),
  ('group.memberships.manage','Gerenciar acessos do grupo','Criar/suspender/encerrar Group Memberships.','CRITICAL')
on conflict(key) do update set name=excluded.name, description=excluded.description, sensitivity=excluded.sensitivity;

-- Funções espelhando as de empresa (private.active_membership_id / is_active_company_member / has_permission),
-- mas em escopo de grupo. Never usadas para liberar dado operacional de empresa — só leitura consolidada.
create or replace function private.active_group_membership_id(p_group_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select gm.id
  from public.group_memberships gm
  where gm.group_id=p_group_id
    and gm.user_id=(select auth.uid())
    and gm.status='ACTIVE'
    and gm.starts_at<=now()
    and (gm.ends_at is null or gm.ends_at>now())
  limit 1
$$;

create or replace function private.is_active_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select private.active_group_membership_id(p_group_id)) is not null
$$;

create or replace function private.has_group_permission(p_group_id uuid,p_permission_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1
    from public.group_memberships gm
    join public.group_membership_roles gmr on gmr.group_id=gm.group_id and gmr.membership_id=gm.id
    join public.group_roles gr on gr.group_id=gmr.group_id and gr.id=gmr.role_id and gr.status='ACTIVE'
    join public.group_role_permissions grp on grp.group_id=gr.group_id and grp.role_id=gr.id
    where gm.group_id=p_group_id
      and gm.user_id=(select auth.uid())
      and gm.status='ACTIVE'
      and gm.starts_at<=now()
      and (gm.ends_at is null or gm.ends_at>now())
      and grp.permission_key=p_permission_key
  )
$$;

-- Helper: grupo ao qual a empresa pertence, se houver (para telas montarem o drill-down Grupo -> Empresa -> Unidade).
create or replace function public.oris360_group_of_company(p_company_id uuid)
returns uuid
language sql stable security invoker set search_path = ''
as $$
  select gc.group_id from public.group_companies gc where gc.company_id = p_company_id
$$;

revoke all on function private.active_group_membership_id(uuid) from public,anon;
revoke all on function private.is_active_group_member(uuid) from public,anon;
revoke all on function private.has_group_permission(uuid,text) from public,anon;
revoke all on function public.oris360_group_of_company(uuid) from public,anon;
grant execute on function private.active_group_membership_id(uuid) to authenticated;
grant execute on function private.is_active_group_member(uuid) to authenticated;
grant execute on function private.has_group_permission(uuid,text) to authenticated;
grant execute on function public.oris360_group_of_company(uuid) to authenticated;

create trigger business_groups_updated_at_noop before update on public.business_groups
for each row execute function private.guard_company_id_immutable(); -- no-op guard reused below is wrong; replaced right after

-- A guarda acima não se aplica (essa tabela não tem company_id); remover e não usar trigger indevido.
drop trigger if exists business_groups_updated_at_noop on public.business_groups;

do $$
declare t text;
begin
  foreach t in array array[
    'business_groups','group_companies','group_memberships','group_permissions',
    'group_roles','group_role_permissions','group_membership_roles'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon,authenticated',t);
  end loop;
end $$;

grant select,update on public.business_groups to authenticated;
grant select,insert,delete on public.group_companies to authenticated;
grant select,insert,update,delete on public.group_memberships to authenticated;
grant select on public.group_permissions to authenticated;
grant select,insert,update,delete on public.group_roles to authenticated;
grant select,insert,delete on public.group_role_permissions to authenticated;
grant select,insert,update,delete on public.group_membership_roles to authenticated;

create policy business_groups_select on public.business_groups for select to authenticated
  using ((select private.is_active_group_member(id)));
create policy business_groups_update on public.business_groups for update to authenticated
  using ((select private.has_group_permission(id,'group.companies.manage')))
  with check ((select private.has_group_permission(id,'group.companies.manage')));

-- group_companies é visível para quem já é membro da empresa (para saber a que grupo ela pertence)
-- ou membro do próprio grupo; gerenciar exige permissão de grupo.
create policy group_companies_select on public.group_companies for select to authenticated
  using (
    (select private.is_active_company_member(company_id))
    or (select private.is_active_group_member(group_id))
  );
create policy group_companies_insert on public.group_companies for insert to authenticated
  with check ((select private.has_group_permission(group_id,'group.companies.manage')));
create policy group_companies_delete on public.group_companies for delete to authenticated
  using ((select private.has_group_permission(group_id,'group.companies.manage')));

create policy group_memberships_select on public.group_memberships for select to authenticated
  using (
    user_id=(select auth.uid())
    or (select private.has_group_permission(group_id,'group.memberships.manage'))
  );
create policy group_memberships_insert on public.group_memberships for insert to authenticated
  with check ((select private.has_group_permission(group_id,'group.memberships.manage')));
create policy group_memberships_update on public.group_memberships for update to authenticated
  using ((select private.has_group_permission(group_id,'group.memberships.manage')))
  with check ((select private.has_group_permission(group_id,'group.memberships.manage')));
create policy group_memberships_delete on public.group_memberships for delete to authenticated
  using ((select private.has_group_permission(group_id,'group.memberships.manage')));

create policy group_permissions_select on public.group_permissions for select to authenticated using (true);

create policy group_roles_select on public.group_roles for select to authenticated
  using ((select private.is_active_group_member(group_id)));
create policy group_roles_insert on public.group_roles for insert to authenticated
  with check ((select private.has_group_permission(group_id,'group.memberships.manage')));
create policy group_roles_update on public.group_roles for update to authenticated
  using ((select private.has_group_permission(group_id,'group.memberships.manage')))
  with check ((select private.has_group_permission(group_id,'group.memberships.manage')));
create policy group_roles_delete on public.group_roles for delete to authenticated
  using ((select private.has_group_permission(group_id,'group.memberships.manage')));

create policy group_role_permissions_select on public.group_role_permissions for select to authenticated
  using ((select private.is_active_group_member(group_id)));
create policy group_role_permissions_insert on public.group_role_permissions for insert to authenticated
  with check ((select private.has_group_permission(group_id,'group.memberships.manage')));
create policy group_role_permissions_delete on public.group_role_permissions for delete to authenticated
  using ((select private.has_group_permission(group_id,'group.memberships.manage')));

create policy group_membership_roles_select on public.group_membership_roles for select to authenticated
  using ((select private.is_active_group_member(group_id)));
create policy group_membership_roles_insert on public.group_membership_roles for insert to authenticated
  with check ((select private.has_group_permission(group_id,'group.memberships.manage')));
create policy group_membership_roles_delete on public.group_membership_roles for delete to authenticated
  using ((select private.has_group_permission(group_id,'group.memberships.manage')));

commit;
;
