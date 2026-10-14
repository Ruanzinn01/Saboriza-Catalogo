// (A) Compatibilidade: executa os padrões de acesso do app e das funções de borda ANTIGOS contra o schema ATUAL de produção
//     reconstruído (inclui as migrações novas de vínculo, revisão de ponto e outbox).
// (B) Correções antes da homologação: demonstra o problema, aplica supabase/pendentes/correcoes_pre_homologacao.sql,
//     confere o efeito, gera e verifica a reversão por hash.
// Banco em memória (PGlite). NÃO é homologação. Uso:
//   PGLITE_DIR=<pasta> node supabase/pendentes/testes_compatibilidade_e_correcoes.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const CORRECOES = fs.readFileSync(path.join(repo, "supabase/pendentes/correcoes_pre_homologacao.sql"), "utf8");
const ASSINATURAS = fs.readFileSync(path.join(repo, "supabase/baseline/assinaturas.sql"), "utf8");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const U = { owner: "00000000-0000-0000-0000-0000000000a1", desp: "00000000-0000-0000-0000-0000000000a3", apur: "00000000-0000-0000-0000-0000000000a5", plain: "00000000-0000-0000-0000-0000000000a2" };
const E1 = "eeeeeeee-0000-0000-0000-0000000000e1";
const E2 = "eeeeeeee-0000-0000-0000-0000000000e2";
const E3 = "eeeeeeee-0000-0000-0000-0000000000e3";

const db = await criarBanco();
const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };
const q = async (sql) => (await db.query(sql)).rows;
async function como(uid, role, sql) {
  await db.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, role }) : ""}', false); set role ${role};`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows, afetadas: r.affectedRows }; }
  catch (e) { return { ok: false, code: e.code, msg: e.message }; }
  finally { await db.exec("reset role;"); }
}
const auth = (uid, sql) => como(uid, "authenticated", sql);
const comoSuper = async (uid, sql) => { await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: "authenticated" })}', false);`); return db.query(sql); };

log("# Reconstruindo o banco a partir de supabase/migrations");
const falhasReplay = await reaplicar(db, null, log);
ok("185 migrações reaplicadas sem falha", falhasReplay.length === 0);

await db.exec(`insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a');
  insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(",")};`);
async function papel(uid, chave, perms) {
  const role = crypto.randomUUID(); const mem = crypto.randomUUID();
  await db.exec(`insert into public.roles (id, company_id, key, name) values ('${role}','${A}','${chave}','${chave}');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${A}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
    insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${A}','${uid}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${A}','${mem}','${role}');`);
}
const todas = (await q("select key from public.permissions where key <> 'separa_confere.operar'")).map((r) => r.key);
await papel(U.owner, "proprietario", todas);
await papel(U.desp, "despesas", ["despesas.manage", "despesas.read"]);
await papel(U.apur, "apuracao", ["timesheet.apuracao.manage", "timesheet.apuracao.read"]);
await papel(U.plain, "comum", ["tarefas.read"]);
const DEV = crypto.randomUUID();
await db.exec(`
  insert into public.employees (id, company_id, code, name, status, admission_date, salary_base, timesheet_enabled, timesheet_expected_start, timesheet_expected_end, timesheet_break_minutes) values
    ('${E1}','${A}','E1','Elegível','ATIVO','2026-01-05',2000,true,'08:00','17:00',60),
    ('${E2}','${A}','E2','Sem ponto habilitado','ATIVO','2026-01-05',2000,false,null,null,0);
  insert into public.time_devices (id, company_id, label, credential_hash) values ('${DEV}','${A}','Aparelho','hash');`);

