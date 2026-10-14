-- ============================================================================================
-- APPS OPERACIONAIS ISOLADOS (Produziu Registra, Entrega Registra, Separa Confere)
--
-- STATUS: RASCUNHO VERSIONADO. NÃO APLICADO EM NENHUM BANCO. NÃO VALIDADO.
-- NÃO aplicar em produção. Aplicar primeiro em homologação (branch/projeto isolado), rodar
-- supabase/pendentes/testes_homologacao.sql e anexar as evidências. Ver docs/apps-operacionais/.
--
-- Fica em supabase/pendentes/ (e não em supabase/migrations/) de propósito: nenhum `db push` o pega.
--
-- Premissas verificadas por leitura do catálogo de produção em 2026-10-14 (nenhuma escrita):
--  * private.is_restricted_operator(company) = tem 'separa_confere.operar'; usada por 42 políticas RESTRICTIVE.
--  * Nenhuma role em produção tem 'separa_confere.operar' hoje (2 roles "Proprietário", 47 permissões cada).
--  * Gravações de produção/entrega passam por RPCs SECURITY DEFINER que NÃO checam permissão nem restrição.
--  * Apps novos precisam de tabelas hoje bloqueadas ao operador restrito (production_*, floor_*, diary_*...).
--
-- Compatibilidade: my_access_profile() e is_restricted_operator() mantêm assinatura e semântica para
-- quem só tem separa_confere.operar. Perfil novo é uma função nova (my_app_access).
-- ============================================================================================

-- 1) Permissões. "<app>.operar" autoriza o app. "admin.acessar" mantém o painel para quem também opera apps.
insert into public.permissions (key, name, description, sensitivity) values
  ('producao.operar', 'Operador do Produziu Registra',
   'Autoriza usar o app Produziu Registra com a própria conta. Quem tem apenas permissões "operar" fica confinado aos apps autorizados.', 'SENSITIVE'),
  ('entrega.operar', 'Operador do Entrega Registra',
   'Autoriza usar o app Entrega Registra com a própria conta. Quem tem apenas permissões "operar" fica confinado aos apps autorizados.', 'SENSITIVE'),
  ('admin.acessar', 'Acesso ao painel administrativo',
   'Mantém o acesso ao painel administrativo de quem também recebe permissões "operar". Sem ela, quem tem qualquer "operar" fica confinado.', 'SENSITIVE')
on conflict (key) do nothing;

-- 2) Permissões relevantes numa consulta só (as políticas rodam por linha: nada de 3 a 4 has_permission por linha).
--    Mesmos joins de private.has_permission (lidos de produção em 2026-10-14).
create or replace function private.operator_perm_keys(p_company_id uuid)
returns text[]
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(array_agg(distinct rp.permission_key), '{}'::text[])
  from public.memberships m
  join public.membership_roles mr on mr.company_id = m.company_id and mr.membership_id = m.id
  join public.roles r on r.company_id = mr.company_id and r.id = mr.role_id and r.status = 'ACTIVE'
  join public.role_permissions rp on rp.company_id = r.company_id and rp.role_id = r.id
  where m.company_id = p_company_id
    and m.user_id = (select auth.uid())
    and m.status = 'ACTIVE'
    and m.starts_at <= now()
    and (m.ends_at is null or m.ends_at > now())
    and rp.permission_key in ('separa_confere.operar', 'producao.operar', 'entrega.operar', 'admin.acessar')
$$;

revoke all on function private.operator_perm_keys(uuid) from public, anon;

-- Apps autorizados e restrição. Restrito = tem algum "operar" e não tem admin.acessar.
create or replace function private.operator_apps(p_company_id uuid)
returns text[]
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(array_remove(array[
    case when 'separa_confere.operar' = any (k.keys) then 'separa_confere' end,
    case when 'producao.operar' = any (k.keys) then 'producao' end,
    case when 'entrega.operar' = any (k.keys) then 'entrega' end
  ], null), '{}'::text[])
  from (select private.operator_perm_keys(p_company_id) as keys) k
$$;

revoke all on function private.operator_apps(uuid) from public, anon;

create or replace function private.is_restricted_operator(p_company_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select k.keys && array['separa_confere.operar', 'producao.operar', 'entrega.operar']
     and not ('admin.acessar' = any (k.keys))
  from (select private.operator_perm_keys(p_company_id) as keys) k
$$;

revoke all on function private.is_restricted_operator(uuid) from public, anon;

-- 3) Matriz app x tabela. Dado auditável, lido pelas políticas. Sem política = ninguém lê direto (só funções DEFINER).
create table if not exists public.app_table_access (
  app text not null check (app in ('separa_confere', 'producao', 'entrega')),
  table_name text not null,
  can_read boolean not null default true,
  can_write boolean not null default false,
  primary key (app, table_name)
);
alter table public.app_table_access enable row level security;
revoke all on public.app_table_access from public, anon, authenticated;

