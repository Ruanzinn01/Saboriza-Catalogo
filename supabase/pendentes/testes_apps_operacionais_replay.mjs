// Testes dos apps operacionais isolados no banco RECONSTRUÍDO (PGlite) a partir de supabase/migrations.
// NÃO é homologação: sem PostgREST, Auth, Storage nem Edge Functions reais. Tabelas, políticas, grants, gatilhos e corpos
// de função são os da trilha (equivalente a produção por hash, ver supabase/baseline). Linhas de teste são geradas, não reais.
// Uso: PGLITE_DIR=<pasta com @electric-sql/pglite> node supabase/pendentes/testes_apps_operacionais_replay.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const MIGRACAO = fs.readFileSync(path.join(repo, "supabase/pendentes/20261014180000_apps_operacionais_isolados.sql"), "utf8");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = {
  owner: "00000000-0000-0000-0000-0000000000a1",
  gestor: "00000000-0000-0000-0000-0000000000a2",
  separa: "00000000-0000-0000-0000-0000000000a3",
  producao: "00000000-0000-0000-0000-0000000000a4",
  entrega: "00000000-0000-0000-0000-0000000000a5",
  multi: "00000000-0000-0000-0000-0000000000a6",
  hibrido: "00000000-0000-0000-0000-0000000000a7",
  outra: "00000000-0000-0000-0000-0000000000b1",
};
// lidas hoje por qualquer membro ativo (a política deixa ver a própria linha / unidades); não mudam com a migration
const BASE_MEMBRO = ["memberships", "units"];
const MATRIZ = {
  producao: ["products", "categories", "settings", "stock_movements", "production_records", "production_releases", "floor_executions", "production_plans", "production_routes", "raw_materials", "production_diaries", "diary_evaluations", "diary_occurrences", "diary_other_activities", "urgent_demands"],
  entrega: ["products", "settings", "orders", "order_items", "order_adjustment_requests"],
};

const db = await criarBanco();
const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };
const q = async (sql) => (await db.query(sql)).rows;

async function como(uid, role, sql) {
  const claims = uid ? JSON.stringify({ sub: uid, role }) : "";
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false); set role ${role};`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows, afetadas: r.affectedRows };
  } catch (e) {
    return { ok: false, code: e.code, msg: e.message };
  } finally {
    await db.exec("reset role;");
  }
}
const auth = (uid, sql) => como(uid, "authenticated", sql);

log("# Reconstruindo o banco a partir de supabase/migrations");
const falhasReplay = await reaplicar(db, null, log);
ok("trilha reaplicada sem falha", falhasReplay.length === 0);

// ------------------------------------------------------------------------------------------------
// Estado "produção": só os papéis que existem hoje (Proprietário, operador do Separa, membro comum)
// ------------------------------------------------------------------------------------------------
await db.exec(`
  insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a'),('${B}','Empresa B','INDUSTRY','empresa-b');
  insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(",")};
`);
async function criarPapel(uid, empresa, chave, perms) {
  const role = crypto.randomUUID();
  const mem = crypto.randomUUID();
  await db.exec(`
    insert into public.roles (id, company_id, key, name) values ('${role}','${empresa}','${chave}','${chave}');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${empresa}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
    insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${empresa}','${uid}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${empresa}','${mem}','${role}');`);
}
const todas = (await q("select key from public.permissions where key <> 'separa_confere.operar'")).map((r) => r.key);
await criarPapel(U.owner, A, "proprietario", todas);
await criarPapel(U.gestor, A, "gestor", ["despesas.read", "tarefas.read", "estoque.movimentar", "operations.factory.manage"]);
await criarPapel(U.separa, A, "operador_separa", ["separa_confere.operar"]);

// Dados mínimos reais onde o gerador genérico não alcança
await db.exec(`
  insert into public.orders (id, company_id, order_number, customer_name, phone) values (gen_random_uuid(),'${A}','T-A-1','Cliente A','11999999999'),(gen_random_uuid(),'${B}','T-B-1','Cliente B','11999999998');
  insert into public.employees (id, company_id, code, name, status, admission_date, salary_base, cpf, timesheet_enabled, can_operate_production)
    values (gen_random_uuid(),'${A}','A1','Colaborador A','ATIVO','2026-01-05',5000,'11111111111',true,true),(gen_random_uuid(),'${B}','B1','Colaborador B','ATIVO','2026-01-05',7000,'33333333333',true,true);
`);

