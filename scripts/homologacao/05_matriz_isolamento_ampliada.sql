-- SOMENTE HOMOLOGACAO (dfynvpieyvvameftrent). Matriz de isolamento ampliada: todas as tabelas public x 9 perfis.
-- Leituras reais sob RLS (set local role + claims). Escritas (DELETE) so dentro de subtransacao desfeita.
-- Unico efeito persistente: linhas em zz_homolog.matriz (resultado). Exige 01/02 (fixtures) e a unidade 'Filial homolog'.
-- Perfis: separa=separador@, producao=rot-producao@, entrega=rot-entrega@, multi=rot-multi@, gestor=gestor@, admin=legado-1@,
--         unidade=rot-unidade@ (gestor com escopo UNIT_LIST so na Matriz), outraB=outra-empresa@, anon.
create schema if not exists zz_homolog;
drop table if exists zz_homolog.matriz;
create table zz_homolog.matriz (perfil text, tabela text, tem_company boolean, tem_unit boolean, total_a bigint, total_b bigint,
  visivel text, vis_a bigint, vis_b bigint, vis_unit2 bigint, del_a bigint, del_b bigint, esperado text, situacao text);

do $$
declare
  a uuid := '0825487f-cff0-42cc-9442-d95ff552f75f'; b uuid := '02854143-5225-4362-b5c3-130729a7f707';
  u2 uuid := (select id from public.units where name = 'Filial homolog' limit 1);
  r record; p record; tc boolean; tu boolean; ta bigint; tb bigint; vis text; va bigint; vb bigint; vu bigint; da bigint; db bigint;
  esp text; sit text; v_total bigint; permitido_leitura boolean; permitido_escrita boolean;
begin
  create temp table t_perfis (perfil text, uid uuid, app text) on commit drop;
  insert into t_perfis values
    ('separa','7f1138c7-6aa7-4dc9-b74f-ac7456bfa58c','separa'),('producao','00000000-0000-4000-8000-0000000000a2','producao'),
    ('entrega','00000000-0000-4000-8000-0000000000a3','entrega'),('multi','00000000-0000-4000-8000-0000000000a4','multi'),
    ('gestor','d6e148cf-6cd7-4591-a864-2851418c9379',null),('admin','bdf16019-e1cb-4a1f-b920-86cf7e23452d',null),
    ('unidade','00000000-0000-4000-8000-0000000000a5',null),('outraB','48f5cb0e-d717-4b0d-8584-1b07d11b3cf7',null),('anon',null,null);
  for r in select c.relname t from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1 loop
    tc := exists (select 1 from information_schema.columns where table_schema='public' and table_name=r.t and column_name='company_id');
    tu := exists (select 1 from information_schema.columns where table_schema='public' and table_name=r.t and column_name='unit_id');
    if tc then
      execute format('select count(*) filter (where company_id=%L), count(*) filter (where company_id=%L) from public.%I', a, b, r.t) into ta, tb;
    else
      execute format('select count(*), 0 from public.%I', r.t) into ta, tb;
    end if;
    for p in select * from t_perfis loop
      vis := null; va := null; vb := null; vu := null; da := null; db := null;
      if p.perfil = 'anon' then perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon';
      else
        perform set_config('request.jwt.claims', json_build_object('sub', p.uid, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', p.uid::text, true);
        execute 'set local role authenticated';
      end if;
      begin
        if tc then
          execute format('select count(*), count(*) filter (where company_id=%L), count(*) filter (where company_id=%L) from public.%I', a, b, r.t) into v_total, va, vb;
        else
          execute format('select count(*), 0, 0 from public.%I', r.t) into v_total, va, vb;
        end if;
        vis := v_total::text;
        if tu and u2 is not null and tc then execute format('select count(*) from public.%I where unit_id=%L', r.t, u2) into vu; end if;
      exception when others then vis := 'erro:' || sqlstate; end;
      if p.perfil in ('separa','producao','entrega','multi','unidade','outraB') and vis !~ '^erro' and v_total > 0 and (tc or p.perfil <> 'outraB') then
        da := 0;
        begin
          if p.perfil = 'outraB' and tc then execute format('delete from public.%I where company_id=%L', r.t, a);
          elsif p.perfil <> 'outraB' then execute format('delete from public.%I', r.t);
          end if;
          get diagnostics da = row_count;
          raise exception 'desfaz';
        exception when others then if sqlerrm <> 'desfaz' then da := null; end if; end;
        if p.perfil <> 'outraB' and p.perfil <> 'unidade' and tc then
          begin execute format('delete from public.%I where company_id=%L', r.t, b); get diagnostics db = row_count; raise exception 'desfaz'; exception when others then if sqlerrm <> 'desfaz' then db := null; end if; end;
        end if;
      end if;
      execute 'reset role';
      -- esperado e situacao
      esp := null; sit := 'INFORMATIVO';
      if p.perfil = 'anon' then
        esp := 'nada'; sit := case when vis ~ '^erro' or vis = '0' then 'OK' when r.t in ('products','categories','settings','coupons','companies','ibge_cities') then 'PUBLICO_CATALOGO' else 'FALHOU' end;
      elsif p.perfil = 'outraB' then
        esp := 'nada de A'; sit := case when coalesce(va,0) = 0 and coalesce(da,0) = 0 then 'OK' else 'FALHOU' end;
      elsif p.perfil in ('gestor','admin') then
        esp := 'so empresa A'; sit := case when coalesce(vb,0) = 0 then 'OK' else 'FALHOU' end;
      elsif p.perfil = 'unidade' then
        esp := 'so empresa A e so Matriz'; sit := case when coalesce(vb,0) > 0 then 'FALHOU' when coalesce(vu,0) > 0 then 'GAP_UNIDADE' else 'OK' end;
      else
        permitido_leitura := p.perfil = 'multi' and exists (select 1 from public.app_table_access t where t.table_name = r.t and t.app in ('producao','entrega') and t.can_read)
          or p.perfil in ('producao','entrega') and exists (select 1 from public.app_table_access t where t.table_name = r.t and t.app = p.perfil and t.can_read)
          or p.perfil = 'separa' and r.t in ('orders','order_items','order_adjustment_requests','products','categories','settings','stock_movements','separation_jobs','inventory_sessions','inventory_session_items','employee_employments','group_companies')
          or r.t in ('memberships','companies','settings','units','permissions','group_permissions','plans','plan_versions','ibge_cities')
          or p.perfil = 'separa' and r.t = 'separation_signals';
        permitido_escrita := p.perfil = 'multi' and exists (select 1 from public.app_table_access t where t.table_name = r.t and t.app in ('producao','entrega') and t.can_write)
          or p.perfil in ('producao','entrega') and exists (select 1 from public.app_table_access t where t.table_name = r.t and t.app = p.perfil and t.can_write)
          or p.perfil = 'separa' and r.t in ('orders','order_items','order_adjustment_requests');
        esp := case when permitido_leitura then 'leitura permitida' else 'nada' end;
        sit := case
          when coalesce(vb,0) > 0 or coalesce(db,0) > 0 then 'FALHOU'
          when not permitido_leitura and vis !~ '^erro' and vis <> '0' then 'REVISAR_LEITURA'
          when not permitido_escrita and coalesce(da,0) > 0 then 'REVISAR_ESCRITA'
          else 'OK' end;
      end if;
      insert into zz_homolog.matriz values (p.perfil, r.t, tc, tu, ta, tb, vis, va, vb, vu, da, db, esp, sit);
    end loop;
  end loop;
end $$;
select perfil, situacao, count(*) from zz_homolog.matriz group by 1, 2 order by 1, 2;