-- Derivada da leitura estática do código (ver docs/apps-operacionais/MATRIZ_PERMISSOES.md). Separa Confere NÃO tem linhas
-- aqui: quem tem separa_confere.operar mantém exatamente o acesso atual (ver is_app_scope_allowed).
insert into public.app_table_access (app, table_name, can_read, can_write) values
  ('producao', 'products', true, false),
  ('producao', 'categories', true, false),
  ('producao', 'settings', true, false),
  ('producao', 'stock_movements', true, false),
  ('producao', 'production_records', true, false),
  ('producao', 'production_releases', true, false),
  ('producao', 'floor_executions', true, false),
  ('producao', 'production_plans', true, false),
  ('producao', 'production_routes', true, false),
  ('producao', 'raw_materials', true, false),
  ('producao', 'production_diaries', true, true),
  ('producao', 'diary_evaluations', true, true),
  ('producao', 'diary_occurrences', true, true),
  ('producao', 'diary_other_activities', true, true),
  ('producao', 'urgent_demands', true, true),
  ('entrega', 'products', true, false),
  ('entrega', 'settings', true, false),
  ('entrega', 'orders', true, true),
  ('entrega', 'order_items', true, true),
  ('entrega', 'order_adjustment_requests', true, true)
on conflict (app, table_name) do nothing;

-- p_separa_open=true (tabelas que qualquer membro lê hoje): quem tem separa_confere.operar mantém o acesso atual.
-- p_separa_open=false (tabelas que o V3 bloqueia ao restrito): separa continua BLOQUEADO; só a matriz libera producao/entrega.
create or replace function private.is_app_scope_allowed(p_company_id uuid, p_table text, p_write boolean, p_separa_open boolean)
returns boolean
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  k text[] := private.operator_perm_keys(p_company_id);
begin
  if not (k && array['separa_confere.operar', 'producao.operar', 'entrega.operar']) or 'admin.acessar' = any (k) then
    return true;
  end if;
  if p_separa_open and 'separa_confere.operar' = any (k) then
    return true;
  end if;
  return exists (
    select 1 from public.app_table_access t
    where t.table_name = p_table
      and ((t.app = 'producao' and 'producao.operar' = any (k)) or (t.app = 'entrega' and 'entrega.operar' = any (k)))
      and (case when p_write then t.can_write else t.can_read end)
  );
end;
$$;

revoke all on function private.is_app_scope_allowed(uuid, text, boolean, boolean) from public, anon;

-- 4a) Tabelas JÁ bloqueadas ao restrito (lista do V3) e que algum app novo usa: política passa a consultar a matriz.
--     Para quem só tem separa_confere.operar continua negado, como hoje (não há linha de separa_confere na matriz).
do $$
declare
  t text;
  blocked_but_needed text[] := array[
    'production_records', 'production_releases', 'floor_executions', 'production_plans', 'production_routes',
    'raw_materials', 'production_diaries', 'diary_evaluations', 'diary_occurrences', 'diary_other_activities', 'urgent_demands'
  ];
begin
  foreach t in array blocked_but_needed loop
    if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t and c.column_name = 'company_id') then
      execute format('drop policy if exists %I on public.%I', t || '_no_restricted_operator', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using ((select private.is_app_scope_allowed(company_id, %L, false, false))) with check ((select private.is_app_scope_allowed(company_id, %L, true, false)))',
        t || '_no_restricted_operator', t, t, t);
      execute format('drop policy if exists %I on public.%I', t || '_no_restricted_operator_delete', t);
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using ((select private.is_app_scope_allowed(company_id, %L, true, false)))',
        t || '_no_restricted_operator_delete', t, t);
    end if;
  end loop;
end $$;

-- 4b) Tabelas que QUALQUER membro lê hoje (política só de membro) e que o restrito não precisa: fecha para apps novos,
--     sem mexer em quem tem separa_confere.operar.
do $$
declare
  t text;
  member_only text[] := array[
    'categories', 'products', 'settings', 'employee_employments', 'group_companies', 'inventory_session_items',
    'inventory_sessions', 'order_adjustment_requests', 'order_items', 'orders', 'separation_jobs', 'stock_movements'
  ];
begin
  foreach t in array member_only loop
    if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t and c.column_name = 'company_id') then
      execute format('drop policy if exists %I on public.%I', t || '_app_scope', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using ((select private.is_app_scope_allowed(company_id, %L, false, true))) with check ((select private.is_app_scope_allowed(company_id, %L, true, true)))',
        t || '_app_scope', t, t, t);
      execute format('drop policy if exists %I on public.%I', t || '_app_scope_delete', t);
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using ((select private.is_app_scope_allowed(company_id, %L, true, true)))',
        t || '_app_scope_delete', t, t);
    end if;
  end loop;
end $$;

