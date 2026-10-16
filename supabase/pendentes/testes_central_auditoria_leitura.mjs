// Prova da migration Central de Auditoria (leitura) no banco RECONSTRUÍDO (PGlite). NÃO é homologação.
// Uso: PGLITE_DIR=<pasta> node supabase/pendentes/testes_central_auditoria_leitura.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const MIG = read("supabase/pendentes/20261016121000_central_auditoria_leitura.sql");
const REV = read("supabase/pendentes/20261016121000_central_auditoria_leitura_REVERSAO.sql");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = { owner_a: "00000000-0000-0000-0000-0000000000a1", owner_b: "00000000-0000-0000-0000-0000000000b1", leitor_b: "00000000-0000-0000-0000-0000000000b2", sem_perm_b: "00000000-0000-0000-0000-0000000000b3" };

const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  -> " + String(detalhe).slice(0, 160) : ""}`); };

const db = await criarBanco();
const falhasReplay = await reaplicar(db, null, log);
const q = async (sql) => (await db.query(sql)).rows;
async function como(uid, role, sql) {
  await db.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, role }) : ""}', false); set role ${role};`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows }; }
  catch (e) { return { ok: false, code: e.code, msg: e.message }; }
  finally { await db.exec("reset role;"); }
}
const rpc = async (uid, fn, args = "") => { const r = await como(uid, "authenticated", `select public.${fn}(${args}) j`); return r.ok ? { ...r, j: r.rows[0]?.j } : r; };
const negado = (r) => !r.ok && (r.code === "42501" || /permission denied|row-level security|Sem permiss/i.test(r.msg ?? ""));

log("# 0. Base reconstruída");
ok("trilha reaplicada sem falha", falhasReplay.length === 0);
await db.exec(`
  insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a'),('${B}','Empresa B','INDUSTRY','empresa-b');
  insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(",")};`);
async function papel(uid, empresa, chave, perms) {
  const role = crypto.randomUUID(), mem = crypto.randomUUID();
  await db.exec(`
    insert into public.roles (id, company_id, key, name) values ('${role}','${empresa}','${chave}','${chave}');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${empresa}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
    insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${empresa}','${uid}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${empresa}','${mem}','${role}');`);
}
const todas = (await q("select key from public.permissions where key <> 'separa_confere.operar'")).map((r) => r.key);
await papel(U.owner_a, A, "proprietario_a", todas);
await papel(U.owner_b, B, "proprietario_b", todas);
await papel(U.leitor_b, B, "leitor_b", ["audit.read"]);
await papel(U.sem_perm_b, B, "sem_perm_b", ["despesas.read"]);
await db.exec(MIG);
ok("migration aplica sem erro", (await q("select count(*)::int n from pg_proc where proname like 'audit_central_%'"))[0].n === 4);

const corr = "cccccccc-0000-0000-0000-000000000001";
await db.exec(`
  insert into public.audit_events (event_type, company_id, actor_type, actor_user_id, entity_type, entity_id, occurred_at, correlation_id, payload) values
   ('despesa.paga','${B}','USER','${U.owner_b}','expense','EXP-1', now() - interval '1 day','${corr}','{"antes":1,"depois":2}'),
   ('despesa.estornada','${B}','USER','${U.leitor_b}','expense','EXP-1', now() - interval '2 hours','${corr}','{"motivo":"x"}'),
   ('outbox.processada','${B}','SYSTEM',null,'outbox','OB_1', now() - interval '1 hour', gen_random_uuid(),'{}'),
   ('despesa.paga','${B}','USER','${U.owner_b}','expense','EXP-2', now() - interval '90 days', gen_random_uuid(),'{}'),
   ('despesa.paga','${A}','USER','${U.owner_a}','expense','EXP-A', now() - interval '1 hour', gen_random_uuid(),'{"segredo":"A"}');`);
