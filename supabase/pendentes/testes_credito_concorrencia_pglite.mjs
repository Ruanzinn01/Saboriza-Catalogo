// Concorrência de crédito em PGlite. LIMITE HONESTO: PGlite é monoconexão (consultas simultâneas são
// enfileiradas), então NÃO prova disputa real entre duas transações. Este teste prova (1) o invariante
// "dívida aberta nunca passa do limite" em sequência de disputas, (2) que a mesma chave de idempotência
// disparada duas vezes ao mesmo tempo gera um único faturamento e (3) que toda RPC de escrita de crédito
// toma pg_advisory_xact_lock por cliente. A prova real fica em scripts/homologacao/credito_concorrencia.sql.
// Uso: PGLITE_DIR=<pasta> node supabase/pendentes/testes_credito_concorrencia_pglite.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const OWNER = "00000000-0000-0000-0000-0000000000a1";
const db = await criarBanco();
let falhas = 0;
const ok = (nome, cond, det = "") => { if (!cond) falhas += 1; console.log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${det ? "  -> " + det : ""}`); };
const q = async (sql) => (await db.query(sql)).rows;

ok("trilha reaplicada", (await reaplicar(db, null, () => {})).length === 0);
await db.exec(fs.readFileSync(path.join(repo, "supabase/pendentes/20261015120000_credito_cliente_fonte_unica.sql"), "utf8"));
await db.exec(`
  insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a');
  insert into auth.users (id) values ('${OWNER}');
  insert into public.units (id, company_id, name) values ('cccccccc-0000-0000-0000-00000000000c','${A}','Matriz');
  insert into public.roles (id, company_id, key, name) values ('dddddddd-0000-0000-0000-00000000000d','${A}','prop','prop');
  insert into public.role_permissions (company_id, role_id, permission_key)
    select '${A}','dddddddd-0000-0000-0000-00000000000d', key from public.permissions
    where key in ('billing.view_credit_analysis','billing.view_receivables','billing.invoice_order','customer_credit.change_permanent_limit');
  insert into public.memberships (id, company_id, user_id, status) values ('eeeeeeee-0000-0000-0000-00000000000e','${A}','${OWNER}','ACTIVE');
  insert into public.membership_roles (company_id, membership_id, role_id) values ('${A}','eeeeeeee-0000-0000-0000-00000000000e','dddddddd-0000-0000-0000-00000000000d');`);

async function como(sql) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: OWNER, role: "authenticated" })}', false); set role authenticated;`);
  try { return { ok: true, rows: (await db.query(sql)).rows }; } catch (e) { return { ok: false, msg: e.message }; } finally { await db.exec("reset role;"); }
}
const cli = (await q(`insert into public.customers (name, company_name, phone, company_id) values ('C','C','7199','${A}') returning id`))[0].id;
await como(`select public.oris360_set_credit_limit('${cli}', 1000, 'limite inicial')`);
let seq = 0;
const pedido = async (total) => (await q(`insert into public.orders (order_number, customer_name, phone, total_amount, status, customer_id, company_id) values ('#K${++seq}','x','7199',${total},'CONFIRMED','${cli}','${A}') returning id`))[0].id;
const pm = (v) => JSON.stringify([{ type: "BOLETO", amount: v, generates_credit: true, installments: [{ number: 1, days: 30, due_date: "2026-12-01", amount: v }] }]);
const fatura = (ped, v, k) => como(`select public.oris360_billing_confirm('${ped}','${pm(v)}'::jsonb,'SEM_DOCUMENTO_FISCAL','${k}') as id`);
const aberto = async () => Number((await q(`select coalesce(sum(amount),0) s from public.receivables where customer_id='${cli}' and status in ('ABERTO','VENCIDO')`))[0].s);

console.log("# 1. Invariante: dívida aberta <= limite em sequência de disputas pelo mesmo limite");
const p1 = await pedido(600), p2 = await pedido(600);
let r1 = await fatura(p1, 600, "conc-k1");
let r2 = await fatura(p2, 600, "conc-k2");
ok("dois pedidos de 600 reservados com limite 1000: ambos bloqueados (reserva conservadora)", !r1.ok && !r2.ok, r1.msg ?? "");
await db.exec(`update public.orders set status='CANCELLED' where id='${p2}'`);
r1 = await fatura(p1, 600, "conc-k1");
ok("liberado o segundo, o primeiro fatura", r1.ok, r1.msg);
const p3 = await pedido(600);
r2 = await fatura(p3, 600, "conc-k3");
ok("o próximo de 600 não passa (600+600 > 1000)", !r2.ok && /OVER_LIMIT/.test(r2.msg ?? ""), r2.msg);
ok("dívida aberta nunca excede o limite", (await aberto()) <= 1000, `aberto=${await aberto()}`);

console.log("\n# 2. Mesma chave de idempotência disparada em paralelo -> 1 faturamento");
await db.exec(`update public.orders set status='CANCELLED' where id='${p3}'`);
const p4 = await pedido(300);
const [x, y] = await Promise.all([fatura(p4, 300, "conc-dup"), fatura(p4, 300, "conc-dup")]);
const nB = Number((await q(`select count(*) n from public.billings where idempotency_key='conc-dup'`))[0].n);
ok("duas chamadas simultâneas, mesma chave: 1 billing e mesmo id", x.ok && y.ok && nB === 1 && x.rows[0].id === y.rows[0].id, `billings=${nB}`);
ok("dívida segue <= limite", (await aberto()) <= 1000, `aberto=${await aberto()}`);

console.log("\n# 3. Toda RPC/gatilho de escrita de crédito serializa por cliente");
for (const [esquema, nome] of [["public", "oris360_billing_confirm"], ["public", "oris360_set_credit_limit"], ["public", "oris360_credit_request_release"], ["public", "oris360_credit_authorize"], ["private", "sync_credit_commitment"]]) {
  const src = (await q(`select string_agg(pg_get_functiondef(p.oid), ' ') d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='${esquema}' and p.proname='${nome}'`))[0].d ?? "";
  ok(`${esquema}.${nome} usa pg_advisory_xact_lock`, /pg_advisory_xact_lock\(\s*hashtextextended/.test(src));
}

console.log("\n# 4. Limite de PGlite");
console.log("[INFO] consultas simultâneas em PGlite são serializadas; a disputa real de bloqueio exige duas conexões (homologação).");
console.log(falhas ? `\nRESULTADO: ${falhas} FALHA(S)` : "\nRESULTADO: ok (SEM prova de concorrência real)");
await db.close();
process.exit(falhas ? 1 : 0);
