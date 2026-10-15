// Testes da integração de crédito do cliente no banco RECONSTRUÍDO (PGlite) a partir de supabase/migrations.
// NÃO é homologação: sem PostgREST, Auth nem concorrência real entre conexões (PGlite é monoconexão).
// A serialização por cliente (pg_advisory_xact_lock) fica sem prova de disputa real.
// Uso: PGLITE_DIR=<pasta com @electric-sql/pglite> node supabase/pendentes/testes_credito_cliente_replay.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = {
  owner: "00000000-0000-0000-0000-0000000000a1",
  vendedor: "00000000-0000-0000-0000-0000000000a2",
  autorizador: "00000000-0000-0000-0000-0000000000a3",
  gerente: "00000000-0000-0000-0000-0000000000a4",
  outra: "00000000-0000-0000-0000-0000000000b1",
};
const MIGRACAO = fs.readFileSync(path.join(repo, "supabase/pendentes/20261015120000_credito_cliente_fonte_unica.sql"), "utf8");
const db = await criarBanco();
let falhas = 0;
const log = (s = "") => console.log(s);
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };
const q = async (sql) => (await db.query(sql)).rows;

async function como(uid, sql) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: "authenticated" })}', false); set role authenticated;`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, msg: e.message };
  } finally {
    await db.exec("reset role;");
  }
}

log("# Reconstruindo o banco a partir de supabase/migrations");
const falhasReplay = await reaplicar(db, null, log);
ok("trilha reaplicada sem falha", falhasReplay.length === 0);
if (falhasReplay.length) process.exit(1);
await db.exec(MIGRACAO);
ok("migration pendente aplicada sobre a trilha", true);

await db.exec(`
  insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a'),('${B}','Empresa B','INDUSTRY','empresa-b');
  insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(",")};
  insert into public.units (id, company_id, name) values ('cccccccc-0000-0000-0000-00000000000c','${A}','Matriz');
`);
async function papel(uid, empresa, chave, perms) {
  const role = crypto.randomUUID();
  const mem = crypto.randomUUID();
  await db.exec(`
    insert into public.roles (id, company_id, key, name) values ('${role}','${empresa}','${chave}','${chave}');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${empresa}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
    insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${empresa}','${uid}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${empresa}','${mem}','${role}');`);
}
await papel(U.owner, A, "proprietario", ["billing.view_credit_analysis", "billing.invoice_order", "customer_credit.change_permanent_limit"]);
await papel(U.vendedor, A, "vendedor", ["billing.view_credit_analysis", "billing.view_receivables", "billing.invoice_order", "billing.request_credit_release"]);
await papel(U.autorizador, A, "autorizador", ["billing.view_credit_analysis", "billing.authorize_credit_exception"]);
await papel(U.gerente, A, "gerente", ["billing.view_credit_analysis", "billing.request_credit_release", "billing.authorize_credit_exception"]);
await papel(U.outra, B, "outra", ["billing.view_credit_analysis", "billing.invoice_order", "customer_credit.change_permanent_limit"]);

const novoCliente = async (nome) => (await q(`insert into public.customers (name, company_name, phone, company_id) values ('${nome}','${nome}','7199','${A}') returning id`))[0].id;
let seqPedido = 0;
const novoPedido = async (cli, total, status = "NEW") =>
  (await q(`insert into public.orders (order_number, customer_name, phone, total_amount, status, customer_id, company_id) values ('#T${++seqPedido}','x','7199',${total},'${status}','${cli}','${A}') returning id`))[0].id;
const setStatus = (ped, st) => db.exec(`update public.orders set status='${st}' where id='${ped}'`);
const ov = async (uid, cli, ped = "null", fin = 0) => (await como(uid, `select public.oris360_credit_overview('${cli}', ${ped === "null" ? "null" : `'${ped}'`}, ${fin}) as o`));
const pm = (valor, venc = "2026-12-01") => JSON.stringify([{ type: "BOLETO", amount: valor, generates_credit: true, installments: [{ number: 1, days: 30, due_date: venc, amount: valor }] }]);
const confirmar = (uid, ped, valor, chave) => como(uid, `select public.oris360_billing_confirm('${ped}','${pm(valor)}'::jsonb,'SEM_DOCUMENTO_FISCAL','${chave}') as id`);

