// Harness de validação em memória (PGlite). NÃO é homologação: usa schema SINTÉTICO que reproduz o que foi lido de produção.
// Uso: numa pasta temporária fora do repositório: npm i @electric-sql/pglite@0.3.14 ; node harness-pglite.mjs <raiz-do-repo> <pasta-de-saida>
// Não adiciona dependência ao projeto.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const REPO = process.argv[2];
const v3 = fs.readFileSync(`${REPO}/supabase/migrations/20261014150418_separa_confere_v3.sql`, "utf8");
const migration = fs.readFileSync(`${REPO}/supabase/pendentes/20261014180000_apps_operacionais_isolados.sql`, "utf8");
let tests = fs.readFileSync(`${REPO}/supabase/pendentes/testes_homologacao.sql`, "utf8");

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = {
  separa: "00000000-0000-0000-0000-000000000001",
  producao: "00000000-0000-0000-0000-000000000002",
  entrega: "00000000-0000-0000-0000-000000000003",
  multi: "00000000-0000-0000-0000-000000000004",
  gestor: "00000000-0000-0000-0000-000000000005",
  admin: "00000000-0000-0000-0000-000000000006",
  outra: "00000000-0000-0000-0000-000000000007",
  hibrido: "00000000-0000-0000-0000-000000000008",
};
// os UUIDs do roteiro são os mesmos 00..01 a 00..07; sem substituição necessária.

