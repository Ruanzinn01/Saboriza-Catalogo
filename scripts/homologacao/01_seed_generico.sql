-- SOMENTE HOMOLOGACAO (dfynvpieyvvameftrent). Semeador generico de dados sinteticos.
-- Insere 1 linha por tabela public.* com company_id, para uma empresa, resolvendo FKs NOT NULL
-- (reusa linha existente da mesma empresa ou semeia a tabela referenciada, profundidade <= 5).
-- Idempotente: se a tabela ja tem linha da empresa, nao insere. Falhas ficam em zz_homolog.seed_log.
create schema if not exists zz_homolog;
create table if not exists zz_homolog.seed_log (tabela text, company_id uuid, resultado text, detalhe text, em timestamptz default now());

create or replace function zz_homolog.seed_table(p_table text, p_company uuid, p_depth int default 0) returns boolean
language plpgsql as $$
declare
  c record; fk record; cols text[] := '{}'; vals text[] := '{}'; v text; n bigint; chk text; lit text;
  fkcols text[]; refrel regclass; refcols text[]; refcompany boolean; sel text; rec jsonb; k int;
  done_cols text[] := '{}'; v_user uuid;
begin
  if p_depth > 5 then return false; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='company_id') then return false; end if;
  execute format('select count(*) from public.%I where company_id=%L', p_table, p_company) into n;
  if n > 0 then return true; end if;
  select m.user_id into v_user from public.memberships m where m.company_id = p_company order by m.created_at limit 1;
  cols := array['company_id']; vals := array[quote_literal(p_company)]; done_cols := array['company_id'];
  -- FKs: so as NOT NULL (todas as colunas NOT NULL)
  for fk in select con.oid, con.conkey, con.confrelid, con.confkey from pg_constraint con
            where con.conrelid = format('public.%I', p_table)::regclass and con.contype='f' loop
    select array_agg(a.attname order by x.ord) into fkcols from unnest(fk.conkey) with ordinality x(attnum, ord) join pg_attribute a on a.attrelid = format('public.%I', p_table)::regclass and a.attnum = x.attnum;
    if fkcols = array['company_id'] then continue; end if;
    if exists (select 1 from unnest(fk.conkey) x(attnum) join pg_attribute a on a.attrelid = format('public.%I', p_table)::regclass and a.attnum = x.attnum where not a.attnotnull) then continue; end if;
    select array_agg(a.attname order by x.ord) into refcols from unnest(fk.confkey) with ordinality x(attnum, ord) join pg_attribute a on a.attrelid = fk.confrelid and a.attnum = x.attnum;
    refrel := fk.confrelid;
    if refrel::text = 'auth.users' then
      lit := quote_literal(v_user);
      for k in 1..array_length(fkcols,1) loop
        if not fkcols[k] = any(done_cols) then cols := cols || fkcols[k]; vals := vals || lit; done_cols := done_cols || fkcols[k]; end if;
      end loop;
      continue;
    end if;
    select exists(select 1 from pg_attribute where attrelid = refrel and attname='company_id' and not attisdropped) into refcompany;
    for k in 1..2 loop
      sel := format('select %s from %s %s limit 1', (select string_agg(format('%I::text as f%s', rc, ord), ',') from unnest(refcols) with ordinality u(rc, ord)), refrel::text,
                    case when refcompany then format('where company_id=%L', p_company) else '' end);
      begin
        execute 'select to_jsonb(q) from (' || sel || ') q' into rec;
      exception when others then rec := null;
      end;
      exit when rec is not null;
      if k = 1 and refcompany then perform zz_homolog.seed_table(replace(refrel::text,'public.',''), p_company, p_depth+1); end if;
    end loop;
    if rec is null then return false; end if;
    for k in 1..array_length(fkcols,1) loop
      if not fkcols[k] = any(done_cols) then
        cols := cols || fkcols[k]; vals := vals || quote_literal(rec ->> ('f' || (k)::text));
        done_cols := done_cols || fkcols[k];
      end if;
    end loop;
  end loop;
  -- demais colunas NOT NULL sem default
  for c in select a.attname, a.atttypid, format_type(a.atttypid, a.atttypmod) ft, t.typcategory, t.typtype
           from pg_attribute a join pg_type t on t.oid = a.atttypid
           where a.attrelid = format('public.%I', p_table)::regclass and a.attnum > 0 and not a.attisdropped
             and a.attnotnull and not a.atthasdef and a.attgenerated = '' and a.attidentity = ''
             and a.attname <> all(done_cols) order by a.attnum loop
    chk := (select string_agg(pg_get_constraintdef(con.oid), ' ') from pg_constraint con
            where con.conrelid = format('public.%I', p_table)::regclass and con.contype='c'
              and pg_get_constraintdef(con.oid) ~ ('\m' || c.attname || '\M'));
    if c.typtype = 'e' then
      select quote_literal(e.enumlabel) into lit from pg_enum e where e.enumtypid = c.atttypid order by e.enumsortorder limit 1;
    elsif c.typcategory = 'S' then
      if chk is not null and chk ~ '''[^'']+''::' then lit := quote_literal((regexp_match(chk, '''([^'']+)''::'))[1]);
      elsif c.attname ~ 'email' then lit := quote_literal('sintetico-' || p_table || '@homolog.test');
      elsif c.attname ~ 'phone|whatsapp|telefone' then lit := quote_literal('+5571999990000');
      elsif c.attname ~ 'document|cnpj|cpf' then lit := quote_literal('00000000000');
      else lit := quote_literal('homolog ' || c.attname); end if;
    elsif c.typcategory = 'N' then lit := '1';
    elsif c.typcategory = 'B' then lit := 'false';
    elsif c.typcategory = 'D' then lit := case when c.ft = 'date' then 'current_date' when c.ft like 'time without%' then quote_literal('08:00') else 'now()' end;
    elsif c.ft in ('jsonb','json') then lit := quote_literal('{}');
    elsif c.typcategory = 'A' then lit := quote_literal('{}');
    elsif c.ft = 'uuid' then lit := quote_literal(gen_random_uuid());
    elsif c.typcategory = 'T' then lit := quote_literal('1 hour');
    else lit := quote_literal(''); end if;
    cols := cols || c.attname; vals := vals || lit;
  end loop;
  begin
    execute format('insert into public.%I (%s) values (%s)', p_table, (select string_agg(quote_ident(x), ',') from unnest(cols) x), array_to_string(vals, ','));
    insert into zz_homolog.seed_log values (p_table, p_company, 'OK', null);
    return true;
  exception when others then
    insert into zz_homolog.seed_log values (p_table, p_company, 'FALHOU', left(sqlerrm, 300));
    return false;
  end;
end $$;
