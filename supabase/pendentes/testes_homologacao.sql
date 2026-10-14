-- ============================================================================================
-- ROTEIRO DE HOMOLOGAÇÃO — apps operacionais isolados
--
-- STATUS: NÃO EXECUTADO. Escrito para rodar APENAS em homologação (branch/projeto isolado), nunca em produção.
-- Um teste com rollback em produção não substitui a homologação e não é autorizado.
--
-- ORDEM:
--   PASSO 0  antes da migration: snapshot das políticas (prova de que nada mudou onde não deveria).
--   PASSO 1  aplicar supabase/pendentes/20261014180000_apps_operacionais_isolados.sql na homologação.
--   PASSO 2  criar 7 usuários de teste pelo fluxo normal (convite) e atribuir roles (ver "FIXTURES").
--   PASSO 3  rodar a parte "TESTES" abaixo, trocando os UUIDs. Tudo roda em transação e termina em rollback.
--   PASSO 4  rodar o diff de políticas (PASSO 4) e anexar a saída.
--
-- FIXTURES (criar na homologação, empresa A; usuário 7 na empresa B):
--   u_separa  = role só com separa_confere.operar        u_producao = role só com producao.operar
--   u_entrega = role só com entrega.operar               u_multi    = role com producao.operar + entrega.operar
--   u_gestor  = role com permissões de gestão (sem nenhum "operar")
--   u_admin   = role Proprietário                        u_outra    = usuário restrito da empresa B
-- Para sair de "inconclusivo", a homologação precisa ter ao menos 1 linha em cada tabela testada.
-- ============================================================================================

-- ------------------------------ PASSO 0 (ANTES da migration) ------------------------------
create schema if not exists zz_homolog;
drop table if exists zz_homolog.policy_snapshot;
create table zz_homolog.policy_snapshot as
select c.relname as tabela, p.polname, p.polpermissive, p.polcmd,
       md5(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || '|' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) as definicao
from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public';

-- ------------------------------ PASSO 3 (TESTES) ------------------------------
begin;

create temp table t_resultado (caso text, esperado text, obtido text, situacao text);
create temp table t_usuarios (classe text primary key, uid uuid);
-- >>> TROCAR pelos UUIDs reais de auth.users da homologação <<<
insert into t_usuarios values
  ('separa',  '00000000-0000-0000-0000-000000000001'),
  ('producao','00000000-0000-0000-0000-000000000002'),
  ('entrega', '00000000-0000-0000-0000-000000000003'),
  ('multi',   '00000000-0000-0000-0000-000000000004'),
  ('gestor',  '00000000-0000-0000-0000-000000000005'),
  ('admin',   '00000000-0000-0000-0000-000000000006'),
  ('outra',   '00000000-0000-0000-0000-000000000007');

-- visibilidade esperada: 'tudo' ou 'nada', por classe e tabela (derivada da matriz em docs/apps-operacionais/)
create temp table t_esperado (classe text, tabela text, esperado text);
insert into t_esperado
select c.classe, t.tabela,
  case
    when c.classe in ('gestor','admin') then 'tudo'
    when c.classe = 'separa' and t.tabela in ('orders','order_items','order_adjustment_requests','products','categories','settings','stock_movements','separation_jobs','inventory_sessions','inventory_session_items','employee_employments','group_companies') then 'tudo'
    when c.classe in ('producao','multi') and t.tabela in ('products','categories','settings','stock_movements','production_records','production_releases','floor_executions','production_plans','production_routes','raw_materials','production_diaries','diary_evaluations','diary_occurrences','diary_other_activities','urgent_demands') then 'tudo'
    when c.classe in ('entrega','multi') and t.tabela in ('products','settings','orders','order_items','order_adjustment_requests') then 'tudo'
    else 'nada'
  end
from (values ('separa'),('producao'),('entrega'),('multi'),('gestor'),('admin')) c(classe)
cross join (values
  ('orders'),('order_items'),('order_adjustment_requests'),('products'),('categories'),('settings'),('stock_movements'),
  ('separation_jobs'),('inventory_sessions'),('inventory_session_items'),('employee_employments'),('group_companies'),
  ('production_records'),('production_releases'),('floor_executions'),('production_plans'),('production_routes'),('raw_materials'),
  ('production_diaries'),('diary_evaluations'),('diary_occurrences'),('diary_other_activities'),('urgent_demands'),
  ('employees'),('employee_documents'),('customers'),('suppliers'),('loading_jobs'),('order_deliveries'),('order_delivery_items'),
  ('delivery_er_reservations'),('stock_returns'),('stock_policies'),('roles'),('role_permissions'),('membership_roles'),
  ('billings'),('receivables'),('expenses'),('salary_obligations'),('company_integration_credentials'),('memberships')
) t(tabela);

create or replace function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
end $$;

-- T1: visibilidade por tabela (leitura direta, como o app faria pela API)
do $$
declare r record; n bigint; tot bigint; obtido text;
begin
  for r in select e.classe, e.tabela, e.esperado, u.uid from t_esperado e join t_usuarios u using (classe) loop
    -- total REAL da empresa do usuário, lido como dono (antes de trocar de papel)
    execute format('select count(*) from public.%I where company_id = (select m.company_id from public.memberships m where m.user_id = $1 limit 1)', r.tabela) using r.uid into tot;
    perform pg_temp.como(r.uid);
    begin
      execute format('select count(*) from public.%I', r.tabela) into n;
      obtido := case when n = tot then 'tudo' when n = 0 then 'nada' else 'parcial' end;
    exception when others then
      obtido := 'erro:' || sqlstate;
    end;
    execute 'reset role';
    insert into t_resultado values (
      format('T1 leitura %s -> %s', r.classe, r.tabela), r.esperado, obtido,
      case when tot = 0 then 'INCONCLUSIVO (tabela vazia)' when obtido = r.esperado or (r.esperado = 'nada' and obtido like 'erro:%') then 'OK' else 'FALHOU' end);
  end loop;