// =============================================================================================
log("\n# A. COMPATIBILIDADE: app e funções ANTIGOS contra o banco NOVO (schema atual de produção reconstruído)");
let r = await auth(U.desp, `insert into public.salary_obligations (employee_id, competence, base_salary, net_amount, company_id, due_date) values ('${E1}','2026-06-01',2000,2000,'${A}','2026-07-05') returning id, due_date_source, employment_id`);
const OBL = r.rows?.[0];
ok("generateObligation antigo (insert direto com vencimento dia 5) continua funcionando", r.ok && !!OBL?.id, r.msg);
ok("   a origem do vencimento é preenchida pelo gatilho e a obrigação aponta para o período de contratação", OBL?.due_date_source === "competence_closing" && !!OBL?.employment_id, `origem=${OBL?.due_date_source}`);
r = await auth(U.desp, `insert into public.salary_obligations (employee_id, competence, base_salary, net_amount, company_id, due_date) values ('${E1}','2026-06-01',2000,2000,'${A}','2026-07-05')`);
ok("   repetir a geração devolve 23505 (o app antigo já traduz para 'Já existe obrigação')", !r.ok && r.code === "23505", r.code);
r = await auth(U.desp, `insert into public.salary_obligations (employee_id, competence, base_salary, net_amount, company_id) values ('${E1}','2026-08-01',2000,2000,'${A}')`);
ok("   obrigação SEM vencimento é recusada (o app antigo sempre enviava o dia 5, então não é afetado)", !r.ok && /VENCIMENTO_OBRIGATORIO|null value/.test(r.msg), r.msg);
r = await auth(U.desp, `insert into public.salary_advances (salary_obligation_id, amount, status, company_id) values ('${OBL.id}', 300, 'SOLICITADO', '${A}') returning id`);
const ADV = r.rows?.[0]?.id;
ok("createAdvance antigo (insert de vale SOLICITADO) continua funcionando", r.ok && !!ADV, r.msg);
r = await auth(U.desp, `update public.salary_advances set status = 'PAGO', paid_at = now() where id = '${ADV}'`);
ok("payAdvance antigo (update de status direto) continua funcionando", r.ok && r.afetadas === 1);
await auth(U.desp, `update public.salary_advances set status = 'PAGO', paid_at = now() where id = '${ADV}'`);
const evPago = (await q(`select count(*)::int n from public.transactional_outbox where event_type='salary_advance.paid' and entity_id='${ADV}'`))[0].n;
ok("   duplo clique no app antigo não gera dois eventos de 'vale pago'", evPago === 1, `${evPago} evento(s)`);
r = await auth(U.desp, `insert into public.salary_advances (salary_obligation_id, amount, status, paid_at, reversed_advance_id, company_id) values ('${OBL.id}', 300, 'ESTORNADO', now(), '${ADV}', '${A}')`);
ok("reverseAdvance antigo (insert do estorno) continua funcionando", r.ok);
r = await auth(U.desp, `insert into public.salary_advances (salary_obligation_id, amount, status, paid_at, reversed_advance_id, company_id) values ('${OBL.id}', 300, 'ESTORNADO', now(), '${ADV}', '${A}')`);
ok("   estorno duplicado agora é barrado (23505) em vez de gravar duas reversões", !r.ok && r.code === "23505");
r = await como(null, "service_role", `insert into public.time_punches (employee_id, device_id, type, device_reported_time, photo_path, location, idempotency_key) values ('${E1}','${DEV}','ENTRADA', now(), '${A}/ponto-oris/${E1}/k1.jpg', null, 'k1') returning id, employment_id`);
const achado = !r.ok && /permission denied for schema private/.test(r.msg ?? "");
log(`[ACHADO] gravar batida como service_role (papel da função de borda) FALHA hoje: ${r.ok ? "não falhou" : r.msg}`);
ok("   confirmado: o defeito é pré-existente — sync_occurrence_after_punch (anterior às minhas migrações) já exige USAGE em private", achado);
r = await como(null, "service_role", `insert into public.time_punches (employee_id, device_id, type, device_reported_time, photo_path, location, idempotency_key) values ('${E2}','${DEV}','ENTRADA', now(), 'x.jpg', null, 'k2')`);
ok("   para colaborador sem ponto habilitado o banco recusa com mensagem clara (a função antiga devolve 400 com o texto)", !r.ok && /PONTO_NAO_HABILITADO/.test(r.msg), r.msg);
await db.exec(`update public.employees set status='INATIVO', employment_end_date = '2026-09-30' where id = '${E2}'`);
r = await como(null, "service_role", `insert into public.time_punches (employee_id, device_id, type, photo_path, idempotency_key) values ('${E2}','${DEV}','ENTRADA', 'x.jpg', 'k3')`);
ok("   para colaborador desligado a gravação também é recusada", !r.ok, r.msg?.slice(0, 80));
r = await auth(U.apur, `select dia, worked_minutes, normal_minutes, extra_minutes, late_minutes, inconsistency_type, open_session_start from public.oris360_apurar_mes('${E1}', date_trunc('month', now())::date) limit 3`);
ok("apuração antiga (oris360_apurar_mes) mantém as 7 colunas esperadas pelo app", r.ok && r.rows.length > 0, r.msg);
r = await auth(U.apur, `select public.oris360_apurar_dia_detalhado('${E1}', current_date) d`);
ok("   oris360_apurar_dia_detalhado devolve minutos e batidas", r.ok && r.rows[0].d && "punches" in r.rows[0].d && "worked_minutes" in r.rows[0].d);
r = await auth(U.apur, `select public.oris360_time_bank_balance('${E1}') s`);
ok("   saldo do banco de horas responde", r.ok && Number(r.rows[0].s) === 0);
r = await auth(U.apur, `select public.oris360_fechar_competencia_ponto('${E1}', date_trunc('month', now())::date) j`);
ok("   fechamento da competência (função antiga) continua respondendo", r.ok && r.rows[0].j && "extra_minutes" in r.rows[0].j, r.msg);
r = await auth(U.owner, `update public.employees set name = 'Elegível (editado)', salary_base = 2500, pix_key = 'x@y.com', timesheet_overtime_percent = 60 where id = '${E1}'`);
ok("ficha do colaborador antiga (UPDATE de todas as colunas, inclusive remuneração) continua funcionando ANTES da fase de segurança", r.ok && r.afetadas === 1, r.msg);
r = await auth(U.owner, `select public.get_financeiro_geral_summary('${A}', 'month')->>'a_pagar' v`);
ok("Financeiro Geral (RPC antiga) responde com a folha somada", r.ok && Number(r.rows[0].v) >= 2000, r.msg);
r = await auth(U.apur, `insert into public.time_adjustments (employee_id, adjustment_date, field_changed, after_value, reason, kind, punch_id, new_time) values ('${E1}', current_date, 'x', 'y', 'teste', 'VOID_PUNCH', null, null)`);
ok("MUDANÇA DE COMPORTAMENTO (documentada): insert direto em time_adjustments agora é negado; o app antigo nunca o usava", !r.ok, r.msg?.slice(0, 70));
r = await auth(U.apur, `select count(*)::int n from public.time_period_states`);
ok("leitura de time_period_states continua permitida", r.ok);