const db = new PGlite();
const out = [];
const log = (s = "") => { out.push(s); console.log(s); };
const q = async (sql) => (await db.query(sql)).rows;
const as = async (uid, role, fn) => {
  await db.exec(`select set_config('request.jwt.claim.sub','${uid ?? ""}',false); set role ${role};`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
};
const tryRun = async (uid, role, sql) => as(uid, role, async () => {
  try { const r = await db.query(sql); return { ok: true, rows: r.rows, affected: r.affectedRows }; }
  catch (e) { return { ok: false, code: e.code, message: e.message }; }
});

// ------------------------------------------------------------------------------------------
// 1) Schema sintético = o que foi lido de produção em 2026-10-15
// ------------------------------------------------------------------------------------------
await db.exec(`
  create schema auth; create schema private;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public, auth, private to anon, authenticated;
  alter default privileges grant execute on functions to authenticated;
  alter default privileges in schema public grant all on tables to authenticated;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;

  create table public.permissions (key text primary key, name text, description text, sensitivity text);
  create table public.memberships (id uuid primary key default gen_random_uuid(), company_id uuid not null, user_id uuid not null, status text not null default 'ACTIVE', starts_at timestamptz not null default now() - interval '1 day', ends_at timestamptz, note text);
  create table public.roles (id uuid primary key default gen_random_uuid(), company_id uuid not null, name text, status text not null default 'ACTIVE', note text);
  create table public.role_permissions (company_id uuid not null, role_id uuid not null, permission_key text not null, note text);
  create table public.membership_roles (company_id uuid not null, membership_id uuid not null, role_id uuid not null, note text);

  create function private.has_permission(p_company_id uuid, p_permission_key text) returns boolean language sql stable security definer set search_path to '' as $$
    select exists(select 1 from public.memberships m
      join public.membership_roles mr on mr.company_id=m.company_id and mr.membership_id=m.id
      join public.roles r on r.company_id=mr.company_id and r.id=mr.role_id and r.status='ACTIVE'
      join public.role_permissions rp on rp.company_id=r.company_id and rp.role_id=r.id
      where m.company_id=p_company_id and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.starts_at<=now() and (m.ends_at is null or m.ends_at>now()) and rp.permission_key=p_permission_key)
  $$;
  create function private.is_active_company_member(p_company_id uuid) returns boolean language sql stable security definer set search_path to '' as $$
    select exists(select 1 from public.memberships m where m.company_id=p_company_id and m.user_id=(select auth.uid()) and m.status='ACTIVE')
  $$;
  create function private.default_company_id() returns uuid language sql stable security definer set search_path to '' as $$
    select m.company_id from public.memberships m where m.user_id=(select auth.uid()) and m.status='ACTIVE' order by m.company_id limit 1
  $$;
  create function private.inventory_can_manage(p_company_id uuid) returns boolean language sql stable as $$ select false $$;
`);

const memberTables = ["orders","order_items","order_adjustment_requests","products","categories","settings","stock_movements","separation_jobs","inventory_sessions","inventory_session_items","employee_employments","group_companies"];
const v3Tables = ["customers","coupons","employees","employee_documents","salary_history","time_devices","suppliers","item_supplier_codes","product_recipe","raw_materials","raw_material_categories","raw_material_entries","raw_material_movements","production_consumptions","production_diaries","production_participants","production_plans","production_records","production_releases","production_routes","floor_execution_events","floor_executions","diary_evaluations","diary_occurrences","diary_other_activities","stock_period_closings","stock_opening_balances","stock_policies","stock_returns","stock_loss_records","loading_jobs","order_deliveries","order_delivery_items","delivery_er_reservations","urgent_demands","subscriptions","entitlements","onboarding_checklists"];
const permTables = { billings: "financeiro.ver", receivables: "financeiro.ver", expenses: "financeiro.ver", salary_obligations: "financeiro.ver", company_integration_credentials: "financeiro.ver" };
const writableByMember = new Set(["orders","order_items","order_adjustment_requests","production_diaries","diary_evaluations","diary_occurrences","diary_other_activities","urgent_demands","production_records","stock_movements"]);

for (const t of new Set([...memberTables, ...v3Tables])) {
  const extra = t === "employees" ? ", code text default 'E1', name text default 'Fulano', status text default 'ATIVO', can_operate_production boolean default true, photo_url text, unit_id uuid, cpf text default '123.456.789-00', salary_base numeric default 3000" : "";
  await db.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), company_id uuid not null, note text${extra}); alter table public.${t} enable row level security;
    create policy ${t}_select on public.${t} for select to authenticated using ((select private.is_active_company_member(company_id)));
    ${writableByMember.has(t) ? `create policy ${t}_write on public.${t} for all to authenticated using ((select private.is_active_company_member(company_id))) with check ((select private.is_active_company_member(company_id)));` : ""}`);
}
for (const [t, perm] of Object.entries(permTables)) {
  await db.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), company_id uuid not null, note text${t === "billings" ? ", order_id uuid, status text" : ""}); alter table public.${t} enable row level security;
    create policy ${t}_select on public.${t} for select to authenticated using ((select private.has_permission(company_id, '${perm}')));`);
}
for (const t of ["roles","role_permissions","membership_roles"]) await db.exec(`alter table public.${t} enable row level security; create policy ${t}_select on public.${t} for select to authenticated using ((select private.is_active_company_member(company_id)));`);
await db.exec(`alter table public.memberships enable row level security; create policy memberships_select on public.memberships for select to authenticated using ((select private.has_permission(company_id, 'iam.read')));`);

// RPCs como em produção: DEFINER, sem checagem de permissão; 4 delas executáveis por anon (grant padrão de PUBLIC)
const rpcs = [
  ["finalize_delivery", "uuid, text, text, text, text, text, text, text, text, text, jsonb", false],
  ["create_production_release", "uuid, integer, text, text, uuid, text, uuid", false],
  ["confirm_production_release", "uuid, integer, uuid, uuid, text, jsonb", true],
  ["create_production", "uuid, integer", false],
  ["create_production", "uuid, integer, uuid[]", true],
  ["create_production", "uuid, integer, uuid[], uuid", true],
  ["reverse_production", "uuid, text", true],
  ["floor_advance_quantity", "uuid, integer", false],
  ["floor_assume_execution", "uuid, uuid", false],
  ["floor_complete_execution", "uuid", false],
  ["reserve_delivery_er", "uuid", false],
  ["publish_production_route", "uuid", false],
];
for (const [name, types, anon] of rpcs) {
  await db.exec(`create function public.${name}(${types}) returns uuid language plpgsql security definer set search_path to '' as $f$
    declare v_marker uuid;
    begin
      -- corpo simulado: o que importa é que NÃO checa permissão, como em produção
      return v_marker;
    end;
  $f$;`);
  if (!anon) await db.exec(`revoke execute on function public.${name}(${types}) from public, anon;`);
}

