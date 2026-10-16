-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930134809 · md5 normalizado 083dfed95fed29419e66283c03699295 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Base do painel platform-admin (super-admin do SaaS, separado do /admin por empresa)

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- Nenhuma policy criada de propósito: acesso só via função SECURITY DEFINER ou service role.

create or replace function public.get_platform_companies()
returns table(
  company_id uuid,
  display_name text,
  status text,
  created_at timestamptz,
  active_users bigint,
  orders_this_month bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
  select
    c.id,
    c.display_name,
    c.status,
    c.created_at,
    (select count(*) from memberships m where m.company_id = c.id and m.status = 'ACTIVE') as active_users,
    (select count(*) from orders o where o.company_id = c.id and o.created_at >= date_trunc('month', now())) as orders_this_month
  from companies c
  order by c.created_at desc;
end;
$$;

grant execute on function public.get_platform_companies() to authenticated;

create or replace function public.get_platform_company_detail(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'company', jsonb_build_object(
      'id', c.id,
      'display_name', c.display_name,
      'legal_name', c.legal_name,
      'document', c.document,
      'segment', c.segment,
      'status', c.status,
      'created_at', c.created_at
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'membership_id', m.id,
        'user_id', m.user_id,
        'email', u.email,
        'status', m.status,
        'created_at', m.created_at
      ) order by m.created_at), '[]'::jsonb)
      from memberships m
      join auth.users u on u.id = m.user_id
      where m.company_id = p_company_id
    ),
    'metrics', jsonb_build_object(
      'orders_this_month', (select count(*) from orders o where o.company_id = p_company_id and o.created_at >= date_trunc('month', now())),
      'active_users', (select count(*) from memberships m where m.company_id = p_company_id and m.status = 'ACTIVE')
    )
  ) into result
  from companies c
  where c.id = p_company_id;

  if result is null then
    raise exception 'empresa não encontrada';
  end if;

  return result;
end;
$$;

grant execute on function public.get_platform_company_detail(uuid) to authenticated;
;