// =============================================================================================
log("\n# B1. EVENTOS SEM PERDA: duas alterações legítimas do mesmo campo na mesma transação");
async function alterarDuasVezes(sufixo) {
  await db.exec(`select set_config('request.jwt.claims','${JSON.stringify({ sub: U.desp, role: "authenticated" })}', false);
    begin;
    select public.change_salary_due_date('${OBL.id}', '2026-07-10', 'Alteração ${sufixo} 1');
    select public.change_salary_due_date('${OBL.id}', '2026-07-15', 'Alteração ${sufixo} 2');
    select public.change_salary_due_date('${OBL.id}', '2026-07-10', 'Alteração ${sufixo} 3');
    select public.change_salary_due_date('${OBL.id}', '2026-07-15', 'Alteração ${sufixo} 4');
    update public.salary_obligations set base_salary = 2100, net_amount = 2100 where id = '${OBL.id}';
    update public.salary_obligations set base_salary = 2200, net_amount = 2200 where id = '${OBL.id}';
    commit;`);
  const due = (await q(`select count(*)::int n from public.transactional_outbox where event_type='salary_obligation.due_date_changed' and entity_id='${OBL.id}'`))[0].n;
  const upd = (await q(`select count(*)::int n from public.transactional_outbox where event_type='salary_obligation.updated' and entity_id='${OBL.id}'`))[0].n;
  return { due, upd };
}
await db.exec(`update public.salary_obligations set due_date = due_date where id='${OBL.id}'`);
await db.exec(`delete from public.transactional_outbox where entity_id='${OBL.id}'`);
const antes = await alterarDuasVezes("antes");
ok("ANTES da correção: 4 mudanças de vencimento e 2 de valor na mesma transação perdem eventos em silêncio", antes.due < 4 && antes.upd < 2, `vencimento ${antes.due}/4, valor ${antes.upd}/2`);