// V3 real do repositório: seções 1 a 3 (permissão, is_restricted_operator, políticas restritivas, my_access_profile)
const v3Head = v3.slice(0, v3.indexOf("-- 4) Código de barras da sessão"));
await db.exec(v3Head);

// ------------------------------------------------------------------------------------------
// 2) Dados: 2 empresas, 8 usuários, papéis
// ------------------------------------------------------------------------------------------
const roleDefs = {
  separa: ["separa_confere.operar"], producao: ["producao.operar"], entrega: ["entrega.operar"],
  multi: ["producao.operar", "entrega.operar"], gestor: ["iam.read", "financeiro.ver"],
  admin: ["iam.read", "financeiro.ver"], hibrido: ["producao.operar", "admin.acessar", "iam.read", "financeiro.ver"],
};
for (const [cls, keys] of Object.entries(roleDefs)) {
  await db.exec(`insert into public.roles (id, company_id, name) values (gen_random_uuid(), '${A}', '${cls}');`);
  const rid = (await q(`select id from public.roles where name='${cls}' and company_id='${A}'`))[0].id;
  for (const k of keys) await db.exec(`insert into public.role_permissions (company_id, role_id, permission_key) values ('${A}','${rid}','${k}');`);
  await db.exec(`insert into public.memberships (company_id, user_id) values ('${A}','${U[cls]}');`);
  const mid = (await q(`select id from public.memberships where user_id='${U[cls]}'`))[0].id;
  await db.exec(`insert into public.membership_roles (company_id, membership_id, role_id) values ('${A}','${mid}','${rid}');`);
}
await db.exec(`insert into public.roles (id, company_id, name) values (gen_random_uuid(), '${B}', 'outra');`);
{
  const rid = (await q(`select id from public.roles where company_id='${B}'`))[0].id;
  await db.exec(`insert into public.role_permissions (company_id, role_id, permission_key) values ('${B}','${rid}','producao.operar');
    insert into public.memberships (company_id, user_id) values ('${B}','${U.outra}');`);
  const mid = (await q(`select id from public.memberships where user_id='${U.outra}'`))[0].id;
  await db.exec(`insert into public.membership_roles (company_id, membership_id, role_id) values ('${B}','${mid}','${rid}');`);
}
for (const t of [...new Set([...memberTables, ...v3Tables, ...Object.keys(permTables)])]) {
  for (const c of [A, B]) await db.exec(`insert into public.${t} (company_id) values ('${c}');`);
}
await db.exec(`update public.billings set status='CONFIRMADO', order_id=gen_random_uuid();`);
const allTables = [...new Set([...memberTables, ...v3Tables, ...Object.keys(permTables)])].sort();

// Fotografia da visibilidade ANTES: o que cada classe enxerga hoje
async function visibility(uid) {
  const r = {};
  for (const t of allTables) {
    const res = await tryRun(uid, "authenticated", `select count(*)::int as n from public.${t} where company_id='${A}'`);
    r[t] = res.ok ? res.rows[0].n : `erro:${res.code}`;
  }
  return r;
}
const antes = { separa: await visibility(U.separa), gestor: await visibility(U.gestor), admin: await visibility(U.admin) };

// ------------------------------------------------------------------------------------------
// 3) Roteiro: PASSO 0 (snapshot) -> migration -> PASSO 3 (testes) -> PASSO 4 (diff)
// ------------------------------------------------------------------------------------------
const iPasso3 = tests.indexOf("-- ------------------------------ PASSO 3");
const iPasso4 = tests.indexOf("-- ------------------------------ PASSO 4");
await db.exec(tests.slice(0, iPasso3));