log("\n# 3/4. Limite: permissão própria, motivo, auditoria, sem escrita direta");
const c1 = await novoCliente("Cliente 1");
let r = await como(U.vendedor, `select public.oris360_set_credit_limit('${c1}', 1000, 'aprovado em comite')`);
ok("sem permissão de alterar limite é recusado", !r.ok, r.msg);
r = await como(U.owner, `select public.oris360_set_credit_limit('${c1}', 1000, 'abc')`);
ok("motivo curto é recusado", !r.ok, r.msg);
r = await como(U.owner, `select public.oris360_set_credit_limit('${c1}', 1000, 'aprovado em comite')`);
ok("alteração autorizada retorna visão recalculada", r.ok && Number(r.rows[0].oris360_set_credit_limit.credit_limit) === 1000);
r = await como(U.owner, `update public.customer_credit set credit_limit = 99999 where customer_id = '${c1}'`);
ok("UPDATE direto em customer_credit contornando a RPC é recusado", !r.ok, r.msg);
r = await como(U.owner, `update public.customers set name = 'Cliente 1 editado' where id = '${c1}'`);
ok("edição cadastral comum não mexe no limite", Number((await q(`select credit_limit from public.customer_credit where customer_id='${c1}'`))[0].credit_limit) === 1000);
await como(U.owner, `select public.oris360_set_credit_limit('${c1}', 500, 'reducao por risco')`);
const aud = await q(`select old_limit, new_limit, changed_by from public.credit_limit_changes where customer_id='${c1}' order by created_at`);
ok("auditoria antes/depois e usuário", aud.length === 2 && Number(aud[0].old_limit) === 0 && Number(aud[1].old_limit) === 1000 && aud[1].changed_by === U.owner);
await como(U.owner, `select public.oris360_set_credit_limit('${c1}', 1000, 'restaura limite')`);

log("\n# 1/2/18. Mesma fonte e isolamento por empresa");
const o1 = (await ov(U.vendedor, c1)).rows[0].o;
const o1b = (await como(U.vendedor, `select public.oris360_billing_context('${await novoPedido(c1, 10)}') as c`)).rows[0].c.snapshot;
ok("ficha e Faturar leem o mesmo limite", Number(o1.credit_limit) === 1000 && Number(o1b.credit_limit) === 1000);
ok("outra empresa recebe null (não aprova nem vaza)", (await ov(U.outra, c1)).rows[0].o === null);
ok("usuário sem permissão de consulta recebe null", (await como(U.autorizador, `select 1`)).ok && (await ov("00000000-0000-0000-0000-00000000ffff", c1)).rows[0].o === null);

