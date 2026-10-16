-- SOMENTE HOMOLOGACAO (dfynvpieyvvameftrent). Roteiro do passo 3 de supabase/pendentes/testes_homologacao.sql com UUIDs da homologacao.
-- Mapeamento: separa=separador@, producao=rot-producao@, entrega=rot-entrega@, multi=rot-multi@, gestor=gestor@, admin=legado-1@, outra=outra-empresa@ (@homolog.test).
-- Termina SEMPRE em rollback (excecao no fim).
-- ------------------------------ PASSO 3 (TESTES) ------------------------------
begin;

create temp table t_resultado (caso text, esperado text, obtido text, situacao text);
create temp table t_usuarios (classe text primary key, uid uuid);
-- >>> TROCAR pelos UUIDs reais de auth.users da homologação <<<
insert into t_usuarios values
  ('separa',  '7f1138c7-6aa7-4dc9-b74f-ac7456bfa58c'),
  ('producao','00000000-0000-4000-8000-0000000000a2'),
  ('entrega', '00000000-0000-4000-8000-0000000000a3'),
  ('multi',   '00000000-0000-4000-8000-0000000000a4'),
  ('gestor',  'd6e148cf-6cd7-4591-a864-2851418c9379'),
  ('admin',   'bdf16019-e1cb-4a1f-b920-86cf7e23452d'),
  ('outra',   '48f5cb0e-d717-4b0d-8584-1b07d11b3cf7');

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

update t_esperado set esperado = 'nada' where tabela = 'company_integration_credentials';
update t_esperado set esperado = 'parcial' where tabela = 'memberships' and classe not in ('gestor','admin');

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
    for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.rpc and (p.proname <> 'create_production' or p.pronargs = 4) loop
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
    for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.rpc and (p.proname <> 'create_production' or p.pronargs = 4) loop
      select string_agg('null::' || format_type(t, null), ',') into args from unnest((select proargtypes::oid[] from pg_proc where oid = f.oid)) t;
      perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon';
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


-- Fim: rollback incondicional via excecao; o resumo vai na mensagem de erro.
do $$
declare v_resumo text; v_falhas text;
begin
  select string_agg(situacao || '=' || n, ' ' order by situacao) into v_resumo from (select situacao, count(*) n from t_resultado group by 1) q;
  select string_agg(caso || ' | esp=' || esperado || ' | obt=' || obtido || ' | ' || situacao, E'\n' order by caso) into v_falhas from t_resultado where situacao not in ('OK');
  raise exception E'ROLLBACK_INCONDICIONAL\nRESUMO: %\nNAO-OK:\n%', v_resumo, coalesce(v_falhas, '(nenhum)');
end $$;