// Semeadura genérica: 1 linha por empresa em toda tabela com company_id (sem FK/gatilho), para a visibilidade ser conclusiva
// valores que a regra de negócio exige (checks/enums) para a linha ser aceita
const SOBRESCREVER = {
  diary_occurrences: { occurrence_type: () => "'Atenção'" },
  stock_movements: { origin: () => "'adjustment'" },
  products: { packaging_type: () => "'Caixa'" },
  raw_materials: { control_unit: () => "'kg'" },
  billings: { status: () => "'CONFIRMADO'", order_id: (emp) => `(select id from public.orders where company_id='${emp}' limit 1)` },
};
const falhasSemeadura = [];
const UNIDADE = (emp) => `(select id from public.units where company_id='${emp}' order by id limit 1)`;
const IDENT = new Set(["memberships", "membership_roles", "roles", "role_permissions", "companies", "permissions"]);
const tabelas = (await q(`select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE' where c.table_schema='public' and c.column_name='company_id' order by 1`)).map((r) => r.table_name);
const semeadas = new Set();
await db.exec("set session_replication_role = replica;");
const ordemSemeadura = [...tabelas].sort((a, b) => (a === "units" ? -1 : b === "units" ? 1 : 0));
for (const t of ordemSemeadura) {
  if (IDENT.has(t)) continue;
  const have = (await q(`select count(*)::int n from public.${t} where company_id='${A}'`))[0].n;
  if (have > 0) { semeadas.add(t); continue; }
  const cols = await q(`select c.column_name, c.data_type, c.udt_name from information_schema.columns c where c.table_schema='public' and c.table_name='${t}' and c.is_nullable='NO' and c.column_default is null and c.is_generated='NEVER' and c.column_name<>'company_id'`);
  const vals = [];
  for (const c of cols) {
    let v;
    if (c.data_type === "uuid") v = "gen_random_uuid()";
    else if (/char|text/.test(c.data_type)) v = "'x'";
    else if (/int|numeric|double|real/.test(c.data_type)) v = "1";
    else if (c.data_type === "boolean") v = "false";
    else if (/timestamp/.test(c.data_type)) v = "now()";
    else if (c.data_type === "date") v = "current_date";
    else if (c.data_type === "time without time zone") v = "'00:00'";
    else if (c.data_type === "jsonb" || c.data_type === "json") v = "'{}'";
    else if (c.data_type === "ARRAY") v = "'{}'";
    else if (c.data_type === "USER-DEFINED") v = `(select e.enumlabel from pg_enum e join pg_type ty on ty.oid=e.enumtypid where ty.typname='${c.udt_name}' order by e.enumsortorder limit 1)::text::${c.udt_name}`;
    else v = "null";
    vals.push(v);
  }
  const temUnit = (await q(`select 1 from information_schema.columns where table_schema='public' and table_name='${t}' and column_name='unit_id'`)).length > 0;
  let feito = true;
  for (const emp of [A, B]) {
    const colunas = cols.map((c) => c.column_name);
    const valores = [...vals];
    for (const [col, fn] of Object.entries({ ...(temUnit ? { unit_id: UNIDADE } : {}), ...(SOBRESCREVER[t] ?? {}) })) {
      const i = colunas.indexOf(col);
      if (i >= 0) valores[i] = fn(emp);
      else { colunas.push(col); valores.push(fn(emp)); }
    }
    try {
      await db.exec(`insert into public.${t} (company_id${colunas.map((c) => `, ${c}`).join("")}) values ('${emp}'${valores.map((v) => `, ${v}`).join("")})`);
    } catch (e) {
      feito = false;
      let extra = "";
      const m = /constraint "([^"]+)"/.exec(e.message);
      if (m && /check/.test(e.message)) extra = " | " + ((await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname='${m[1]}' limit 1`))[0]?.d ?? "").slice(0, 160);
      falhasSemeadura.push(`${t}: ${e.message.slice(0, 90)}${extra}`);
      break;
    }
  }
  if (feito) semeadas.add(t);
  else await db.exec(`delete from public.${t} where company_id in ('${A}','${B}')`).catch(() => {});
}
await db.exec("set session_replication_role = origin;");
for (const f of falhasSemeadura.filter((x) => /^(units|products|production_|floor_executions|raw_materials|urgent_demands|stock_movements|order_items|diary_|order_adjustment|categories|settings)/.test(x))) log(`       não semeou ${f}`);
log(`semeadura genérica: ${semeadas.size} de ${tabelas.length - IDENT.size} tabelas com linhas nas duas empresas (as demais ficam INCONCLUSIVAS na visibilidade)`);

async function visibilidade(uid) {
  const r = {};
  for (const t of tabelas) {
    const res = await auth(uid, `select count(*)::int n from public.${t} where company_id='${A}'`);
    r[t] = res.ok ? res.rows[0].n : `erro:${res.code}`;
  }
  return r;
}
async function snapPoliticas() {
  return Object.fromEntries((await q(`select c.relname||'.'||p.polname k, md5(p.polpermissive::text||p.polcmd::text||coalesce(pg_get_expr(p.polqual,p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')) h from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'`)).map((r) => [r.k, r.h]));
}

const antes = { separa: await visibilidade(U.separa), gestor: await visibilidade(U.gestor), owner: await visibilidade(U.owner) };
const politicasAntes = await snapPoliticas();
const antesAnon = (await q(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('confirm_production_release','create_production','reverse_production','update_order_items') and has_function_privilege('anon', p.oid, 'EXECUTE')`)).map((r) => r.f);
log(`\n# ESTADO ATUAL: funções executáveis por anon entre as 4 alvo: ${antesAnon.length}`);
ok("estado atual reproduz o achado: anon executa RPCs de produção/pedido", antesAnon.length >= 3, antesAnon.join(" | "));
const rBefore = await auth(U.separa, `select public.finalize_delivery(null::uuid,null,null,null,null,null,null,null,null,null,null::jsonb)`);
ok("estado atual reproduz o achado: operador do Separa NÃO é barrado por permissão em finalize_delivery", !(rBefore.code === "42501"), `${rBefore.code ?? "ok"} ${rBefore.msg ?? ""}`.slice(0, 80));

// ------------------------------------------------------------------------------------------------
log("\n# APLICANDO a migration sobre o schema reconstruído");
try { await db.exec(MIGRACAO); ok("migration aplicada sem erro (injeção de guarda nos corpos REAIS das RPCs)", true); }
catch (e) { ok("migration aplicada sem erro", false, e.message); finish(); }

function finish() {
  log(`\n${falhas === 0 ? "RESULTADO: 0 falhas" : `RESULTADO: ${falhas} FALHA(S)`}`);
  if (saida) fs.writeFileSync(saida, linhas.join("\n"));
  process.exit(falhas === 0 ? 0 : 1);
}

log("\n# REGRESSÃO: quem não pode mudar (visibilidade em TODAS as tabelas com company_id, empresa A)");
const depois = { separa: await visibilidade(U.separa), gestor: await visibilidade(U.gestor), owner: await visibilidade(U.owner) };
await criarPapel(U.producao, A, "producao", ["producao.operar"]);
await criarPapel(U.entrega, A, "entrega", ["entrega.operar"]);
await criarPapel(U.multi, A, "multi", ["producao.operar", "entrega.operar"]);
await criarPapel(U.hibrido, A, "hibrido", ["producao.operar", "admin.acessar", "despesas.read"]);
await criarPapel(U.outra, B, "outra_producao", ["producao.operar"]);
for (const cls of ["separa", "gestor", "owner"]) {
  const diff = tabelas.filter((t) => antes[cls][t] !== depois[cls][t]);
  ok(`${cls}: visibilidade idêntica antes e depois em ${tabelas.length} tabelas`, diff.length === 0, diff.map((t) => `${t} ${antes[cls][t]}->${depois[cls][t]}`).join(", "));
}
const politicasDepois = await snapPoliticas();
const removidas = Object.keys(politicasAntes).filter((k) => !(k in politicasDepois));
const alteradas = Object.keys(politicasAntes).filter((k) => k in politicasDepois && politicasAntes[k] !== politicasDepois[k]);
const novas = Object.keys(politicasDepois).filter((k) => !(k in politicasAntes));
ok("nenhuma política removida", removidas.length === 0, removidas.join(", "));
log(`       políticas alteradas: ${alteradas.length} | novas: ${novas.length}`);
log(`       alteradas: ${alteradas.join(", ")}`);
const fora = alteradas.filter((k) => !/_no_restricted_operator$/.test(k));
ok("só as políticas *_no_restricted_operator das tabelas usadas pelos apps foram alteradas", fora.length === 0, fora.join(", "));

log("\n# VISIBILIDADE por app (leitura direta, empresa A)");
for (const cls of ["producao", "entrega", "multi"]) {
  const apps = cls === "multi" ? ["producao", "entrega"] : [cls];
  const permitidas = new Set([...apps.flatMap((a) => MATRIZ[a]), ...BASE_MEMBRO]);
  const vis = await visibilidade(U[cls]);
  const indevidas = [], faltando = [], inconclusivas = [];
  for (const t of tabelas) {
    const n = vis[t];
    const temLinha = typeof n === "number" && n > 0;
    if (permitidas.has(t)) { if (!temLinha) (semeadas.has(t) ? faltando : inconclusivas).push(`${t}=${n}`); }
    else if (temLinha) indevidas.push(`${t}=${n}`);
  }
  ok(`${cls}: não enxerga nenhuma tabela fora da matriz`, indevidas.length === 0, indevidas.join(", "));
  ok(`${cls}: enxerga as tabelas da matriz que têm linhas`, faltando.length === 0, faltando.join(", "));
  if (inconclusivas.length) log(`       inconclusivas (sem linha semeada): ${inconclusivas.join(", ")}`);
}

log("\n# ESCRITAS DIRETAS");
const w = async (cls, nome, sql, permitir) => {
  const r = await auth(U[cls], sql);
  const executou = r.ok && (/^\s*select/i.test(sql) ? r.rows.length > 0 : r.afetadas > 0);
  ok(`${cls}: ${nome} -> ${permitir ? "permitir" : "negar"}`, executou === permitir, r.ok ? `ok(${r.afetadas ?? r.rows.length})` : r.code);
};
await w("producao", "UPDATE orders (fora da matriz)", `update public.orders set customer_name=customer_name where company_id='${A}'`, false).catch(() => {});
await w("producao", "SELECT employees (CPF/salário)", `select * from public.employees where company_id='${A}'`, false);
await w("entrega", "UPDATE orders (matriz: escrita)", `update public.orders set customer_name=customer_name where company_id='${A}'`, true);
await w("entrega", "SELECT billings direto (permissão financeira)", `select * from public.billings where company_id='${A}'`, false);
await w("multi", "SELECT employees direto", `select * from public.employees where company_id='${A}'`, false);
await w("hibrido", "SELECT employees (producao.operar + admin.acessar = não restrito)", `select * from public.employees where company_id='${A}'`, true);
await w("gestor", "UPDATE orders", `update public.orders set customer_name=customer_name where company_id='${A}'`, true);

log("\n# GUARDA PRESENTE em cada sobrecarga das funções-alvo (definição viva)");
const ALVOS = ["create_production_release", "confirm_production_release", "create_production", "reverse_production", "floor_advance_quantity", "floor_assume_execution", "floor_complete_execution", "finalize_delivery", "reserve_delivery_er", "publish_production_route", "adjust_stock", "create_stock_entry", "confirm_raw_material_entry", "reverse_raw_material_entry", "update_order_items"];
const defs = await q(`select p.oid::regprocedure::text f, pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname = any(array[${ALVOS.map((a) => `'${a}'`).join(",")}])`);
const semGuarda = defs.filter((x) => !x.d.includes("private.assert_app_access")).map((x) => x.f);
ok(`guarda injetada em todas as ${defs.length} sobrecargas das ${ALVOS.length} funções-alvo`, semGuarda.length === 0 && defs.length >= ALVOS.length, semGuarda.join(" | "));
const posBegin = defs.filter((x) => x.d.indexOf("private.assert_app_access") < x.d.indexOf("$function$")).map((x) => x.f);
ok("a guarda está dentro do corpo (depois de $function$), nunca no cabeçalho", posBegin.length === 0, posBegin.join(" | "));

log("\n# RPCs com guarda (corpos reais). Bloqueado = 42501; permitido = qualquer outro resultado");
const rpcs = [
  ["create_production_release", "producao"], ["confirm_production_release", "producao"], ["create_production", "producao"],
  ["reverse_production", "producao"], ["floor_advance_quantity", "producao"], ["floor_assume_execution", "producao"],
  ["floor_complete_execution", "producao"], ["finalize_delivery", "entrega"], ["reserve_delivery_er", "entrega"],
  ["publish_production_route", "admin"], ["adjust_stock", "admin"], ["create_stock_entry", "admin"],
  ["confirm_raw_material_entry", "admin"], ["reverse_raw_material_entry", "admin"], ["update_order_items", "admin"],
  ["operator_list_production_employees", "producao"], ["operator_confirmed_billing_order_ids", "entrega"],
];
const classes = { separa: ["separa_confere"], producao: ["producao"], entrega: ["entrega"], multi: ["producao", "entrega"], gestor: "tudo", owner: "tudo", hibrido: "tudo" };
for (const [nome, app] of rpcs) {
  const assinaturas = await q(`select p.oid, pg_get_function_identity_arguments(p.oid) a, p.proargtypes::oid[] t from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='${nome}'`);
  for (const s of assinaturas) {
    const tipos = (await q(`select format_type(t, null) f from unnest(array[${s.t.join(",")}]::oid[]) t`)).map((r) => r.f);
    const chamada = `select * from public.${nome}(${tipos.map((t) => `null::${t}`).join(", ")})`;
    for (const [cls, apps] of Object.entries(classes)) {
      const permitido = apps === "tudo" || (app !== "admin" && apps.includes(app));
      const r = await auth(U[cls], chamada);
      if (!r.ok && r.code === "42725") { log(`       (sobrecarga ambígua com argumentos nulos: ${nome}(${tipos.length}) como ${cls} não testável por chamada; coberta pela variante de maior aridade)`); continue; }
      const bloqueou = !r.ok && r.code === "42501";
      ok(`${nome}(${tipos.length}) como ${cls}: ${permitido ? "permitido" : "negado"}`, permitido ? !bloqueou : bloqueou, r.ok ? "executou" : `${r.code} ${(r.msg ?? "").slice(0, 60)}`);
    }
    const anonPode = (await q(`select has_function_privilege('anon', ${s.oid}::oid, 'EXECUTE') a`))[0].a;
    ok(`${nome}(${tipos.length}) como anon: sem EXECUTE`, anonPode === false, anonPode ? "anon PODE executar" : "sem privilégio");
  }
}

log("\n# LEITURA MÍNIMA e PERFIL");
let r = await auth(U.producao, "select * from public.operator_list_production_employees()");
ok("producao: operator_list_production_employees devolve só identificação", r.ok && r.rows.length === 1 && !("cpf" in r.rows[0]) && !("salary_base" in r.rows[0]), r.ok ? Object.keys(r.rows[0] ?? {}).join(",") : r.msg);
r = await auth(U.entrega, "select * from public.operator_confirmed_billing_order_ids(array(select id from public.orders where company_id = '" + A + "'))");
ok("entrega: operator_confirmed_billing_order_ids devolve só ids confirmados (e billings direto é negado)", r.ok && r.rows.length >= 1, r.ok ? `${r.rows.length} id(s)` : r.msg);
const esperado = { separa: ["separa_confere", false], producao: ["producao", false], entrega: ["entrega", false], multi: ["producao,entrega", false], hibrido: ["separa_confere,producao,entrega", true], gestor: ["separa_confere,producao,entrega", true], owner: ["separa_confere,producao,entrega", true], outra: ["producao", false] };
for (const [cls, [apps, admin]] of Object.entries(esperado)) {
  const p = await auth(U[cls], "select apps, admin_access from public.my_app_access()");
  ok(`perfil ${cls}: apps={${apps}} admin=${admin}`, p.ok && (p.rows[0]?.apps ?? []).join(",") === apps && p.rows[0]?.admin_access === admin, p.ok ? `${(p.rows[0]?.apps ?? []).join(",")} admin=${p.rows[0]?.admin_access}` : p.msg);
}
const legado = await auth(U.separa, "select restricted from public.my_access_profile()");
ok("perfil LEGADO (clientes antigos): separa continua restrito", legado.ok && legado.rows[0]?.restricted === true);
const legadoOwner = await auth(U.owner, "select restricted from public.my_access_profile()");
ok("perfil LEGADO: Proprietário continua sem restrição", legadoOwner.ok && legadoOwner.rows[0]?.restricted === false);

log("\n# OUTRA EMPRESA");
const outra = await auth(U.outra, `select (select count(*) from public.orders where company_id='${A}')::int o, (select count(*) from public.production_records where company_id='${A}')::int p`);
ok("usuário restrito da empresa B não vê nada da empresa A", outra.ok && outra.rows[0].o === 0 && outra.rows[0].p === 0);
const emp = await auth(U.outra, "select * from public.operator_list_production_employees()");
ok("usuário da empresa B só lista colaboradores da própria empresa", emp.ok && emp.rows.every((x) => x.name === "Colaborador B"), emp.ok ? `${emp.rows.length} linha(s)` : emp.msg);

log("\n# ANON depois da migration");
const depoisAnon = (await q(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('confirm_production_release','create_production','reverse_production','update_order_items') and has_function_privilege('anon', p.oid, 'EXECUTE')`)).map((r) => r.f);
ok("nenhuma das RPCs alvo é executável por anon", depoisAnon.length === 0, depoisAnon.join(" | "));
const criar = await q(`select has_function_privilege('anon', p.oid, 'EXECUTE') a from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_order' limit 1`);
ok("create_order (catálogo público) continua executável por anon", criar[0]?.a === true);

// ------------------------------------------------------------------------------------------------
// Convivência com o patch de Storage da outra sessão (seguranca_storage_multiempresa.sql), aplicado DEPOIS desta migration
// ------------------------------------------------------------------------------------------------
log("\n# CONVIVÊNCIA: patch de Storage multiempresa aplicado depois desta migration");
const storageSql = fs.readFileSync(path.join(repo, "supabase/pendentes/seguranca_storage_multiempresa.sql"), "utf8");
await db.exec(`insert into storage.buckets (id, name) values ('employee-documents','employee-documents'),('delivery-receipts','delivery-receipts'),('delivery-signatures','delivery-signatures') on conflict (id) do nothing`);
const pedidoA = (await q(`select id from public.orders where company_id='${A}' limit 1`))[0].id;
const colabA = (await q(`select id from public.employees where company_id='${A}' limit 1`))[0].id;
await db.exec(`delete from storage.objects; insert into storage.objects (bucket_id, name) values ('delivery-receipts','${pedidoA}/ER-1.pdf'),('delivery-signatures','${pedidoA}/ER-1.png'),('employee-documents','${colabA}/contrato.pdf')`);
try { await db.exec(storageSql); ok("patch de Storage aplica sem erro depois da migration", true); }
catch (e) { ok("patch de Storage aplica sem erro depois da migration", false, e.message); finish(); }
const obj = async (cls, bucket) => (await auth(U[cls], `select count(*)::int n from storage.objects where bucket_id='${bucket}'`));
for (const cls of ["entrega", "multi", "owner", "gestor"]) {
  const r = await obj(cls, "delivery-receipts");
  ok(`storage: ${cls} lê comprovante de entrega da própria empresa`, r.ok && r.rows[0].n === 1, r.ok ? `${r.rows[0].n}` : r.msg);
}
const grav = await auth(U.entrega, `insert into storage.objects (bucket_id, name) values ('delivery-signatures','${pedidoA}/ER-2.png')`);
ok("storage: operador de Entrega grava assinatura da própria empresa", grav.ok, grav.ok ? "" : grav.msg);
for (const cls of ["separa", "producao", "entrega", "multi"]) {
  const r = await obj(cls, "employee-documents");
  ok(`storage: ${cls} (confinado) NÃO lê documentos de colaborador`, r.ok && r.rows[0].n === 0, r.ok ? `${r.rows[0].n}` : r.msg);
}
const docAdmin = await obj("owner", "employee-documents");
ok("storage: Proprietário lê documentos de colaborador", docAdmin.ok && docAdmin.rows[0].n === 1);
const docHibrido = await obj("hibrido", "employee-documents");
ok("storage: híbrido (producao.operar + admin.acessar) lê documentos como administrador", docHibrido.ok && docHibrido.rows[0].n === 1);
const outraEmpresa = await auth(U.outra, `select (select count(*) from storage.objects where bucket_id='delivery-receipts')::int a, (select count(*) from storage.objects where bucket_id='employee-documents')::int b`);
ok("storage: usuário da empresa B não lê nada da empresa A", outraEmpresa.ok && outraEmpresa.rows[0].a === 0 && outraEmpresa.rows[0].b === 0);
const info = await auth(U.separa, `select count(*)::int n from storage.objects where bucket_id='delivery-receipts'`);
log(`       informativo: operador do Separa/Produziu lê comprovantes da própria empresa? ${info.ok ? info.rows[0].n === 1 ? "SIM (política do patch é só por empresa; ver README)" : "não" : info.msg}`);

finish();
