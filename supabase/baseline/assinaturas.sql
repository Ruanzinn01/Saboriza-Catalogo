-- Assinaturas de equivalência do schema (mesma consulta em produção e no replay). Somente leitura.
-- Cada linha: categoria, quantidade e hash do conjunto ordenado.
select 'colunas' k, count(*)::text n,
  md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,''), '|' order by table_name, column_name)) h
from information_schema.columns where table_schema='public'
union all
select 'funcoes_corpo', count(*)::text,
  md5(string_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(pg_get_functiondef(p.oid)), '|' order by n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind in ('f','p') and p.proname <> 'gen_random_bytes'
union all
select 'politicas_definicao', count(*)::text,
  md5(string_agg(tablename||'.'||policyname||':'||cmd||':'||permissive||':'||roles::text||':'||coalesce(qual,'')||':'||coalesce(with_check,''), '|' order by tablename||'.'||policyname))
from pg_policies where schemaname='public'
union all
select 'grants_tabelas', count(*)::text,
  md5(string_agg(table_name||':'||grantee||':'||privilege_type, '|' order by table_name, grantee, privilege_type))
from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')
union all
select 'constraints', count(*)::text,
  md5(string_agg(c.relname||'.'||con.conname||':'||pg_get_constraintdef(con.oid), '|' order by c.relname||'.'||con.conname))
from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
union all
select 'indices', count(*)::text,
  md5(string_agg(indexdef, '|' order by indexdef))
from pg_indexes where schemaname='public'
union all
select 'gatilhos_definicao', count(*)::text,
  md5(string_agg(c.relname||'.'||t.tgname||':'||pg_get_triggerdef(t.oid), '|' order by c.relname||'.'||t.tgname))
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
union all
select 'visoes', count(*)::text,
  md5(string_agg(schemaname||'.'||viewname||':'||regexp_replace(definition, '\s+', ' ', 'g'), '|' order by schemaname||'.'||viewname))
from pg_views where schemaname='public'
union all
select 'enums', count(*)::text,
  md5(string_agg(t.typname||':'||(select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid), '|' order by t.typname))
from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'
union all
select 'sequencias', count(*)::text, md5(string_agg(sequencename||':'||coalesce(start_value::text,'')||':'||coalesce(increment_by::text,''), '|' order by sequencename))
from pg_sequences where schemaname='public'
union all
select 'rls_por_tabela', count(*)::text, md5(string_agg(c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text, '|' order by c.relname))
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
union all
select 'publicacao_realtime', count(*)::text, coalesce(md5(string_agg(tablename, ',' order by tablename)), '-')
from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
order by 1;