const idB = (await q(`select id from public.audit_events where company_id='${B}' and entity_id='EXP-1' and event_type='despesa.paga'`))[0].id;
const idA = (await q(`select id from public.audit_events where company_id='${A}'`))[0].id;

log("\n# 1. Visão Geral");
let r = await rpc(U.owner_b, "audit_central_overview");
ok("owner B: total 3 nos 30 dias padrão (exclui evento de 90 dias e da empresa A)", r.ok && r.j.total === 3, r.msg ?? r.j?.total);
ok("atores humanos distintos = 2 e eventos de sistema = 1", r.ok && r.j.human_actors === 2 && r.j.system_events === 1, JSON.stringify(r.j));
ok("by_day soma o total (reconcilia com a lista)", r.ok && r.j.by_day.reduce((s, d) => s + d.count, 0) === r.j.total);
ok("by_event_type: 3 tipos, soma = total, desempate por chave", r.ok && r.j.by_event_type.length === 3 && r.j.by_event_type.reduce((s, x) => s + x.count, 0) === r.j.total && r.j.by_event_type[0].key === "despesa.estornada", JSON.stringify(r.j.by_event_type));
r = await rpc(U.owner_b, "audit_central_overview", `now() - interval '120 days', now()`);
ok("período amplo inclui o evento antigo (total 4)", r.ok && r.j.total === 4, r.msg ?? r.j?.total);
r = await rpc(U.owner_b, "audit_central_overview", `now(), now() - interval '1 day'`);
ok("período invertido recusado", !r.ok && /Período inválido/.test(r.msg), r.msg);

log("\n# 2. Logs (lista + filtros + paginação)");
r = await rpc(U.owner_b, "audit_central_list");
ok("total 3 e 3 linhas, ordem decrescente por data", r.ok && r.j.total === 3 && r.j.rows.length === 3 && r.j.rows[0].event_type === "outbox.processada", r.msg ?? JSON.stringify(r.j.rows.map((x) => x.event_type)));
ok("linha não carrega payload (só has_payload)", r.ok && r.j.rows.every((x) => !("payload" in x)) && r.j.rows.find((x) => x.entity_id === "OB_1").has_payload === false);
r = await rpc(U.owner_b, "audit_central_list", `null, null, null, null, null, null, 2, 0`);
const p1 = r.j.rows.map((x) => x.id);
r = await rpc(U.owner_b, "audit_central_list", `null, null, null, null, null, null, 2, 2`);
ok("paginação: total estável 3, página 2 tem 1 linha sem repetir a página 1", r.ok && r.j.total === 3 && r.j.rows.length === 1 && !p1.includes(r.j.rows[0].id));
r = await rpc(U.owner_b, "audit_central_list", `null, null, null, null, null, null, 9999, -5`);
ok("limit/offset fora da faixa são limitados (limit 100, offset 0)", r.ok && r.j.limit === 100 && r.j.offset === 0);
r = await rpc(U.owner_b, "audit_central_list", `null, null, null, 'despesa.paga'`);
ok("filtro por tipo de evento", r.ok && r.j.total === 1);
r = await rpc(U.owner_b, "audit_central_list", `null, null, null, null, 'outbox'`);
ok("filtro por tipo de entidade", r.ok && r.j.total === 1 && r.j.rows[0].entity_id === "OB_1");
r = await rpc(U.owner_b, "audit_central_list", `null, null, null, null, null, 'SYSTEM'`);
ok("filtro por tipo de ator (sistema distinto de humano)", r.ok && r.j.total === 1 && r.j.rows[0].actor_user_id === null);
r = await rpc(U.owner_b, "audit_central_list", `null, null, 'EXP-1'`);
ok("busca por entity_id", r.ok && r.j.total === 2);
r = await rpc(U.owner_b, "audit_central_list", `null, null, '${corr}'`);
ok("busca por correlation_id exato", r.ok && r.j.total === 2);
r = await rpc(U.owner_b, "audit_central_list", `null, null, '%'`);
ok("curinga % é literal (não casa tudo)", r.ok && r.j.total === 0, r.msg ?? r.j?.total);
r = await rpc(U.owner_b, "audit_central_list", `null, null, null, null, null, 'XPTO'`);
ok("tipo de ator inválido recusado", !r.ok && /inválido/.test(r.msg));