log("== APLICANDO A MIGRATION (em memória, schema sintético) ==");
try { await db.exec(migration); log("migration aplicada sem erro"); }
catch (e) { log("MIGRATION FALHOU: " + e.message); fs.writeFileSync(`${process.argv[3]}/saida.txt`, out.join("\n")); process.exit(2); }

const depois = { separa: await visibility(U.separa), gestor: await visibility(U.gestor), admin: await visibility(U.admin) };

log("\n== REGRESSÃO: visibilidade ANTES x DEPOIS (empresa A) ==");
for (const cls of ["separa", "gestor", "admin"]) {
  const diff = allTables.filter((t) => antes[cls][t] !== depois[cls][t]);
  log(`${cls}: ${diff.length === 0 ? `IDÊNTICA em ${allTables.length} tabelas` : "MUDOU em " + diff.map((t) => `${t} (${antes[cls][t]} -> ${depois[cls][t]})`).join(", ")}`);
}

log("\n== ROTEIRO PASSO 3 (T1 a T5) ==");
let resultados = [];
try {
  const res = await db.exec(tests.slice(iPasso3, iPasso4));
  const sets = res.filter((r) => r.rows && r.fields?.some((f) => f.name === "situacao"));
  const resumo = sets[0]?.rows ?? [];
  resultados = sets[1]?.rows ?? [];
  log("resumo: " + JSON.stringify(resumo));
  log("não-OK: " + resultados.length);
  for (const r of resultados) log(`  [${r.situacao}] ${r.caso} | esperado=${r.esperado} obtido=${r.obtido}`);
} catch (e) { log("ROTEIRO FALHOU: " + e.message); }

// ------------------------------------------------------------------------------------------
// 4) Escritas diretas e RPCs (T6/T7) — o que o roteiro de leitura não cobre
// ------------------------------------------------------------------------------------------
log("\n== T6 ESCRITAS DIRETAS (como o app faria pela API) ==");
const w = async (cls, label, sql, esperaOk) => {
  const r = await tryRun(U[cls], "authenticated", sql);
  const ehSelect = /^\s*select/i.test(sql);
  const obtidoOk = r.ok && (ehSelect ? r.rows.length > 0 : r.affected > 0);
  log(`${obtidoOk === esperaOk ? "OK     " : "FALHOU "} ${cls.padEnd(8)} ${label} -> ${r.ok ? `ok(${r.affected ?? "?"} linhas)` : r.code} (esperado ${esperaOk ? "permitir" : "negar"})`);
};
await w("producao", "INSERT production_diaries (matriz: escrita)", `insert into public.production_diaries (company_id) values ('${A}')`, true);
await w("producao", "INSERT production_records direto (matriz: só leitura)", `insert into public.production_records (company_id) values ('${A}')`, false);
await w("producao", "UPDATE orders (producao não tem orders)", `update public.orders set note='x' where company_id='${A}'`, false);
await w("producao", "SELECT employees (CPF/salário)", `select * from public.employees where company_id='${A}'`, false);
await w("entrega", "UPDATE orders (matriz: escrita)", `update public.orders set note='x' where company_id='${A}'`, true);
await w("entrega", "UPDATE order_items (matriz: escrita)", `update public.order_items set note='x' where company_id='${A}'`, true);
await w("entrega", "INSERT production_diaries (entrega não tem)", `insert into public.production_diaries (company_id) values ('${A}')`, false);
await w("entrega", "SELECT billings direto (exige permissão financeira)", `select * from public.billings where company_id='${A}'`, false);
await w("separa", "UPDATE orders (como hoje)", `update public.orders set note='x' where company_id='${A}'`, true);
await w("separa", "INSERT production_diaries (bloqueado como hoje)", `insert into public.production_diaries (company_id) values ('${A}')`, false);
await w("multi", "UPDATE orders (via entrega)", `update public.orders set note='x' where company_id='${A}'`, true);
await w("multi", "INSERT production_diaries (via producao)", `insert into public.production_diaries (company_id) values ('${A}')`, true);
await w("multi", "SELECT employees direto", `select * from public.employees where company_id='${A}'`, false);
await w("gestor", "UPDATE orders", `update public.orders set note='x' where company_id='${A}'`, true);
await w("gestor", "INSERT production_records", `insert into public.production_records (company_id) values ('${A}')`, true);
await w("hibrido", "SELECT employees (producao.operar + admin.acessar = não restrito)", `select * from public.employees where company_id='${A}'`, true);

