// Testes de public.update_employee_salary antes e depois das fases 1+2 de segurança de salário/Pix (PGlite). NÃO é homologação.
// Uso: PGLITE_DIR=<pasta com @electric-sql/pglite> node supabase/pendentes/testes_update_employee_salary.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const FASE1 = read("supabase/pendentes/seguranca_salario_pix_1_aditiva.sql");
const FASE2 = read("supabase/pendentes/seguranca_salario_pix_2_restritiva.sql");
const REV2 = read("supabase/pendentes/seguranca_salario_pix_reverter_2.sql");

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = { plain_a: "00000000-0000-0000-0000-0000000000a2", owner_b: "00000000-0000-0000-0000-0000000000b1", rh_a: "00000000-0000-0000-0000-0000000000c2", desp_a: "00000000-0000-0000-0000-0000000000a3" };
const EA = "eeeeeeee-0000-0000-0000-0000000000a1";
const EB = "eeeeeeee-0000-0000-0000-0000000000b1";

const db = await criarBanco();
const falhasReplay = await reaplicar(db, null, () => {});
let falhas = 0;
const ok = (nome, cond, det = "") => { if (!cond) falhas += 1; console.log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${det ? "  -> " + det : ""}`); };
ok("trilha reaplicada sem falhas", falhasReplay.length === 0, JSON.stringify(falhasReplay));
const q = async (sql) => (await db.query(sql)).rows;

async function como(uid, role, sql) {
  const claims = uid ? JSON.stringify({ sub: uid, role }) : "";
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false); set role ${role};`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows }; } catch (e) { return { ok: false, code: e.code, msg: e.message }; } finally { await db.exec("reset role;"); }
}
const auth = (uid, sql) => como(uid, "authenticated", sql);
const chama = (uid, emp, valor, data) => auth(uid, `select public.update_employee_salary('${emp}', ${valor}, '${data}')`);

async function papel(uid, empresa, chave, perms) {
  const role = crypto.randomUUID(); const mem = crypto.randomUUID();
  await db.exec(`
    insert into public.roles (id, company_id, key, name) values ('${role}','${empresa}','${chave}','${chave}');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${empresa}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
    insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${empresa}','${uid}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${empresa}','${mem}','${role}');`);
}
const estado = async (emp) => (await q(`select salary_base::numeric, salary_effective_date::text d, (select count(*)::int from public.salary_history where employee_id = '${emp}') h from public.employees where id = '${emp}'`))[0];
const auditorias = async () => Number((await q("select count(*) n from public.audit_events where event_type = 'employee.compensation_changed' and payload::text like '%update_employee_salary%'"))[0].n);

await db.exec(`
  insert into auth.users (id) values ('${U.plain_a}'), ('${U.owner_b}'), ('${U.rh_a}'), ('${U.desp_a}') on conflict do nothing;
  insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a'),('${B}','Empresa B','INDUSTRY','empresa-b');
  insert into public.employees (id, company_id, code, name, status, admission_date, salary_base, cpf) values
    ('${EA}','${A}','A1','Colaborador A','ATIVO','2026-01-05',5000,'11111111111'),
    ('${EB}','${B}','B1','Colaborador B','ATIVO','2026-01-05',7000,'33333333333');
  insert into public.salary_history (company_id, employee_id, salary_base, effective_date) values ('${A}','${EA}',5000,'2026-01-01'),('${B}','${EB}',7000,'2026-01-01');`);
await papel(U.plain_a, A, "membro_comum", ["despesas.read", "tarefas.read"]);
await papel(U.owner_b, B, "dono_b", ["despesas.manage", "despesas.read"]);