log("\n# 3. Detalhe e payload sensível");
r = await rpc(U.owner_b, "audit_central_detail", `'${idB}'`);
ok("owner B (audit.read_sensitive): vê payload completo e eventos relacionados = 1", r.ok && r.j.payload?.antes === 1 && r.j.payload_redacted === false && r.j.related_count === 1, r.msg ?? JSON.stringify(r.j));
r = await rpc(U.leitor_b, "audit_central_detail", `'${idB}'`);
ok("leitor B (só audit.read): payload nulo e payload_redacted=true", r.ok && r.j.payload === null && r.j.payload_redacted === true, r.msg ?? JSON.stringify(r.j));
r = await rpc(U.leitor_b, "audit_central_list");
ok("leitor B (só audit.read) lista normalmente", r.ok && r.j.total === 3);

log("\n# 4. Isolamento A/B e permissões");
r = await rpc(U.owner_b, "audit_central_detail", `'${idA}'`);
ok("owner B pedindo evento da empresa A: 'não encontrado'", !r.ok && /não encontrado/.test(r.msg), r.msg);
r = await rpc(U.owner_a, "audit_central_list");
ok("owner A vê só o seu (1)", r.ok && r.j.total === 1 && r.j.rows[0].entity_id === "EXP-A");
r = await rpc(U.sem_perm_b, "audit_central_overview");
ok("sem audit.read: overview negado", !r.ok && /Sem permiss/.test(r.msg), r.msg);
r = await rpc(U.sem_perm_b, "audit_central_list");
ok("sem audit.read: lista negada", !r.ok && /Sem permiss/.test(r.msg), r.msg);
r = await rpc(U.sem_perm_b, "audit_central_detail", `'${idB}'`);
ok("sem audit.read: detalhe negado", !r.ok && /Sem permiss/.test(r.msg), r.msg);
for (const [fn, args] of [["audit_central_overview", ""], ["audit_central_list", ""], ["audit_central_detail", `'${idB}'`]]) {
  r = await como(null, "anon", `select public.${fn}(${args})`);
  ok(`anon chamando ${fn}: permission denied`, negado(r), r.msg);
}
const priv = await q(`select p.oid::regprocedure::text f, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('public', p.oid, 'execute') pu, has_function_privilege('authenticated', p.oid, 'execute') u from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'audit_central_%'`);
ok("anon/public sem EXECUTE nas 4; authenticated só nas 3 públicas", priv.length === 4 && priv.every((x) => !x.a && !x.pu) && priv.filter((x) => x.u).length === 3, JSON.stringify(priv.map((x) => x.f.split("(")[0] + ":" + x.u)));

log("\n# 5. Append-only preservado e reversão");
await db.exec("select 1");
const tentativa = await db.query(`update public.audit_events set entity_id='X' where id='${idB}'`).then(() => "ok", (e) => e.message);
ok("audit_events continua append-only (update recusado)", /append-only/.test(tentativa), tentativa);
const antes = (await q("select count(*)::int n from public.audit_events"))[0].n;
await db.exec(REV);
ok("reversão remove as 4 funções e preserva audit_events", (await q("select count(*)::int n from pg_proc where proname like 'audit_central_%'"))[0].n === 0 && (await q("select count(*)::int n from public.audit_events"))[0].n === antes);
await db.exec(REV);
ok("reversão idempotente", true);
await db.exec(MIG);
r = await rpc(U.owner_b, "audit_central_list");
ok("reaplicar depois da reversão funciona", r.ok && r.j.total === 3);
await db.exec(MIG);
ok("migration reaplicável (create or replace)", true);

await db.close();
log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
process.exit(falhas === 0 ? 0 : 1);