log("\n# 10/11/12. Reserva na transição CONFIRMED, idempotência, edição, cancelamento");
const c2 = await novoCliente("Cliente 2");
await como(U.owner, `select public.oris360_set_credit_limit('${c2}', 1000, 'limite inicial')`);
const p1 = await novoPedido(c2, 300);
ok("pedido NEW não reserva crédito", Number((await q(`select count(*) n from public.credit_commitments where order_id='${p1}'`))[0].n) === 0);
await setStatus(p1, "IN_REVIEW");
ok("IN_REVIEW não reserva", Number((await q(`select count(*) n from public.credit_commitments where order_id='${p1}'`))[0].n) === 0);
await setStatus(p1, "CONFIRMED");
await db.exec(`update public.orders set status='CONFIRMED', total_amount=300 where id='${p1}'`);
let cm = await q(`select amount, status from public.credit_commitments where order_id='${p1}'`);
ok("CONFIRMED reserva 1 compromisso (repetição não duplica)", cm.length === 1 && Number(cm[0].amount) === 300);
await db.exec(`update public.orders set total_amount=400 where id='${p1}'`);
cm = await q(`select amount from public.credit_commitments where order_id='${p1}' and status='ABERTO'`);
ok("edição do total atualiza o compromisso (não soma de novo)", cm.length === 1 && Number(cm[0].amount) === 400);
let v = (await ov(U.vendedor, c2)).rows[0].o;
ok("exposição atual = só o compromisso do pedido", Number(v.current_exposure) === 400 && Number(v.available) === 600);
v = (await ov(U.vendedor, c2, p1, 400)).rows[0].o;
ok("projeção desconta o compromisso do PRÓPRIO pedido (sem dupla contagem)", Number(v.projected_exposure) === 400 && Number(v.available_after) === 600, JSON.stringify({ proj: v.projected_exposure, apos: v.available_after }));
const p2 = await novoPedido(c2, 700, "CONFIRMED");
v = (await ov(U.vendedor, c2, p2, 700)).rows[0].o;
ok("2 pedidos reservados: o segundo enxerga o primeiro (limite não é reutilizado)", Number(v.current_exposure) === 1100 && Number(v.projected_exposure) === 1100 && Number(v.excess) === 100, JSON.stringify({ exp: v.current_exposure, excess: v.excess }));
ok("excesso aparece, não é escondido", v.blockers.includes("OVER_LIMIT"));
await setStatus(p2, "CANCELLED");
ok("cancelamento libera o compromisso", (await q(`select status from public.credit_commitments where order_id='${p2}'`))[0].status === "CANCELADO");

log("\n# 4/5/6/7/8/9/19/20. Bloqueio no servidor, liberação por operação, escopo");
const c3 = await novoCliente("Cliente 3");
await como(U.owner, `select public.oris360_set_credit_limit('${c3}', 1000, 'limite inicial')`);
const p3 = await novoPedido(c3, 200, "CONFIRMED");
r = await confirmar(U.vendedor, p3, 200, "k-p3-a");
ok("cliente regular dentro do limite fatura", r.ok, r.msg);
const b1 = r.rows?.[0]?.id;
r = await confirmar(U.vendedor, p3, 200, "k-p3-a");
ok("duplo clique (mesma chave) devolve o mesmo faturamento", r.ok && r.rows[0].id === b1);
ok("1 recebível, compromisso CONVERTIDO (sem dupla contagem)",
  Number((await q(`select count(*) n from public.receivables where billing_id='${b1}'`))[0].n) === 1 &&
  (await q(`select status from public.credit_commitments where order_id='${p3}'`))[0].status === "CONVERTIDO");
v = (await ov(U.vendedor, c3)).rows[0].o;
ok("exposição após faturar = recebível (200), não 400", Number(v.current_exposure) === 200 && Number(v.commitments) === 0);

const p4 = await novoPedido(c3, 900, "CONFIRMED");
r = await confirmar(U.vendedor, p4, 900, "k-p4");
ok("sem vencidos mas limite insuficiente: bloqueio no servidor", !r.ok && /OVER_LIMIT/.test(r.msg), r.msg);
await setStatus(p4, "CANCELLED");

await db.exec(`insert into public.receivables (customer_id, billing_id, amount, due_date, status) values ('${c3}','${b1}',50, ((now() at time zone 'America/Bahia')::date - 5), 'ABERTO')`);
v = (await ov(U.vendedor, c3)).rows[0].o;
ok("título vence pela data, sem edição: vencido=50, atraso=5", Number(v.overdue_amount) === 50 && Number(v.max_overdue_days) === 5 && v.blockers.includes("OVERDUE"));
ok("vencido faz parte da dívida (não soma de novo)", Number(v.open_receivables) === 250 && Number(v.current_exposure) === 250);
await db.exec(`update public.receivables set status='VENCIDO' where customer_id='${c3}' and amount=50`);
v = (await ov(U.vendedor, c3)).rows[0].o;
ok("status VENCIDO continua na exposição", Number(v.open_receivables) === 250);