-- 5) Guarda das RPCs. Restrito só passa no app que tem; 'admin' nunca passa para restrito.
create or replace function private.assert_app_access(p_app text)
returns void
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_keys text[];
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if v_company is null then
    raise exception 'Empresa não identificada' using errcode = '42501';
  end if;
  v_keys := private.operator_perm_keys(v_company);
  -- não restrito (sem nenhum "operar", ou com admin.acessar): passa, como hoje
  if not (v_keys && array['separa_confere.operar', 'producao.operar', 'entrega.operar']) or 'admin.acessar' = any (v_keys) then
    return;
  end if;
  -- restrito: só o app que tem; 'admin' nunca passa
  if p_app = 'admin' or not ((p_app || '.operar') = any (v_keys) or (p_app = 'separa_confere' and 'separa_confere.operar' = any (v_keys))) then
    raise exception 'Sem acesso a este app' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_app_access(text) from public, anon;

-- 5a) Injeta a guarda na PRIMEIRA linha executável de cada RPC, a partir da definição VIVA no banco (as migrations do
--     repositório não contêm esses corpos). Idempotente. Falha fechada: se não achar o ponto de inserção, aborta tudo.
do $$
declare
  r record;
  v_def text;
  v_new text;
  targets constant text[][] := array[
    ['create_production_release', 'producao'], ['confirm_production_release', 'producao'], ['create_production', 'producao'],
    ['reverse_production', 'producao'], ['floor_advance_quantity', 'producao'], ['floor_assume_execution', 'producao'],
    ['floor_complete_execution', 'producao'], ['finalize_delivery', 'entrega'], ['reserve_delivery_er', 'entrega'],
    ['publish_production_route', 'admin']
  ];
  i int;
begin
  for i in 1 .. array_length(targets, 1) loop
    for r in
      select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = targets[i][1]
    loop
      v_def := pg_get_functiondef(r.oid);
      if v_def like '%private.assert_app_access%' then continue; end if;
      v_new := regexp_replace(v_def, '(\mbegin\M)', E'\\1\n  perform private.assert_app_access(''' || targets[i][2] || ''');', 'i');
      if v_new = v_def or position('$function$' in v_new) = 0
         or position('assert_app_access' in v_new) < position('$function$' in v_new) then
        raise exception 'Não foi possível injetar a guarda em %: revisar manualmente', r.oid::regprocedure;
      end if;
      execute v_new;
    end loop;
  end loop;
end $$;

-- 5b) Anônimo não executa RPC de produção/entrega. Estavam abertas a anon: confirm_production_release, create_production
--     (2 sobrecargas), reverse_production. A guarda acima já exige auth.uid(), mas o grant não deve existir.
do $$
declare r record;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('confirm_production_release', 'create_production', 'reverse_production', 'create_production_release',
                        'floor_advance_quantity', 'floor_assume_execution', 'floor_complete_execution', 'finalize_delivery',
                        'reserve_delivery_er', 'publish_production_route')
  loop
    execute format('revoke execute on function %s from public, anon', r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated', r.oid::regprocedure);
  end loop;
end $$;

-- 6) Perfil novo: apps e acesso administrativo separados. my_access_profile() fica como está (clientes antigos).
create or replace function public.my_app_access()
returns table (company_id uuid, apps text[], admin_access boolean, restricted boolean, can_manage_inventory boolean)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_restricted boolean;
begin
  if (select auth.uid()) is null or v_company is null then return; end if;
  v_restricted := (select private.is_restricted_operator(v_company));
  return query select
    v_company,
    case when v_restricted then (select private.operator_apps(v_company))
         else array['separa_confere', 'producao', 'entrega']::text[] end,
    not v_restricted,
    v_restricted,
    (select private.inventory_can_manage(v_company));
end;
$$;

revoke all on function public.my_app_access() from public, anon;
grant execute on function public.my_app_access() to authenticated;

-- 7) Leitura mínima para o Produziu: o app lê colaboradores com select(*) (CPF, salário, PIX). Aqui só identificação.
create or replace function public.operator_list_production_employees()
returns table (id uuid, code text, name text, status text, can_operate_production boolean, photo_url text, unit_id uuid)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  perform private.assert_app_access('producao');
  return query
    select e.id, e.code::text, e.name::text, e.status::text, e.can_operate_production, e.photo_url::text, e.unit_id
    from public.employees e
    where e.company_id = v_company
    order by e.name;
end;
$$;

revoke all on function public.operator_list_production_employees() from public, anon;
grant execute on function public.operator_list_production_employees() to authenticated;

-- 8) Leitura mínima para o Entrega: a fila só mostra pedido com faturamento CONFIRMADO, mas billings exige permissão financeira.
create or replace function public.operator_confirmed_billing_order_ids(p_order_ids uuid[])
returns table (order_id uuid)
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  perform private.assert_app_access('entrega');
  return query
    select b.order_id
    from public.billings b
    where b.company_id = v_company
      and b.order_id = any (p_order_ids)
      and b.status = 'CONFIRMADO';
end;
$$;

revoke all on function public.operator_confirmed_billing_order_ids(uuid[]) from public, anon;
grant execute on function public.operator_confirmed_billing_order_ids(uuid[]) to authenticated;