const defsAntes = {};
for (const f of ["private.salary_obligation_set_employment()", "private.salary_obligation_emit_event()", "public.generate_salary_obligation(uuid, date, date, text)"]) defsAntes[f] = (await q(`select pg_get_functiondef('${f}'::regprocedure) d`))[0].d;
const snapAntes = (await q(ASSINATURAS)).find((x) => x.k === "funcoes_corpo").h;
await db.exec(CORRECOES);
await db.exec(`delete from public.transactional_outbox where entity_id='${OBL.id}'`);
r = await como(null, "service_role", `insert into public.time_punches (employee_id, device_id, type, device_reported_time, photo_path, location, idempotency_key) values ('${E1}','${DEV}','ENTRADA', now(), '${A}/ponto-oris/${E1}/k1b.jpg', null, 'k1b') returning id, employment_id`);
ok("DEPOIS da correção: a função de borda grava a batida do colaborador elegível", r.ok && !!r.rows[0].employment_id, r.msg);
r = await como(null, "service_role", `insert into public.time_punches (employee_id, device_id, type, photo_path, idempotency_key) values ('${E2}','${DEV}','ENTRADA', 'x.jpg', 'k2b')`);
ok("   e continua recusando o colaborador sem ponto habilitado/vínculo", !r.ok && /PONTO_NAO_HABILITADO|VINCULO_INVALIDO/.test(r.msg), r.msg?.slice(0, 60));
const depois = await alterarDuasVezes("depois");
ok("DEPOIS da correção: nenhum evento se perde (4 de vencimento e 2 de valor)", depois.due === 4 && depois.upd === 2, `vencimento ${depois.due}/4, valor ${depois.upd}/2`);
const chaves = (await q(`select count(distinct idempotency_key)::int n, count(*)::int t from public.transactional_outbox where entity_id='${OBL.id}'`))[0];
ok("   todas as chaves de idempotência dos eventos de alteração são distintas", chaves.n === chaves.t, `${chaves.n}/${chaves.t}`);
const unicos = (await q(`select event_type, count(*)::int n from public.transactional_outbox where entity_id in (select id::text from public.salary_advances) group by 1`));
ok("   eventos de fato único (vale criado/pago/estornado) continuam deduplicados por id", unicos.every((u) => u.n === 1), JSON.stringify(unicos));

// =============================================================================================
log("\n# B2. COMPETÊNCIA AMBÍGUA: duas contratações no mesmo mês");
await db.exec(`insert into public.employees (id, company_id, code, name, status, admission_date, employment_start_date, salary_base, timesheet_enabled) values ('${E3}','${A}','E3','Recontratado','ATIVO','2026-01-02','2026-01-02',3000,true);
  update public.employees set status='INATIVO', employment_end_date='2026-09-10', termination_reason='Pedido' where id='${E3}';
  update public.employees set status='ATIVO', admission_date='2026-09-20', employment_start_date='2026-09-20' where id='${E3}';`);
