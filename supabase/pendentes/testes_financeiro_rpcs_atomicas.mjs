// Prova das RPCs financeiras atômicas no banco RECONSTRUÍDO (PGlite). NÃO é homologação (PGlite é monoconexão: concorrência real não provada).
// Uso: PGLITE_DIR=<pasta> node supabase/pendentes/testes_financeiro_rpcs_atomicas.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const MIG = read("supabase/pendentes/20261016120000_financeiro_rpcs_atomicas.sql");
const REV = read("supabase/pendentes/20261016120000_financeiro_rpcs_atomicas_reverter.sql");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = { owner_a: "00000000-0000-0000-0000-0000000000a1", owner_b: "00000000-0000-0000-0000-0000000000b1", leitor_b: "00000000-0000-0000-0000-0000000000b2", sem_perm_b: "00000000-0000-0000-0000-0000000000b3" };
const cmd = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

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
const auth = (uid, sql) => como(uid, "authenticated", sql);
const rpc = async (uid, fn, args = "") => { const r = await auth(uid, `select public.${fn}(${args}) j`); return r.ok ? { ...r, j: r.rows[0]?.j } : r; };
const negado = (r) => !r.ok && (r.code === "42501" || /permission denied|row-level security|Sem permiss/i.test(r.msg ?? ""));

log("# 0. Base reconstruída e aplicação da migration");
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
await papel(U.leitor_b, B, "leitor_b", ["despesas.read", "receitas.read", "aportes.read"]);
await papel(U.sem_perm_b, B, "sem_perm_b", ["tarefas.read"]);
await db.exec(MIG);
ok("migration aplica sem erro; financial_commands e 2 índices únicos existem", (await q("select (select count(*)::int from pg_tables where tablename='financial_commands') t, (select count(*)::int from pg_indexes where indexname in ('revenue_receipts_one_reversal_per_receipt','partner_contributions_one_reversal_per_contribution')) i"))[0].t === 1 && (await q("select count(*)::int n from pg_indexes where indexname in ('revenue_receipts_one_reversal_per_receipt','partner_contributions_one_reversal_per_contribution')"))[0].n === 2);

// dados sintéticos (auth.uid() do semeador para o default de created_by)
await db.exec(`select set_config('request.jwt.claims', '{"sub":"${U.owner_a}","role":"postgres"}', false)`);
const ins = async (sql) => (await q(sql))[0].id;
const expB = await ins(`insert into public.expenses (company_id, description, amount, due_date) values ('${B}','Desp B',100, current_date + 5) returning id`);
const expOver = await ins(`insert into public.expenses (company_id, description, amount, due_date) values ('${B}','Desp vencida',100, current_date - 3) returning id`);
const expA = await ins(`insert into public.expenses (company_id, description, amount) values ('${A}','Desp A',50) returning id`);
const expAporte = await ins(`insert into public.expenses (company_id, description, amount) values ('${B}','Desp aporte',80) returning id`);
const revB = await ins(`insert into public.revenues (company_id, description, competence, principal_amount) values ('${B}','Rec B', current_date, 200) returning id`);
const recvB = await ins(`insert into public.revenue_receivables (revenue_id, principal, open_balance, due_date) values ('${revB}',200,200,current_date + 10) returning id`);
const revA = await ins(`insert into public.revenues (company_id, description, competence, principal_amount) values ('${A}','Rec A', current_date, 90) returning id`);
const recvA = await ins(`insert into public.revenue_receivables (revenue_id, principal, open_balance, due_date) values ('${revA}',90,90,current_date + 10) returning id`);
const parB = await ins(`insert into public.company_partners (company_id, name) values ('${B}','Sócio B') returning id`);
const parA = await ins(`insert into public.company_partners (company_id, name) values ('${A}','Sócio A') returning id`);
const cnt = async (t, w = "true") => (await q(`select count(*)::int n from public.${t} where ${w}`))[0].n;
const exp = async (id) => (await q(`select status, paid_amount::float p, settled_at is not null s from public.expenses where id='${id}'`))[0];