console.log("\n# 1. ESTADO ATUAL (equivalente a produção, sem fases)");
let r = await chama(U.owner_b, EA, 1, "2026-07-01");
ok("usuário da empresa B NÃO altera salário da empresa A", !r.ok && /Sem permissão/.test(r.msg), r.msg);
r = await como(null, "anon", `select public.update_employee_salary('${EA}', 1, '2026-07-01')`);
ok("anon NÃO executa (permission denied)", !r.ok && r.code === "42501", r.msg);
r = await chama(U.plain_a, "00000000-0000-0000-0000-00000000dead", 1, "2026-07-01");
ok("colaborador inexistente: erro claro", !r.ok && /não encontrado/.test(r.msg), r.msg);
r = await chama(U.plain_a, EA, -5, "2026-07-01");
ok("salário negativo rejeitado", !r.ok && /inválido/.test(r.msg), r.msg);
r = await chama(U.plain_a, EA, 4321, "2026-03-01");
ok("LACUNA ATUAL: membro comum da própria empresa altera salário (só exige ser membro ativo)", r.ok);
console.log(`       estado após: ${JSON.stringify(await estado(EA))}`);
ok("sem auditoria no estado atual", (await auditorias()) === 0);

console.log("\n# 2. FASES 1+2 APLICADAS");
await db.exec(FASE1);
await papel(U.rh_a, A, "rh_gestao", ["colaboradores.remuneracao.manage"]);
await db.exec(FASE2);
await papel(U.desp_a, A, "despesas_criado_depois", ["despesas.manage", "despesas.read"]);
const base = await estado(EA);
r = await chama(U.plain_a, EA, 1, "2026-09-01");
ok("membro comum: NEGADO", !r.ok && /Sem permissão/.test(r.msg), r.msg);
r = await chama(U.desp_a, EA, 1, "2026-09-01");
ok("papel de despesas criado DEPOIS da fase 1 (não herda remuneração): NEGADO", !r.ok && /Sem permissão/.test(r.msg), r.msg);
r = await chama(U.owner_b, EA, 1, "2026-09-01");
ok("usuário da empresa B: NEGADO", !r.ok && /Sem permissão/.test(r.msg), r.msg);
r = await como(null, "anon", `select public.update_employee_salary('${EA}', 1, '2026-09-01')`);
ok("anon: permission denied", !r.ok && r.code === "42501", r.msg);
const aposNegados = await estado(EA);
ok("nenhuma tentativa negada alterou salário nem histórico", JSON.stringify(base) === JSON.stringify(aposNegados), JSON.stringify(aposNegados));
r = await chama(U.rh_a, EA, -1, "2026-09-01");
ok("RH: salário negativo rejeitado", !r.ok && /inválido/.test(r.msg), r.msg);
r = await chama(U.rh_a, EB, 100, "2026-09-01");
ok("RH da empresa A NÃO altera colaborador da empresa B", !r.ok && /Sem permissão/.test(r.msg), r.msg);
r = await chama(U.rh_a, EA, 5800, "2026-08-01");
const s1 = await estado(EA);
ok("RH: altera, grava histórico e atualiza o salário vigente", r.ok && Number(s1.salary_base) === 5800 && s1.d === "2026-08-01" && s1.h === base.h + 1, JSON.stringify(s1));
r = await chama(U.rh_a, EA, 4000, "2026-02-01");
const s2 = await estado(EA);
ok("RH: reajuste retroativo entra no histórico mas NÃO sobrescreve o salário vigente", r.ok && Number(s2.salary_base) === 5800 && s2.h === s1.h + 1, JSON.stringify(s2));
ok("alterações permitidas geram auditoria (2 eventos)", (await auditorias()) === 2, String(await auditorias()));
r = await auth(U.rh_a, "select salary_base from public.employees limit 1");
ok("após a fase 2 nem o RH lê a coluna direto (só por RPC)", !r.ok && r.code === "42501", r.msg);

console.log("\n# 3. REVERSÃO DA FASE 2");
await db.exec(REV2);
r = await chama(U.plain_a, EA, 4500, "2026-10-01");
ok("após reverter a fase 2 o membro comum volta a conseguir (comportamento antigo restaurado)", r.ok, r.msg);

console.log(falhas ? `\nResultado: ${falhas} FALHA(S)` : "\nResultado: TODOS OS TESTES PASSARAM");
await db.close();
process.exit(falhas ? 1 : 0);