const p5 = await novoPedido(c3, 100, "CONFIRMED");
r = await confirmar(U.vendedor, p5, 100, "k-p5");
ok("com boleto vencido: bloqueio OVERDUE no servidor", !r.ok && /OVERDUE/.test(r.msg), r.msg);
r = await como(U.vendedor, `select public.oris360_credit_authorize('${p5}', array['OVERDUE'], 'vendedor tentando liberar')`);
ok("vendedor só com permissão de vender não se autoriza", !r.ok, r.msg);
r = await como(U.vendedor, `select public.oris360_credit_request_release('${p5}', 'cliente antigo, pagara amanha')`);
ok("vendedor pode SOLICITAR liberação", r.ok, r.msg);
const rid = r.rows?.[0]?.oris360_credit_request_release;
r = await como(U.vendedor, `select public.oris360_credit_request_release('${p5}', 'cliente antigo, pagara amanha')`);
ok("solicitação repetida não duplica", r.ok && r.rows[0].oris360_credit_request_release === rid);
r = await como(U.gerente, `select public.oris360_credit_authorize('${p5}', array['OVERDUE'], 'autorizado pelo gerente')`);
ok("autorizador distinto do solicitante autoriza", r.ok, r.msg);
r = await confirmar(U.vendedor, p5, 100, "k-p5b");
ok("com OVERDUE autorizado, operação passa", r.ok, r.msg);
v = (await ov(U.vendedor, c3)).rows[0].o;
ok("liberação não quita título nem muda limite", Number(v.overdue_amount) === 50 && Number(v.credit_limit) === 1000);
const p6 = await novoPedido(c3, 100, "CONFIRMED");
r = await confirmar(U.vendedor, p6, 100, "k-p6");
ok("liberação de um pedido não libera outro", !r.ok && /OVERDUE/.test(r.msg), r.msg);

log("\n# 9. Dois impedimentos, só um autorizado");
const c4 = await novoCliente("Cliente 4");
await como(U.owner, `select public.oris360_set_credit_limit('${c4}', 100, 'limite baixo')`);
const pb = await novoPedido(c4, 500, "CONFIRMED");
await db.exec(`insert into public.receivables (customer_id, billing_id, amount, due_date, status) values ('${c4}','${b1}',10, ((now() at time zone 'America/Bahia')::date - 2), 'ABERTO')`);
await como(U.gerente, `select public.oris360_credit_authorize('${pb}', array['OVERDUE'], 'so o vencido')`);
r = await confirmar(U.vendedor, pb, 500, "k-pb");
ok("autorização parcial não remove o impedimento restante", !r.ok && /OVER_LIMIT/.test(r.msg) && !/OVERDUE/.test(r.msg), r.msg);
await como(U.gerente, `select public.oris360_credit_authorize('${pb}', array['OVERDUE','OVER_LIMIT'], 'ambos autorizados')`);
r = await confirmar(U.vendedor, pb, 500, "k-pb2");
ok("com ambos autorizados passa", r.ok, r.msg);

log("\n# 20. Autorização perde validade se o pedido muda materialmente");
const pc = await novoPedido(c4, 100, "CONFIRMED");
await como(U.gerente, `select public.oris360_credit_authorize('${pc}', array['OVERDUE','OVER_LIMIT'], 'autorizado valor original')`);
await db.exec(`update public.orders set total_amount = 900 where id='${pc}'`);
ok("aumento do total invalida a autorização", (await q(`select status from public.credit_authorizations where order_id='${pc}'`))[0].status === "INVALIDADA");
r = await confirmar(U.vendedor, pc, 900, "k-pc");
ok("faturar após mudança material exige nova análise", !r.ok && /credito bloqueado/.test(r.msg), r.msg);

log("\n# 17. Sem permissão de consulta não há aprovação implícita");
ok("overview sem permissão = null (cliente trata como indisponível)", (await ov(U.outra, c3)).rows[0].o === null);

log(falhas ? `\nRESULTADO: ${falhas} FALHA(S)` : "\nRESULTADO: todos os testes passaram (banco reconstruído, não é homologação)");
await db.close();
process.exit(falhas ? 1 : 0);
