// Reaplica a trilha completa de supabase/migrations num Postgres em memória (PGlite) com stubs mínimos do
// ambiente Supabase. NÃO é homologação (sem PostgREST, Auth, Storage, Edge Functions, cron nem realtime reais):
// serve para provar que a trilha reconstrói um banco equivalente e para testar SQL, RLS, grants e gatilhos.
//
// Uso: numa pasta fora do repositório:  npm i @electric-sql/pglite@0.3.14
//      PGLITE_DIR=<essa pasta> node supabase/baseline/replay-pglite.mjs [--ate <versão>] [--catalogo <arquivo.json>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) throw new Error("defina PGLITE_DIR com a pasta onde o @electric-sql/pglite foi instalado");
const { PGlite } = await import(pathToFileURL(`${pgliteDir}/node_modules/@electric-sql/pglite/dist/index.js`).href);

export const STUBS = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator nologin;
  create schema if not exists auth; create schema if not exists storage; create schema if not exists cron; create schema if not exists vault; create schema if not exists extensions;
  grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
  grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language plpgsql immutable as $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
  create function storage.filename(name text) returns text language plpgsql immutable as $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[array_length(_parts,1)]; end $$;
  grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

  create table cron.job (jobid serial primary key, jobname text, schedule text, command text, active boolean default true);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid::bigint $$;
  create function cron.schedule(schedule text, command text) returns bigint language sql as $$ insert into cron.job (schedule, command) values (schedule, command) returning jobid::bigint $$;
  create function cron.unschedule(job_name text) returns boolean language sql as $$ delete from cron.job where jobname = job_name returning true $$;

  create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text, created_at timestamptz default now(), updated_at timestamptz default now());
  create view vault.decrypted_secrets as select id, name, description, secret, secret as decrypted_secret, created_at, updated_at from vault.secrets;
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id $$;
  create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null) returns void language sql as $$ update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name), description = coalesce(new_description, description), updated_at = now() where id = secret_id $$;

  -- pgcrypto não existe no PGlite: gen_random_uuid() é nativo; gen_random_bytes() só é chamada em tempo de execução
  create function public.gen_random_bytes(n integer) returns bytea language sql as $$ select decode(string_agg(lpad(to_hex((random()*255)::int),2,'0'),''),'hex') from generate_series(1,n) $$;

  create publication supabase_realtime;
  -- usuários reais citados em migrações antigas (identificadores; sem dados pessoais)
  insert into auth.users (id) values ('bdf16019-e1cb-4a1f-b920-86cf7e23452d'), ('ffafba32-7378-4aa9-8860-66c918b87dca');
`;

export async function criarBanco() {
  const db = new PGlite();
  await db.exec(STUBS);
  return db;
}

export function listarMigracoes(ate) {
  return fs
    .readdirSync(path.join(repo, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => !ate || f.slice(0, 14) <= ate);
}

export async function reaplicar(db, ate, log = console.log) {
  const falhas = [];
  for (const file of listarMigracoes(ate)) {
    let sql = fs.readFileSync(path.join(repo, "supabase/migrations", file), "utf8");
    sql = sql.replace(/create extension if not exists (pg_cron|pgcrypto)[^;]*;/gi, "select 1;");
    try {
      await db.exec(sql);
    } catch (e) {
      falhas.push({ file, erro: e.message });
      log(`FALHA ${file}: ${e.message}`);
      break;
    }
  }
  return falhas;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const ate = process.argv.includes("--ate") ? process.argv[process.argv.indexOf("--ate") + 1] : null;
  const db = await criarBanco();
  const falhas = await reaplicar(db, ate);
  const q = async (sql) => (await db.query(sql)).rows[0];
  const catalogo = {
    tabelas_public: Number((await q("select count(*) n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).n),
    funcoes_public: Number((await q("select count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")).n),
    funcoes_private: Number((await q("select count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'")).n),
    politicas_public: Number((await q("select count(*) n from pg_policies where schemaname='public'")).n),
    gatilhos_public: Number((await q("select count(*) n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal")).n),
  };
  console.log(JSON.stringify({ migracoes_aplicadas: listarMigracoes(ate).length - falhas.length, falhas, catalogo }, null, 2));
  if (process.argv.includes("--funcoes")) {
    const arq = process.argv[process.argv.indexOf("--funcoes") + 1];
    const rows = (await db.query("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' sig, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p') and p.proname <> 'gen_random_bytes'")).rows;
    fs.writeFileSync(arq, JSON.stringify(Object.fromEntries(rows.map((r) => [r.sig, r.def]))));
  }
  if (process.argv.includes("--assinaturas")) {
    const sql = fs.readFileSync(path.join(repo, "supabase/baseline/assinaturas.sql"), "utf8");
    console.log(JSON.stringify((await db.query(sql)).rows, null, 1));
  }
  if (process.argv.includes("--catalogo")) {
    const arq = process.argv[process.argv.indexOf("--catalogo") + 1];
    const nomes = async (sql) => (await db.query(sql)).rows.map((r) => r.n);
    fs.writeFileSync(
      arq,
      JSON.stringify({
        tabelas: await nomes("select table_name n from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"),
        funcoes: await nomes("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p') order by 1"),
        politicas: await nomes("select tablename||'.'||policyname n from pg_policies where schemaname='public' order by 1"),
        gatilhos: await nomes("select c.relname||'.'||t.tgname n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by 1"),
      }, null, 2)
    );
  }
  await db.close();
}