end $$;

-- T2: RPCs protegidas. Bloqueado = SQLSTATE 42501 vindo da guarda. Permitido = qualquer resultado diferente de 42501.
create temp table t_rpc (rpc text, app text);
insert into t_rpc values
  ('create_production_release','producao'),('confirm_production_release','producao'),('create_production','producao'),
  ('reverse_production','producao'),('floor_advance_quantity','producao'),('floor_assume_execution','producao'),
  ('floor_complete_execution','producao'),('finalize_delivery','entrega'),('reserve_delivery_er','entrega'),
  ('publish_production_route','admin'),('operator_list_production_employees','producao'),
  ('operator_confirmed_billing_order_ids','entrega');

do $$
declare r record; f record; args text; estado text; permitido boolean; v_state text;
begin
  for r in select u.classe, u.uid, t.rpc, t.app from t_usuarios u cross join t_rpc t where u.classe <> 'outra' loop
    permitido := case r.classe
      when 'gestor' then true when 'admin' then true
      when 'multi' then r.app in ('producao','entrega')
      else r.app = case r.classe when 'producao' then 'producao' when 'entrega' then 'entrega' else 'separa_confere' end end;
    for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.rpc loop
      select string_agg('null::' || format_type(t, null), ',') into args from unnest((select proargtypes::oid[] from pg_proc where oid = f.oid)) t;
      perform pg_temp.como(r.uid);
      begin
        execute format('select * from public.%I(%s)', r.rpc, coalesce(args, ''));
        v_state := 'executou';
      exception when others then
        v_state := sqlstate;
      end;
      execute 'reset role';
      insert into t_resultado values (
        format('T2 rpc %s(%s) como %s', r.rpc, coalesce(args, ''), r.classe),
        case when permitido then 'diferente de 42501' else '42501' end, v_state,
        case when permitido and v_state <> '42501' then 'OK' when not permitido and v_state = '42501' then 'OK' else 'FALHOU' end);
    end loop;
  end loop;
end $$;

-- T3: perfil de acesso. Apps e acesso administrativo separados.
do $$
declare r record; v record;
begin
  for r in select * from t_usuarios loop
    perform pg_temp.como(r.uid);
    select * into v from public.my_app_access();
    execute 'reset role';
    insert into t_resultado values (format('T3 my_app_access %s', r.classe),
      case r.classe when 'separa' then 'apps={separa_confere} admin=false' when 'producao' then 'apps={producao} admin=false'
        when 'entrega' then 'apps={entrega} admin=false' when 'multi' then 'apps={producao,entrega} admin=false'
        else 'apps=3 admin=true' end,
      format('apps=%s admin=%s', v.apps, v.admin_access), 'CONFERIR A OLHO');
  end loop;
end $$;

-- T4: outra empresa. Nenhuma linha da empresa A pode aparecer para o usuário da empresa B (nem o contrário).
do $$
declare r record; n bigint;
begin
  for r in select * from (values ('orders'),('production_records'),('employees'),('order_deliveries'),('products')) t(tabela) loop
    perform pg_temp.como((select uid from t_usuarios where classe = 'outra'));
    execute format('select count(*) from public.%I x where x.company_id <> (select private.default_company_id())', r.tabela) into n;
    execute 'reset role';
    insert into t_resultado values (format('T4 isolamento de empresa em %s', r.tabela), '0 linhas de outra empresa', n::text, case when n = 0 then 'OK' else 'FALHOU' end);
  end loop;
end $$;

-- T5: anônimo não executa RPC de produção/entrega (grant revogado)
do $$
declare r record; f record; args text; v_state text;
begin
  for r in select * from t_rpc loop
    for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.rpc loop
      select string_agg('null::' || format_type(t, null), ',') into args from unnest((select proargtypes::oid[] from pg_proc where oid = f.oid)) t;
      execute 'set local role anon';
      begin
        execute format('select * from public.%I(%s)', r.rpc, coalesce(args, ''));
        v_state := 'executou';
      exception when others then
        v_state := sqlstate;
      end;
      execute 'reset role';
      insert into t_resultado values (format('T5 anon %s(%s)', r.rpc, coalesce(args, '')), '42501 (sem EXECUTE)', v_state, case when v_state = '42501' then 'OK' else 'FALHOU' end);
    end loop;
  end loop;
end $$;

select situacao, count(*) from t_resultado group by 1 order by 1;
select * from t_resultado where situacao not in ('OK') order by caso;

rollback;

-- ------------------------------ PASSO 4 (DEPOIS da migration): o que mudou nas políticas ------------------------------
-- Esperado: só aparecem (a) as 11 tabelas "bloqueadas mas usadas", (b) as 12 "só membro" com *_app_scope(_delete),
-- e (c) as novas *_no_restricted_operator_delete. Qualquer outra linha é regressão a explicar.
with agora as (
  select c.relname as tabela, p.polname, p.polpermissive, p.polcmd,
         md5(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || '|' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) as definicao
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public')
select coalesce(a.tabela, s.tabela) as tabela, coalesce(a.polname, s.polname) as politica,
       case when s.polname is null then 'NOVA' when a.polname is null then 'REMOVIDA' else 'ALTERADA' end as mudanca
from agora a full join zz_homolog.policy_snapshot s on s.tabela = a.tabela and s.polname = a.polname
where s.polname is null or a.polname is null or s.definicao <> a.definicao
order by 1, 2;