log("\n== T7 RPCs DE LEITURA MÍNIMA E PERFIL ==");
const emp = await tryRun(U.producao, "authenticated", `select * from public.operator_list_production_employees()`);
log(`producao  operator_list_production_employees -> ${emp.ok ? `${emp.rows.length} linha(s), colunas: ${Object.keys(emp.rows[0] ?? {}).join(",")}` : emp.code + " " + emp.message}`);
const empBloq = await tryRun(U.entrega, "authenticated", `select * from public.operator_list_production_employees()`);
log(`entrega   operator_list_production_employees -> ${empBloq.ok ? "PERMITIU (falha)" : "negado " + empBloq.code}`);
const bil = await tryRun(U.entrega, "authenticated", `select * from public.operator_confirmed_billing_order_ids(array(select order_id from public.billings) )`);
log(`entrega   operator_confirmed_billing_order_ids -> ${bil.ok ? bil.rows.length + " pedido(s) confirmados (leitura direta de billings é negada)" : bil.code + " " + bil.message}`);
const bilBloq = await tryRun(U.producao, "authenticated", `select * from public.operator_confirmed_billing_order_ids(array[gen_random_uuid()])`);
log(`producao  operator_confirmed_billing_order_ids -> ${bilBloq.ok ? "PERMITIU (falha)" : "negado " + bilBloq.code}`);
for (const cls of Object.keys(U)) {
  const p = await tryRun(U[cls], "authenticated", `select apps, admin_access, restricted from public.my_app_access()`);
  log(`perfil ${cls.padEnd(8)} -> ${p.ok ? JSON.stringify(p.rows[0]) : p.code}`);
}
const legado = await tryRun(U.separa, "authenticated", `select restricted from public.my_access_profile()`);
log(`perfil LEGADO separa (clientes antigos) -> ${JSON.stringify(legado.rows?.[0])}`);

log("\n== GUARDA INJETADA (definição viva da RPC) ==");
const def = await q(`select pg_get_functiondef('public.finalize_delivery(uuid,text,text,text,text,text,text,text,text,text,jsonb)'::regprocedure) as d`);
log(def[0].d.split("\n").filter((l) => /assert_app_access|begin|SECURITY/i.test(l)).join("\n"));
const anonGrants = await q(`select p.proname, pg_get_function_identity_arguments(p.oid) args, has_function_privilege('anon', p.oid, 'EXECUTE') as anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('confirm_production_release','create_production','reverse_production') order by 1,2`);
log("anon pode executar? " + JSON.stringify(anonGrants.map((r) => `${r.proname}(${r.args.split(",").length}):${r.anon}`)));

log("\n== PASSO 4: políticas que mudaram ==");
const diffPol = await db.exec(tests.slice(iPasso4));
const rows = diffPol[diffPol.length - 1].rows;
const porTipo = {};
for (const r of rows) (porTipo[r.mudanca] ??= []).push(`${r.tabela}.${r.politica}`);
for (const [k, v] of Object.entries(porTipo)) log(`${k}: ${v.length}`);
log("ALTERADAS: " + (porTipo.ALTERADAS ?? porTipo.ALTERADA ?? []).join(", "));
log("REMOVIDAS: " + (porTipo.REMOVIDA ?? []).join(", "));

fs.writeFileSync(`${process.argv[3]}/saida.txt`, out.join("\n"));
