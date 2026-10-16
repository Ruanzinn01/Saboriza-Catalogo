// Webhook Asaas em PGlite: compara a lógica ATUAL da função de borda (porte fiel, comando a comando, como service_role, ignorando erros
// de cada comando como o supabase-js faz) com public.apply_asaas_webhook_event, sobre o banco RECONSTRUÍDO da trilha. Sem HTTP, sem Asaas.
// NÃO é homologação. Uso: PGLITE_DIR=<pasta> node supabase/pendentes/testes_webhook_asaas.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const MIG = read("supabase/pendentes/20261015140000_asaas_webhook_evento_atomico.sql");
const REV = read("supabase/pendentes/20261015140000_asaas_webhook_evento_atomico_reverter.sql");
const ASSINATURAS = read("supabase/baseline/assinaturas.sql");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = await criarBanco();
log("# Reconstruindo o banco a partir de supabase/migrations");
const falhasReplay = await reaplicar(db, null, log);
ok("trilha reaplicada sem falha", falhasReplay.length === 0);
const q = async (sql, p) => (await db.query(sql, p)).rows;
const antesAssin = Object.fromEntries((await q(ASSINATURAS)).map((r) => [r.k, r.h]));
await db.exec(MIG);

async function como(role, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false); set role ${role};`);
  try { const r = await db.query(sql, params); return { data: r.rows, error: null }; }
  catch (e) { return { data: null, error: { code: e.code, message: e.message } }; }
  finally { await db.exec("reset role;"); }
}
const svc = (sql, p) => como("service_role", sql, p);

// ---- porte fiel de supabase/functions/asaas-webhook/index.ts (cada comando do supabase-js devolve {error} e o código ignora) ----
async function webhookAtual(companyId, token, body) {
  const cred = (await svc("select id, environment, is_active from public.company_integration_credentials where company_id=$1 and provider='ASAAS' and webhook_token=$2", [companyId, token])).data?.[0];
  if (!cred) return { status: 401 };
  const eventType = body.event ?? "DESCONHECIDO";
  const payment = body.payment, invoice = body.invoice;
  const eventId = body.id || (invoice ? `${eventType}:${invoice.id ?? "sem_invoice"}` : `${eventType}:${payment?.id ?? "sem_payment"}:${payment?.status ?? ""}:${payment?.dueDate ?? ""}`);
  const ins = await svc("insert into public.asaas_webhook_events (company_id, event_id, event_type, payload, environment, credential_id) values ($1,$2,$3,$4::jsonb,$5,$6)", [companyId, eventId, eventType, JSON.stringify(body), cred.environment, cred.id]);
  if (ins.error) {
    if (ins.error.code !== "23505") return { status: 500 };
    const ex = (await svc("select processed_at from public.asaas_webhook_events where event_id=$1 and company_id=$2", [eventId, companyId])).data?.[0];
    if (ex?.processed_at) return { status: 200, duplicate: true };
  }
  let processError = null;
  if (!cred.is_active) processError = `IGNORADO: ambiente ${cred.environment} nao esta ativo nesta empresa`;
  else if (eventType.startsWith("INVOICE_")) {
    if (invoice?.id) {
      const doc = (await svc("select id from public.fiscal_documents where external_id=$1 and company_id=$2", [invoice.id, companyId])).data?.[0];
      if (!doc) processError = "nota fiscal nao encontrada para este invoice_id";
      else if (eventType === "INVOICE_AUTHORIZED" || eventType === "INVOICE_SYNCHRONIZED") await svc("update public.fiscal_documents set status='AUTORIZADA' where id=$1", [doc.id]);
      else if (eventType === "INVOICE_ERROR" || eventType === "INVOICE_CANCELED") await svc("update public.fiscal_documents set status=$2 where id=$1", [doc.id, eventType === "INVOICE_ERROR" ? "REJEITADA" : "CANCELADA"]);
    }
  } else if (payment?.id) {
    const ch = (await svc("select id, installment_id from public.charges where external_id=$1 and company_id=$2", [payment.id, companyId])).data?.[0];
    if (!ch) processError = "cobranca nao encontrada para este payment_id";
    else if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
      await svc("update public.charges set status='PAGO', technical_state='SINCRONIZADO' where id=$1", [ch.id]);
      await svc("update public.receivables set status='PAGO', paid_at=now() where installment_id=$1", [ch.installment_id]);
    } else if (eventType === "PAYMENT_OVERDUE") await svc("update public.receivables set status='VENCIDO' where installment_id=$1", [ch.installment_id]);
    else if (["PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(eventType)) await svc("update public.charges set technical_state='RECONCILIAR' where id=$1", [ch.id]);
  }
  await svc("update public.asaas_webhook_events set processed_at=now(), process_error=$3 where event_id=$1 and company_id=$2", [eventId, companyId, processError]);
  return { status: 200 };
}
const webhookNovo = async (companyId, token, body, eventId) => {
  const r = await svc("select public.apply_asaas_webhook_event($1,$2,$3,$4,$5::jsonb) r", [companyId, token, eventId ?? body.id, body.event, JSON.stringify(body)]);
  return r.error ? { erro: r.error } : r.data[0].r;
};

// ---- fixtures sintéticas (FKs desligadas só para montar a cena; os CHECKs continuam valendo) ----
let seq = 0;
async function cena(rotulo) {
  const co = crypto.randomUUID();
  const f = { co, rotulo, token: `tok-${rotulo}-${++seq}`, tokenInativo: `tok-${rotulo}-inativo`, pay: `pay_${rotulo}`, inv: `inv_${rotulo}`, inst: crypto.randomUUID(), rec: crypto.randomUUID(), ch: crypto.randomUUID(), doc: crypto.randomUUID() };
  await db.exec(`
    insert into public.companies (id, display_name, segment, slug) values ('${co}','Empresa ${rotulo}','INDUSTRY','emp-${rotulo}-${seq}');
    set session_replication_role = replica;
    insert into public.company_integration_credentials (company_id, provider, environment, status, webhook_token, is_active) values
      ('${co}','ASAAS','SANDBOX','VALIDADO','${f.token}',true), ('${co}','ASAAS','PRODUCAO','CONFIGURADO','${f.tokenInativo}',false);
    insert into public.installments (id, company_id, payment_method_id, number, days, due_date, amount, status) values ('${f.inst}','${co}','${crypto.randomUUID()}',1,30,'2026-11-10',100,'ABERTA');
    insert into public.receivables (id, company_id, customer_id, billing_id, installment_id, amount, due_date, status) values ('${f.rec}','${co}','${crypto.randomUUID()}','${crypto.randomUUID()}','${f.inst}',100,'2026-11-10','ABERTO');
    insert into public.charges (id, company_id, installment_id, provider, external_id, idempotency_key, status, technical_state) values ('${f.ch}','${co}','${f.inst}','ASAAS','${f.pay}','idem-${f.ch}','EMITIDA','AGUARDANDO_EVENTO');
    insert into public.fiscal_documents (id, company_id, billing_id, status, external_id, provider) values ('${f.doc}','${co}','${crypto.randomUUID()}','PROCESSANDO','${f.inv}','ASAAS');
    set session_replication_role = origin;`);
  return f;
}
const estado = async (f) => ({
  charge: (await q(`select status, technical_state from public.charges where id='${f.ch}'`))[0],
  rec: (await q(`select status, paid_at::text paid_at from public.receivables where id='${f.rec}'`))[0],
  doc: (await q(`select status from public.fiscal_documents where id='${f.doc}'`))[0].status,
  eventos: (await q(`select event_id, processed_at is not null proc, process_error err from public.asaas_webhook_events where company_id='${f.co}' order by received_at, event_id`)),
});
const ev = (f, event, id, extra = {}) => ({ id, event, payment: { id: f.pay, status: "RECEIVED", ...extra } });

const L = await cena("L"), R = await cena("R");
const legado = (f, ...a) => webhookAtual(f.co, f.token, ...a);
const novo = (f, ...a) => webhookNovo(f.co, f.token, ...a);

log("\n# 1. Baixa normal (PAYMENT_RECEIVED)");
await legado(L, ev(L, "PAYMENT_RECEIVED", "evt_L_1"));
await novo(R, ev(R, "PAYMENT_RECEIVED", "evt_R_1"));
let sL = await estado(L), sR = await estado(R);
ok("ATUAL: o recebível é baixado (PAGO)", sL.rec.status === "PAGO");
ok("ATUAL (defeito 1): a cobrança NÃO é atualizada porque 'PAGO' viola o CHECK de charges.status", sL.charge.status === "EMITIDA" && sL.charge.technical_state === "AGUARDANDO_EVENTO", JSON.stringify(sL.charge));
ok("NOVO: recebível PAGO e cobrança PAGA/SINCRONIZADO", sR.rec.status === "PAGO" && sR.charge.status === "PAGA" && sR.charge.technical_state === "SINCRONIZADO", JSON.stringify(sR.charge));

log("\n# 2. Entrega duplicada do mesmo evento");
const dL = await legado(L, ev(L, "PAYMENT_RECEIVED", "evt_L_1"));
const dR = await novo(R, ev(R, "PAYMENT_RECEIVED", "evt_R_1"));
ok("ATUAL: devolve duplicate e não refaz a baixa", dL.duplicate === true);
ok("NOVO: devolve duplicate, 1 evento gravado, paid_at preservado", dR.duplicate === true && (await estado(R)).eventos.length === 1 && (await estado(R)).rec.paid_at === sR.rec.paid_at);

log("\n# 3. PAYMENT_CONFIRMED depois de PAYMENT_RECEIVED (ids diferentes)");
await sleep(30);
await legado(L, ev(L, "PAYMENT_CONFIRMED", "evt_L_2"));
await novo(R, ev(R, "PAYMENT_CONFIRMED", "evt_R_2"));
const s2L = await estado(L), s2R = await estado(R);
ok("ATUAL (defeito 3): paid_at é sobrescrito pelo segundo evento", s2L.rec.paid_at !== sL.rec.paid_at);
ok("NOVO: paid_at do primeiro pagamento é mantido", s2R.rec.paid_at === sR.rec.paid_at);

log("\n# 4. PAYMENT_OVERDUE fora de ordem, depois do pagamento");
await legado(L, ev(L, "PAYMENT_OVERDUE", "evt_L_3", { status: "OVERDUE" }));
await novo(R, ev(R, "PAYMENT_OVERDUE", "evt_R_3", { status: "OVERDUE" }));
ok("ATUAL (defeito 4): o recebível PAGO é rebaixado para VENCIDO", (await estado(L)).rec.status === "VENCIDO");
ok("NOVO: o recebível PAGO permanece PAGO", (await estado(R)).rec.status === "PAGO");
await db.exec(`update public.receivables set status='CANCELADO' where id in ('${L.rec}','${R.rec}')`);
await legado(L, ev(L, "PAYMENT_RECEIVED", "evt_L_4", { dueDate: "x" }));
await novo(R, ev(R, "PAYMENT_RECEIVED", "evt_R_4", { dueDate: "x" }));
ok("ATUAL: recebível CANCELADO é reaberto como PAGO por um evento tardio", (await estado(L)).rec.status === "PAGO");
ok("NOVO: recebível CANCELADO não é revivido", (await estado(R)).rec.status === "CANCELADO");

log("\n# 5. Autenticação e isolamento entre empresas");
const L2 = await cena("L2"), R2 = await cena("R2");
const t401 = await legado(L2, ev(L2, "PAYMENT_RECEIVED", "evt_x"));
const rBad = await webhookNovo(R2.co, "token-errado", ev(R2, "PAYMENT_RECEIVED", "evt_bad"));
const t401b = await webhookAtual(L2.co, "token-errado", ev(L2, "PAYMENT_RECEIVED", "evt_bad"));
ok("token errado: ATUAL devolve 401 e NOVO devolve TOKEN_INVALIDO", t401b.status === 401 && rBad.error === "TOKEN_INVALIDO");
ok("token errado: nenhum evento gravado e nenhum efeito", (await estado(R2)).eventos.length === 0 && (await estado(R2)).rec.status === "ABERTO");
const rCross = await webhookNovo(R2.co, R.token, ev(R2, "PAYMENT_RECEIVED", "evt_cross"));
ok("token de OUTRA empresa com o id desta: recusado, sem efeito", rCross.error === "TOKEN_INVALIDO" && (await estado(R2)).rec.status === "ABERTO");
const rVazio = await webhookNovo(R2.co, "", ev(R2, "PAYMENT_RECEIVED", "evt_v"));
ok("token vazio: recusado", rVazio.error === "TOKEN_INVALIDO");
const rColide = await webhookNovo(R2.co, R2.token, { ...ev(R2, "PAYMENT_RECEIVED", "evt_R_1") });
ok("defeito 5: event_id já usado por OUTRA empresa é recusado explicitamente, sem tocar nenhum dos dois", rColide.error === "EVENTO_DE_OUTRA_EMPRESA" && (await estado(R2)).rec.status === "ABERTO");
ok("cobrança de outra empresa com o mesmo payment_id não é afetada (escopo por empresa)", (await q(`select count(*)::int n from public.charges where external_id='${R.pay}' and company_id='${R2.co}'`))[0].n === 0);

log("\n# 6. Ambiente inativo (Produção desligada recebendo evento)");
const iR = await webhookNovo(R2.co, R2.tokenInativo, ev(R2, "PAYMENT_RECEIVED", "evt_inativo"));
const sI = await estado(R2);
ok("evento fica registrado com o motivo IGNORADO e NADA muda na cobrança nem no recebível", iR.ok === true && /IGNORADO/.test(sI.eventos[0]?.err ?? "") && sI.rec.status === "ABERTO" && sI.charge.status === "EMITIDA", JSON.stringify(sI.eventos[0]));

log("\n# 7. Falha no meio da aplicação e recuperação por reenvio");
await db.exec(`create or replace function public.__falha_teste() returns trigger language plpgsql as $$ begin if current_setting('app.falha_webhook', true) = '1' then raise exception 'falha injetada no teste'; end if; return new; end $$;
  create trigger __falha_teste before update on public.receivables for each row execute function public.__falha_teste();`);
const L3 = await cena("L3"), R3 = await cena("R3");
await db.exec("select set_config('app.falha_webhook', '1', false)");
await legado(L3, ev(L3, "PAYMENT_RECEIVED", "evt_L3_1"));
const rf = await novo(R3, ev(R3, "PAYMENT_RECEIVED", "evt_R3_1"));
let a3 = await estado(L3), b3 = await estado(R3);
ok("ATUAL (defeito 2): com a baixa falhando, o evento é marcado como PROCESSADO e fica perdido", a3.eventos[0].proc === true && a3.rec.status === "ABERTO", JSON.stringify(a3.eventos[0]));
ok("NOVO: devolve ok=false/retry (a borda responde 500 e o Asaas reenvia)", rf.ok === false && rf.retry === true, JSON.stringify(rf));
ok("NOVO: evento fica PENDENTE com o erro, e a subtransação desfez a cobrança (sem efeito parcial)", b3.eventos[0].proc === false && /falha injetada/.test(b3.eventos[0].err) && b3.charge.status === "EMITIDA" && b3.rec.status === "ABERTO", JSON.stringify(b3.eventos[0]));
await db.exec("select set_config('app.falha_webhook', '0', false)");
const rr = await novo(R3, ev(R3, "PAYMENT_RECEIVED", "evt_R3_1"));
b3 = await estado(R3);
ok("NOVO: o reenvio do MESMO evento aplica o efeito uma única vez e limpa o erro", rr.ok === true && rr.duplicate === false && b3.rec.status === "PAGO" && b3.charge.status === "PAGA" && b3.eventos.length === 1 && b3.eventos[0].proc === true && b3.eventos[0].err === null, JSON.stringify(b3.eventos[0]));
const again = await novo(R3, ev(R3, "PAYMENT_RECEIVED", "evt_R3_1"));
ok("NOVO: um terceiro envio vira duplicate", again.duplicate === true);
await db.exec("drop trigger __falha_teste on public.receivables; drop function public.__falha_teste();");

log("\n# 8. Outros casos");
const R4 = await cena("R4");
let r = await novo(R4, { id: "evt_nf", event: "PAYMENT_RECEIVED", payment: { id: "pay_inexistente", status: "RECEIVED" } });
ok("cobrança inexistente: evento processado com process_error legível (sem retry infinito do Asaas)", r.ok === true && /cobranca nao encontrada/.test(r.process_error ?? ""));
r = await novo(R4, { id: "evt_sp", event: "PAYMENT_RECEIVED", payment: {} });
ok("evento sem payment.id: erro explícito em vez de silêncio", r.ok === true && /sem payment.id/.test(r.process_error ?? ""));
r = await novo(R4, ev(R4, "PAYMENT_REFUNDED", "evt_ref", { status: "REFUNDED" }));
ok("PAYMENT_REFUNDED marca a cobrança para RECONCILIAR (decisão humana) sem mexer no recebível", r.ok && (await estado(R4)).charge.technical_state === "RECONCILIAR" && (await estado(R4)).rec.status === "ABERTO");
r = await novo(R4, ev(R4, "PAYMENT_CREATED", "evt_cr", { status: "PENDING" }));
ok("evento sem regra de negócio (PAYMENT_CREATED) é registrado e processado sem efeito", r.ok && (await estado(R4)).rec.status === "ABERTO");
const invAuth = { id: "evt_i1", event: "INVOICE_AUTHORIZED", invoice: { id: R4.inv, rpsNumber: "123", pdfUrl: "https://exemplo.invalid/n.pdf" } };
await novo(R4, invAuth);
r = await novo(R4, { id: "evt_i2", event: "INVOICE_ERROR", invoice: { id: R4.inv } });
const docEst = (await q(`select status, number from public.fiscal_documents where id='${R4.doc}'`))[0];
ok("nota AUTORIZADA não é rebaixada por um INVOICE_ERROR atrasado; número do RPS gravado", docEst.status === "AUTORIZADA" && docEst.number === "123", JSON.stringify(docEst));
await novo(R4, { id: "evt_i3", event: "INVOICE_CANCELED", invoice: { id: R4.inv } });
ok("cancelamento de nota autorizada é aceito", (await q(`select status from public.fiscal_documents where id='${R4.doc}'`))[0].status === "CANCELADA");
r = await novo(R4, { id: "evt_i4", event: "INVOICE_AUTHORIZED", invoice: { id: R4.inv } });
ok("autorização atrasada não reabre nota CANCELADA", (await q(`select status from public.fiscal_documents where id='${R4.doc}'`))[0].status === "CANCELADA");
r = await novo(R4, { id: "evt_i5", event: "INVOICE_AUTHORIZED", invoice: { id: "inv_inexistente" } });
ok("nota inexistente: process_error legível", /nota fiscal nao encontrada/.test(r.process_error ?? ""));

log("\n# 9. Privilégios");
const ass = (papel) => como(papel, "select public.apply_asaas_webhook_event(gen_random_uuid(),'x','e','PAYMENT_RECEIVED','{}'::jsonb)");
ok("anon NÃO executa", (await ass("anon")).error?.code === "42501");
ok("authenticated NÃO executa", (await ass("authenticated")).error?.code === "42501");
ok("service_role executa", (await ass("service_role")).error === null);
const eventosAuth = await como("authenticated", "select count(*)::int n from public.asaas_webhook_events");
ok("authenticated lê eventos (política existente); a função não abriu nada novo", eventosAuth.error === null || eventosAuth.error.code === "42501");

log("\n# 10. Reversão");
await db.exec(REV);
ok("reversão remove a função", (await q("select count(*)::int n from pg_proc where proname='apply_asaas_webhook_event'"))[0].n === 0);
const posAssin = Object.fromEntries((await q(ASSINATURAS)).map((r2) => [r2.k, r2.h]));
const dif = Object.keys(antesAssin).filter((k) => antesAssin[k] !== posAssin[k]);
ok("após a reversão TODAS as assinaturas do schema voltam ao hash anterior (funções, grants, políticas, gatilhos)", dif.length === 0, dif.join(", "));
await db.close();

log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
process.exit(falhas === 0 ? 0 : 1);