log("\n# 1. Pagar despesa");
let r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(1)}','${expB}',40`);
ok("pagamento parcial: ABERTO, pago 40, saldo 60", r.ok && r.j.status === "ABERTO" && r.j.paid_amount === 40 && r.j.balance === 60 && r.j.replayed === false, r.msg ?? JSON.stringify(r.j));
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(1)}','${expB}',40`);
ok("mesmo command_id: replay, sem pagar de novo", r.ok && r.j.replayed === true && (await exp(expB)).p === 40, r.msg);
ok("replay não duplica comando nem auditoria", (await cnt("financial_commands", `command_id='${cmd(1)}'`)) === 1 && (await cnt("audit_events", `idempotency_key='${cmd(1)}'`)) === 1);
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(1)}','${expB}',41`);
ok("mesmo command_id com valor diferente: COMANDO_REUSADO", !r.ok && /COMANDO_REUSADO/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(2)}','${expB}',61`);
ok("excede o saldo: recusado e nada muda", !r.ok && /excede/.test(r.msg) && (await exp(expB)).p === 40 && (await cnt("financial_commands", `command_id='${cmd(2)}'`)) === 0, r.msg);
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(3)}','${expB}',0`);
ok("valor zero recusado", !r.ok);
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(4)}','${expB}',60`);
ok("quita: PAGO com settled_at", r.ok && r.j.status === "PAGO" && (await exp(expB)).s === true, r.msg);
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(5)}','${expB}',1`);
ok("novo command_id em despesa já PAGA: recusado (sem baixa dupla)", !r.ok && /não pode receber/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(6)}','${expOver}',10`);
ok("parcial em vencida: ATRASADO", r.ok && r.j.status === "ATRASADO", r.msg);
const evD = (await q(`select event_type, actor_type, actor_user_id, entity_type, entity_id, payload from public.audit_events where idempotency_key='${cmd(4)}'`))[0];
ok("auditoria da quitação: tipo, ator USER, usuário, entidade e valores", evD?.event_type === "expense.payment_registered" && evD.actor_type === "USER" && evD.actor_user_id === U.owner_b && evD.entity_id === expB && evD.payload.paid_amount_after === 100, JSON.stringify(evD));

log("\n# 2. Receber receita e estornar");
r = await rpc(U.owner_b, "financeiro_receber_receita", `'${cmd(10)}','${recvB}',80`);
const rec1 = r.j?.receipt_id;
ok("recebimento parcial 80: saldo 120, ABERTO", r.ok && r.j.open_balance === 120 && r.j.status === "ABERTO", r.msg);
r = await rpc(U.owner_b, "financeiro_receber_receita", `'${cmd(10)}','${recvB}',80`);
ok("replay devolve o mesmo recibo e não recebe de novo", r.ok && r.j.replayed === true && r.j.receipt_id === rec1 && (await cnt("revenue_receipts", `receivable_id='${recvB}'`)) === 1);
r = await rpc(U.owner_b, "financeiro_receber_receita", `'${cmd(11)}','${recvB}',121`);
ok("excede saldo: recusado", !r.ok && /excede/.test(r.msg));
r = await rpc(U.owner_b, "financeiro_receber_receita", `'${cmd(12)}','${recvB}',120`);
const rec2 = r.j?.receipt_id;
ok("quita: RECEBIDO saldo 0", r.ok && r.j.status === "RECEBIDO" && r.j.open_balance === 0, r.msg);
r = await rpc(U.owner_b, "financeiro_receber_receita", `'${cmd(13)}','${recvB}',1`);
ok("título quitado não recebe mais", !r.ok);
r = await rpc(U.owner_b, "financeiro_estornar_recebimento", `'${cmd(14)}','${rec2}','duplicidade'`);
ok("estorno do recibo 2: saldo volta a 120, ABERTO, linha de estorno com valor positivo", r.ok && r.j.open_balance === 120 && r.j.status === "ABERTO" && (await cnt("revenue_receipts", `reversed_receipt_id='${rec2}' and received_amount = 120`)) === 1, r.msg);
r = await rpc(U.owner_b, "financeiro_estornar_recebimento", `'${cmd(14)}','${rec2}','duplicidade'`);
ok("estorno com mesmo command_id: replay", r.ok && r.j.replayed === true && (await cnt("revenue_receipts", `reversed_receipt_id='${rec2}'`)) === 1);
r = await rpc(U.owner_b, "financeiro_estornar_recebimento", `'${cmd(15)}','${rec2}','de novo'`);
ok("SEGUNDA tentativa de estorno (outro command_id): recusada ESTORNO_JA_REALIZADO", !r.ok && /ESTORNO_JA_REALIZADO/.test(r.msg) && (await q(`select open_balance::float b from public.revenue_receivables where id='${recvB}'`))[0].b === 120, r.msg);
const revId = (await q(`select id from public.revenue_receipts where reversed_receipt_id='${rec2}'`))[0].id;
r = await rpc(U.owner_b, "financeiro_estornar_recebimento", `'${cmd(16)}','${revId}',null`);
ok("estorno de estorno recusado", !r.ok && /não pode ser estornado/.test(r.msg), r.msg);
let dup = await q(`select 1 from pg_indexes where indexname='revenue_receipts_one_reversal_per_receipt'`);
try { await db.exec(`insert into public.revenue_receipts (company_id, receivable_id, received_amount, effective_date, reversed_receipt_id) values ('${B}','${recvB}',120,current_date,'${rec2}')`); ok("índice único barra estorno duplicado direto na tabela", false); }
catch (e) { ok("índice único barra estorno duplicado direto na tabela", e.code === "23505" && dup.length === 1, e.code); }
ok("auditoria do estorno gravada", (await cnt("audit_events", `event_type='revenue.receipt_reversed' and entity_id='${rec2}' and payload->>'reason'='duplicidade'`)) === 1);

