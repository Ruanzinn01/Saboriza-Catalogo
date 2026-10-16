-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929154412 · md5 normalizado 13d4d402f2d907366923ee0438294c8e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 9 — Gestão de usuários por empresa (IAM)
-- RPC de leitura: lista os membros da empresa do chamador, com e-mail (auth.users não é exposto via PostgREST).

create or replace function private.list_company_members(p_company_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  status text,
  role_names text[],
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    m.id,
    m.user_id,
    u.email,
    m.status,
    coalesce(array_agg(r.name) filter (where r.name is not null), '{}'),
    m.starts_at,
    m.ends_at,
    m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.membership_roles mr on mr.membership_id = m.id and mr.company_id = m.company_id
  left join public.roles r on r.id = mr.role_id and r.company_id = m.company_id
  where m.company_id = p_company_id
  group by m.id, u.email
  order by m.created_at asc
$$;

create or replace function public.oris360_list_company_members(p_company_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  status text,
  role_names text[],
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
language sql
stable
set search_path to ''
as $$
  select *
  from private.list_company_members(p_company_id)
  where private.has_permission(p_company_id, 'iam.memberships.read')
$$;

create or replace function public.oris360_list_roles(p_company_id uuid)
returns table (id uuid, name text)
language sql
stable
set search_path to ''
as $$
  select r.id, r.name
  from public.roles r
  where r.company_id = p_company_id
    and r.status = 'ACTIVE'
    and private.has_permission(p_company_id, 'iam.roles.read')
  order by r.name
$$;
;