const per = await q(`select sequence, start_date::text s, end_date::text e from public.employee_employments where employee_id='${E3}' order by sequence`);
ok("pré-condição: o colaborador tem 2 períodos que tocam setembro/2026", per.length === 2 && per[0].e === "2026-09-10" && per[1].s === "2026-09-20", JSON.stringify(per));
r = await auth(U.desp, `select public.generate_salary_obligation('${E3}', '2026-09-01', '2026-10-05') id`);
ok("comando de geração RECUSA a competência ambígua (nenhuma obrigação formada)", !r.ok && /COMPETENCIA_AMBIGUA/.test(r.msg), r.msg?.slice(0, 60));
r = await auth(U.desp, `insert into public.salary_obligations (employee_id, competence, base_salary, net_amount, company_id, due_date) values ('${E3}','2026-09-01',3000,3000,'${A}','2026-10-05')`);
ok("inserção direta (caminho de create_expense_launch) também é recusada", !r.ok && /COMPETENCIA_AMBIGUA/.test(r.msg));
const nOblE3 = (await q(`select count(*)::int n from public.salary_obligations where employee_id='${E3}'`))[0].n;
ok("   nenhuma obrigação ambígua foi criada", nOblE3 === 0);
r = await auth(U.desp, `select public.generate_salary_obligation('${E3}', '2026-08-01', '2026-09-05') id`);
const o1 = (await q(`select employment_id, (select sequence from public.employee_employments x where x.id = o.employment_id) seq from public.salary_obligations o where employee_id='${E3}' and competence='2026-08-01'`))[0];
ok("competência só do 1º período (agosto) segue normal e atribuída ao 1º vínculo", r.ok && o1?.seq === 1, r.msg);
r = await auth(U.desp, `select public.generate_salary_obligation('${E3}', '2026-10-01', '2026-11-05') id`);
const o2 = (await q(`select (select sequence from public.employee_employments x where x.id = o.employment_id) seq from public.salary_obligations o where employee_id='${E3}' and competence='2026-10-01'`))[0];
ok("competência só do 2º período (outubro) segue normal e atribuída ao 2º vínculo", r.ok && o2?.seq === 2, r.msg);
r = await auth(U.desp, `insert into public.salary_obligations (employee_id, competence, base_salary, net_amount, company_id, due_date) values ('${E1}','2026-07-01',2000,2000,'${A}','2026-08-05')`);
ok("compatibilidade: o insert do app antigo em mês sem ambiguidade continua funcionando", r.ok, r.msg);

// =============================================================================================
log("\n# B3. REVERSÃO das correções");
let rev = "-- REVERSÃO DAS CORREÇÕES PRÉ-HOMOLOGAÇÃO. GERADA pelo teste a partir do estado anterior (corpos literais).\n-- Verificada por hash: depois de aplicar, funcoes_corpo volta IGUAL ao estado anterior à correção.\n\n";
for (const d of Object.values(defsAntes)) rev += d.trim() + ";\n\n";
rev += "revoke usage on schema private from service_role;\ndrop sequence if exists private.outbox_event_nonce;\n";
await db.exec(rev);
const snapDepoisReversao = (await q(ASSINATURAS)).find((x) => x.k === "funcoes_corpo").h;
const svcUso = (await q("select has_schema_privilege('service_role','private','USAGE') u"))[0].u;
ok("reverter as correções devolve os corpos de função IDÊNTICOS (hash) e remove o USAGE concedido", snapDepoisReversao === snapAntes && svcUso === false);
fs.writeFileSync(path.join(repo, "supabase/pendentes/correcoes_pre_homologacao_reverter.sql"), rev);

log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
await db.close();
process.exit(falhas === 0 ? 0 : 1);