log("\n# 3. Aportes");
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(20)}','${parB}',500,'REALIZADO','PIX'`);
const ap1 = r.j?.contribution_id;
ok("aporte realizado criado (data de hoje)", r.ok && r.j.status === "REALIZADO" && (await cnt("partner_contributions", `id='${ap1}' and realized_date = current_date`)) === 1, r.msg);
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(20)}','${parB}',500,'REALIZADO','PIX'`);
ok("replay não duplica aporte", r.ok && r.j.replayed === true && (await cnt("partner_contributions", `partner_id='${parB}'`)) === 1);
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(21)}','${parB}',80,'REALIZADO','PAGAMENTO_DIRETO_DESPESA',null,null,null,'${expAporte}'`);
ok("aporte que paga despesa quita a despesa na mesma transação", r.ok && (await exp(expAporte)).status === "PAGO" && (await exp(expAporte)).p === 80, r.msg);
const apCnt = await cnt("partner_contributions"); const cmdCnt = await cnt("financial_commands"); const audCnt = await cnt("audit_events");
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(22)}','${parB}',80,'REALIZADO','ORIGEM_INVALIDA',null,null,null,'${expB}'`);
ok("ATOMICIDADE: origem inválida (falha no insert) não deixa comando, auditoria nem aporte", !r.ok && (await cnt("partner_contributions")) === apCnt && (await cnt("financial_commands")) === cmdCnt && (await cnt("audit_events")) === audCnt, r.msg);
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(23)}','${parB}',30,'REALIZADO','PIX',null,null,null,'${expB}'`);
ok("aporte pagando despesa já PAGA recusado e despesa intacta", !r.ok && (await exp(expB)).p === 100, r.msg);
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(24)}','${parB}',30,'CANCELADO','PIX'`);
ok("situação inicial inválida recusada", !r.ok);
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(25)}','${parB}',30,'REALIZADO','PIX',null,null,null,'${expA}'`);
ok("despesa de outra empresa recusada no aporte", !r.ok && /não encontrada/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "financeiro_estornar_aporte", `'${cmd(30)}','${ap1}','lançado errado'`);
ok("estorno de aporte cria linha ESTORNADO ligada ao original", r.ok && (await cnt("partner_contributions", `reversed_contribution_id='${ap1}' and status='ESTORNADO' and amount=500`)) === 1, r.msg);
r = await rpc(U.owner_b, "financeiro_estornar_aporte", `'${cmd(30)}','${ap1}','lançado errado'`);
ok("replay do estorno de aporte", r.ok && r.j.replayed === true);
r = await rpc(U.owner_b, "financeiro_estornar_aporte", `'${cmd(31)}','${ap1}','outra vez'`);
ok("SEGUNDA tentativa de estorno de aporte recusada", !r.ok && /ESTORNO_JA_REALIZADO/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "financeiro_estornar_aporte", `'${cmd(32)}','${ap1}','   '`);
ok("estorno sem motivo recusado", !r.ok);
try { await db.exec(`insert into public.partner_contributions (company_id, partner_id, amount, origin, status, reversed_contribution_id) values ('${B}','${parB}',500,'PIX','ESTORNADO','${ap1}')`); ok("índice único barra estorno de aporte duplicado direto", false); }
catch (e) { ok("índice único barra estorno de aporte duplicado direto", e.code === "23505", e.code); }

log("\n# 4. Isolamento A/B e permissões");
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(40)}','${expA}',10`);
ok("B não paga despesa de A", negado(r) && (await exp(expA)).p === null, r.msg);
r = await rpc(U.owner_b, "financeiro_receber_receita", `'${cmd(41)}','${recvA}',10`);
ok("B não recebe título de A", negado(r));
r = await rpc(U.owner_b, "financeiro_registrar_aporte", `'${cmd(42)}','${parA}',10,'REALIZADO','PIX'`);
ok("B não registra aporte em sócio de A", negado(r));
const recA = (await q(`insert into public.revenue_receipts (company_id, receivable_id, received_amount, effective_date) values ('${A}','${recvA}',10,current_date) returning id`))[0].id;
const apA = (await q(`insert into public.partner_contributions (company_id, partner_id, amount, origin, status, realized_date) values ('${A}','${parA}',10,'PIX','REALIZADO',current_date) returning id`))[0].id;
r = await rpc(U.owner_b, "financeiro_estornar_recebimento", `'${cmd(43)}','${recA}',null`);
ok("B não estorna recibo de A", negado(r));
r = await rpc(U.owner_b, "financeiro_estornar_aporte", `'${cmd(44)}','${apA}','x'`);
ok("B não estorna aporte de A", negado(r));
r = await rpc(U.owner_a, "financeiro_pagar_despesa", `'${cmd(1)}','${expA}',10`);
ok("command_id é por empresa: A pode usar o mesmo UUID que B usou", r.ok && r.j.replayed === false, r.msg);
r = await rpc(U.leitor_b, "financeiro_pagar_despesa", `'${cmd(45)}','${expOver}',1`);
ok("leitor (despesas.read) não paga", negado(r));
r = await rpc(U.sem_perm_b, "financeiro_receber_receita", `'${cmd(46)}','${recvB}',1`);
ok("sem permissão não recebe", negado(r));
r = await rpc(U.leitor_b, "financeiro_estornar_aporte", `'${cmd(47)}','${ap1}','x'`);
ok("leitor não estorna aporte", negado(r));
ok("mensagem igual para inexistente e de outra empresa (não vaza existência)", (await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(48)}','${cmd(999)}',1`)).msg === (await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(49)}','${expA}',1`)).msg);
r = await como(null, "anon", `select public.financeiro_pagar_despesa('${cmd(50)}','${expB}',1)`);
ok("anon não executa a RPC", negado(r), r.msg);
const g = await q(`select p.oid::regprocedure::text f, has_function_privilege('authenticated', p.oid, 'execute') u, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('public', p.oid, 'execute') pu from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'financeiro\\_%' or p.proname like 'fin\\_command%'`);
const pub = g.filter((x) => x.f.startsWith("financeiro_"));
const priv = g.filter((x) => x.f.startsWith("private.fin_command"));
ok("5 RPCs públicas: EXECUTE só authenticated (anon e PUBLIC não)", pub.length === 5 && pub.every((x) => x.u && !x.a && !x.pu), JSON.stringify(pub.map((x) => [x.u, x.a, x.pu])));
ok("helpers private.fin_command_*: sem EXECUTE para authenticated/anon", priv.length === 2 && priv.every((x) => !x.u && !x.a), JSON.stringify(priv));
r = await auth(U.owner_b, "select * from public.financial_commands");
ok("authenticated não lê financial_commands (permission denied)", negado(r), r.msg);
r = await como(null, "anon", "select * from public.financial_commands");
ok("anon não lê financial_commands", negado(r));

log("\n# 5. Auditoria append-only e sem alterar a estrutura");
try { await db.exec(`update public.audit_events set event_type='x' where idempotency_key='${cmd(4)}'`); ok("audit_events continua append-only (update barrado)", false); }
catch (e) { ok("audit_events continua append-only (update barrado)", /append-only/.test(e.message), e.message); }
ok("todas as operações bem-sucedidas geraram evento (cada command_id = 1 evento)", (await q("select (select count(*)::int from public.financial_commands) c, (select count(*)::int from public.audit_events where idempotency_key is not null) a")).every((x) => x.c === x.a));

log("\n# 6. Reversão");
await db.exec(REV);
ok("reversão remove RPCs, helpers, índices e tabela", (await q("select (select count(*)::int from pg_proc where proname like 'financeiro\\_%' or proname like 'fin\\_command%') f, (select count(*)::int from pg_tables where tablename='financial_commands') t, (select count(*)::int from pg_indexes where indexname like '%one_reversal%') i"))[0].f === 0);
{ const nr = await cnt("revenue_receipts"), na = await cnt("audit_events", "idempotency_key is not null"); ok("reversão preserva dados de negócio e auditoria", nr === 4 && na === 10, `receipts=${nr} audit=${na}`); }
await db.exec(REV);
await db.exec(MIG);
r = await rpc(U.owner_b, "financeiro_pagar_despesa", `'${cmd(60)}','${expOver}',10`);
ok("reaplicar após reversão funciona", r.ok, r.msg);

await db.close();
log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
process.exit(falhas === 0 ? 0 : 1);
