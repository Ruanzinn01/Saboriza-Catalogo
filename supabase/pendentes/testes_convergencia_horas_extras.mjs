// Prova ANTES/DEPOIS da convergência das horas extras pagas na obrigação salarial, no banco RECONSTRUÍDO (PGlite).
// Duas empresas com dados idênticos: A roda o cenário com o código atual (despesa em expenses), a migração é aplicada,
// B roda o mesmo cenário com o código novo. Compara os KPIs reais do banco (get_financeiro_geral_summary, get_dre_monthly).
// NÃO é homologação. Uso: PGLITE_DIR=<pasta> node supabase/pendentes/testes_convergencia_horas_extras.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const MIG = read("supabase/pendentes/20261015130000_convergencia_horas_extras_obrigacao.sql");
const REV = read("supabase/pendentes/20261015130000_convergencia_horas_extras_obrigacao_reverter.sql");
const SAL1 = read("supabase/pendentes/seguranca_salario_pix_1_aditiva.sql");
const SAL2 = read("supabase/pendentes/seguranca_salario_pix_2_restritiva.sql");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = { owner_a: "00000000-0000-0000-0000-0000000000a1", owner_b: "00000000-0000-0000-0000-0000000000b1", plain_b: "00000000-0000-0000-0000-0000000000b2", apur_b: "00000000-0000-0000-0000-0000000000b3" };
const EA = "eeeeeeee-0000-0000-0000-0000000000a1";
const EB = "eeeeeeee-0000-0000-0000-0000000000b1";
const EB2 = "eeeeeeee-0000-0000-0000-0000000000b2";
const EB3 = "eeeeeeee-0000-0000-0000-0000000000b3";

const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };
const num = (x) => Number(x ?? 0);

async function montar() {
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
  await papel(U.plain_b, B, "membro_comum_b", ["despesas.read", "tarefas.read"]);
  await papel(U.apur_b, B, "apuracao_sem_despesas", ["timesheet.apuracao.manage", "timesheet.apuracao.read", "despesas.read"]);
  // hora normal = 4400 / 220 = R$ 20,00; adicional de 50%
  await db.exec(`
    insert into public.employees (id, company_id, code, name, status, admission_date, salary_base, monthly_divisor, timesheet_overtime_percent, timesheet_enabled) values
     ('${EA}','${A}','A1','Colaborador A1','ATIVO','2026-01-05',4400,220,50,true),
     ('${EB}','${B}','B1','Colaborador B1','ATIVO','2026-01-05',4400,220,50,true),
     ('${EB2}','${B}','B2','Colaborador B2','ATIVO','2026-01-05',4400,220,50,true),
     ('${EB3}','${B}','B3','Colaborador B3','ATIVO','2026-01-05',4400,220,50,true);`);
  const credito = (emp, comp, min, uid) => db.exec(`insert into public.time_bank_entries (employee_id, competencia, type, minutes, created_by) values ('${emp}','${comp}','CREDITO_EXTRA',${min},'${uid}')`);
  const obrigacao = async (uid, emp, comp) => (await auth(uid, `select public.generate_salary_obligation('${emp}', '${comp}', '2026-10-05') id`));
  return { db, q, como, auth, credito, obrigacao, falhasReplay };
}

async function kpis(auth, uid, empresa) {
  const s = (await auth(uid, `select public.get_financeiro_geral_summary('${empresa}', 'month') j`)).rows[0].j;
  const dre = (await auth(uid, `select to_char(month,'YYYY-MM') m, operating_expenses::text e from public.get_dre_monthly('${empresa}') order by 1 nulls first`)).rows;
  return { a_pagar: num(s.a_pagar), saidas_total: num(s.saidas_mes.total), saidas_operacionais: num(s.saidas_mes.operacionais), dre: Object.fromEntries(dre.map((d) => [d.m ?? "sem_mes", num(d.e)])) };
}
const tot = (dre) => Object.values(dre).reduce((a, b) => a + b, 0);

// =============================================================================================
const { db, q, auth, credito, obrigacao, falhasReplay } = await montar();
log("# Reconstruindo o banco a partir de supabase/migrations");
ok("trilha reaplicada sem falha", falhasReplay.length === 0);
const negado = (r) => !r.ok && (r.code === "42501" || /permission denied|row-level security/i.test(r.msg ?? ""));

await credito(EA, "2026-09-01", 150, U.owner_a);
await credito(EB, "2026-09-01", 150, U.owner_b);
await obrigacao(U.owner_a, EA, "2026-09-01");
await obrigacao(U.owner_b, EB, "2026-09-01");

log("\n# 1. ANTES (código atual): A paga 150 min (2h30 x R$ 20,00 x 1,5 = R$ 75,00)");
let r = await auth(U.owner_a, `select public.oris360_resolver_banco_horas('${EA}', 150, 'PAGO') id`);
ok("pagamento cria a saída PAGO no banco de horas", r.ok, r.msg);
const despesasA = await q(`select id, amount::text a, status, competence::text c, due_date::text d from public.expenses where employee_id='${EA}'`);
ok("e cria UMA linha em expenses (natureza SALARIO, ABERTO) de R$ 75,00 no mês corrente", despesasA.length === 1 && num(despesasA[0].a) === 75 && despesasA[0].status === "ABERTO", JSON.stringify(despesasA[0]));
const antesA1 = await kpis(auth, U.owner_a, A);
log(`KPIs de A com a despesa ABERTA: ${JSON.stringify(antesA1)}`);
ok("a pagar de A = 4.400 (folha) + 75 (despesa)", antesA1.a_pagar === 4475, `${antesA1.a_pagar}`);

// pagamento em dinheiro: folha base por vale pago; horas extras marcando a despesa como paga
await db.exec(`insert into public.salary_advances (salary_obligation_id, amount, status, paid_at, created_by) select id, 4400, 'PAGO', now(), '${U.owner_a}' from public.salary_obligations where employee_id='${EA}'`);
await db.exec(`update public.expenses set status='PAGO', paid_amount=amount, paid_at=now(), due_date=date '2026-10-05' where employee_id='${EA}'`);
const antesA2 = await kpis(auth, U.owner_a, A);
log(`KPIs de A depois de pagar tudo: ${JSON.stringify(antesA2)}`);

log("\n# 2. APLICA A MIGRAÇÃO e confere que nada de A mudou");
await db.exec(MIG);
const posMigA = await kpis(auth, U.owner_a, A);
ok("sem itens, os KPIs de A (já com a despesa antiga) são IDÊNTICOS após a migração", JSON.stringify(posMigA) === JSON.stringify(antesA2), JSON.stringify(posMigA));
ok("linha antiga de expenses continua intacta (não há reescrita de histórico)", (await q(`select count(*)::int n from public.expenses where employee_id='${EA}'`))[0].n === 1);

log("\n# 3. DEPOIS (código novo): B, mesmo cenário");
r = await auth(U.owner_b, `select public.oris360_resolver_banco_horas('${EB}', 150, 'PAGO') id`);
ok("pagamento cria a saída PAGO no banco de horas", r.ok, r.msg);
const entryB = r.rows?.[0]?.id;
ok("NÃO cria linha em expenses", (await q(`select count(*)::int n from public.expenses where employee_id='${EB}'`))[0].n === 0);
const itens = await q(`select kind, competence::text c, minutes, amount::text a, status from public.salary_obligation_items where employee_id='${EB}'`);
ok("cria 1 item HORA_EXTRA_PAGA de R$ 75,00 na competência de origem (2026-09), ligado à saída PAGO", itens.length === 1 && itens[0].kind === "HORA_EXTRA_PAGA" && num(itens[0].a) === 75 && itens[0].c === "2026-09-01", JSON.stringify(itens[0]));
const ob = (await q(`select base_salary::text b, additions::text ad, net_amount::text n from public.salary_obligations where employee_id='${EB}'`))[0];
ok("a obrigação mostra adicionais 75 e líquido 4.475 (base 4.400 preservada)", num(ob.b) === 4400 && num(ob.ad) === 75 && num(ob.n) === 4475, JSON.stringify(ob));
const depoisB1 = await kpis(auth, U.owner_b, B);
log(`KPIs de B com o item aberto: ${JSON.stringify(depoisB1)}`);
ok("a pagar de B = 4.475, igual ao de A no mesmo estágio", depoisB1.a_pagar === antesA1.a_pagar, `${depoisB1.a_pagar} vs ${antesA1.a_pagar}`);
await db.exec(`insert into public.salary_advances (salary_obligation_id, amount, status, paid_at, created_by) select id, 4475, 'PAGO', now(), '${U.owner_b}' from public.salary_obligations where employee_id='${EB}'`);
const depoisB2 = await kpis(auth, U.owner_b, B);
log(`KPIs de B depois de pagar tudo: ${JSON.stringify(depoisB2)}`);

log("\n# 4. COMPARAÇÃO DOS KPIs (A = antes, B = depois), mesmos fatos");
ok("a pagar: igual nos dois estágios", antesA1.a_pagar === depoisB1.a_pagar && antesA2.a_pagar === 0 && depoisB2.a_pagar === 0);
ok("saídas de caixa do mês: iguais (4.475) — o caixa só se move no pagamento", antesA2.saidas_total === 4475 && depoisB2.saidas_total === 4475, `${antesA2.saidas_total} vs ${depoisB2.saidas_total}`);
ok("DRE, total geral de despesas operacionais: igual (4.475)", tot(antesA2.dre) === 4475 && tot(depoisB2.dre) === 4475, `${tot(antesA2.dre)} vs ${tot(depoisB2.dre)}`);
log(`MUDANÇA DE LUGAR NO DRE (única diferença): antes ${JSON.stringify(antesA2.dre)}; depois ${JSON.stringify(depoisB2.dre)}`);
ok("DRE: antes, as horas extras iam para o mês do VENCIMENTO da despesa; depois, para o mês da COMPETÊNCIA de origem (2026-09)",
  antesA2.dre["2026-09"] === 4400 && antesA2.dre["2026-10"] === 75 && depoisB2.dre["2026-09"] === 4475 && depoisB2.dre["2026-10"] === undefined);

log("\n# 5. Regras do comando novo");
r = await auth(U.owner_b, `select public.oris360_resolver_banco_horas('${EB}', 1, 'PAGO')`);
ok("repetir o pagamento das mesmas horas é recusado (saldo esgotado, nada duplica)", !r.ok && /SALDO_INSUFICIENTE/.test(r.msg), r.msg);
r = await db.query(`insert into public.salary_obligation_items (company_id, salary_obligation_id, employee_id, competence, kind, minutes, amount, time_bank_entry_id) select company_id, salary_obligation_id, employee_id, competence, kind, minutes, amount, time_bank_entry_id from public.salary_obligation_items`).catch((e) => ({ erro: e.message }));
ok("a mesma saída do banco não gera um segundo item na mesma competência (índice único)", /unique|duplicate/i.test(r.erro ?? ""), r.erro);
r = await auth(U.plain_b, `select public.oris360_resolver_banco_horas('${EB}', 10, 'PAGO')`);
ok("quem não tem apuração é negado", !r.ok && /sem permissao/.test(r.msg));
r = await auth(U.owner_a, `select public.oris360_resolver_banco_horas('${EB}', 10, 'PAGO')`);
ok("usuário de outra empresa é negado", !r.ok && /sem permissao/.test(r.msg));
r = await auth(U.plain_b, "select count(*)::int n from public.salary_obligation_items");
ok("leitura dos itens: quem tem despesas.read vê só os da própria empresa (1)", r.ok && r.rows[0].n === 1, `${r.rows?.[0]?.n}`);
r = await auth(U.owner_a, "select count(*)::int n from public.salary_obligation_items");
ok("leitura dos itens: empresa A não vê os da B", r.ok && r.rows[0].n === 0);
r = await auth(U.owner_b, `update public.salary_obligation_items set amount = 1`);
ok("escrita direta nos itens: NEGADA até ao Proprietário", negado(r), r.msg);
r = await auth(U.owner_b, `delete from public.salary_obligation_items`);
ok("exclusão direta nos itens: NEGADA", negado(r));
r = await auth(U.owner_b, `insert into public.salary_obligation_items (company_id, salary_obligation_id, employee_id, competence, kind, minutes, amount, time_bank_entry_id) select company_id, salary_obligation_id, employee_id, competence, kind, minutes, 1, time_bank_entry_id from public.salary_obligation_items`);
ok("inserção direta nos itens: NEGADA", negado(r));

// FIFO em duas competências
await credito(EB2, "2026-08-01", 60, U.owner_b);
await credito(EB2, "2026-09-01", 90, U.owner_b);
await obrigacao(U.owner_b, EB2, "2026-09-01");
r = await auth(U.owner_b, `select public.oris360_resolver_banco_horas('${EB2}', 100, 'PAGO')`);
ok("pagar horas de duas competências sem a folha de agosto gerada é recusado, e nada é gravado",
  !r.ok && /OBRIGACAO_INEXISTENTE.*08\/2026/.test(r.msg) && (await q(`select count(*)::int n from public.time_bank_entries where employee_id='${EB2}' and type='PAGO'`))[0].n === 0, r.msg);
await obrigacao(U.owner_b, EB2, "2026-08-01");
r = await auth(U.owner_b, `select public.oris360_resolver_banco_horas('${EB2}', 100, 'PAGO') id`);
const fatias = await q(`select competence::text c, minutes, amount::text a from public.salary_obligation_items where employee_id='${EB2}' order by competence`);
ok("FIFO: 100 min = 60 de agosto (R$ 30,00) + 40 de setembro (R$ 20,00), total R$ 50,00",
  r.ok && fatias.length === 2 && fatias[0].c === "2026-08-01" && fatias[0].minutes === 60 && num(fatias[0].a) === 30 && fatias[1].minutes === 40 && num(fatias[1].a) === 20, JSON.stringify(fatias));
ok("a saída PAGO guarda o total (50,00) e nenhuma despesa nasce", num((await q(`select amount::text a from public.time_bank_entries where employee_id='${EB2}' and type='PAGO'`))[0].a) === 50 && (await q(`select count(*)::int n from public.expenses where employee_id='${EB2}'`))[0].n === 0);
r = await auth(U.owner_b, `select public.oris360_resolver_banco_horas('${EB2}', 50, 'COMPENSADO') id`);
ok("compensar (sem dinheiro) segue funcionando e não cria item", r.ok && (await q(`select count(*)::int n from public.salary_obligation_items where employee_id='${EB2}'`))[0].n === 2, r.msg);

// competência ambígua: dois vínculos no mês => a obrigação não existe => nada é pago
await credito(EB3, "2026-09-01", 60, U.owner_b);
r = await auth(U.owner_b, `select public.oris360_resolver_banco_horas('${EB3}', 60, 'PAGO')`);
ok("sem obrigação da competência (inclusive quando a folha não pode ser formada), o pagamento é recusado", !r.ok && /OBRIGACAO_INEXISTENTE/.test(r.msg), r.msg);

log("\n# 6. Estorno (evento inverso)");
const saldoAntes = num((await auth(U.owner_b, `select public.oris360_time_bank_balance('${EB2}') b`)).rows[0].b);
r = await auth(U.apur_b, `select public.reverse_overtime_payment('${(await q(`select id from public.time_bank_entries where employee_id='${EB2}' and type='PAGO'`))[0].id}', 'erro de digitação')`);
ok("estorno exige também despesas.manage", !r.ok && /Sem permissão/.test(r.msg), r.msg);
const entryB2 = (await q(`select id from public.time_bank_entries where employee_id='${EB2}' and type='PAGO'`))[0].id;
r = await auth(U.owner_b, `select public.reverse_overtime_payment('${entryB2}', 'x')`);
ok("estorno exige motivo", !r.ok && /MOTIVO_OBRIGATORIO/.test(r.msg));
r = await auth(U.owner_b, `select public.reverse_overtime_payment('${entryB2}', 'Lançamento em duplicidade')`);
const st = await q(`select status, reverse_reason from public.salary_obligation_items where employee_id='${EB2}'`);
const ob2 = await q(`select additions::text a, net_amount::text n from public.salary_obligations where employee_id='${EB2}' order by competence`);
ok("estorno marca os itens como ESTORNADO (nada é apagado), guarda o motivo e zera os adicionais da obrigação",
  r.ok && st.every((s) => s.status === "ESTORNADO" && /duplicidade/.test(s.reverse_reason)) && ob2.every((o) => num(o.a) === 0 && num(o.n) === 4400), JSON.stringify(ob2));
const saldoDepois = num((await auth(U.owner_b, `select public.oris360_time_bank_balance('${EB2}') b`)).rows[0].b);
ok("as 100 horas voltam ao banco por crédito compensatório (histórico imutável)", saldoDepois === saldoAntes + 100, `${saldoAntes} -> ${saldoDepois}`);
r = await auth(U.owner_b, `select public.reverse_overtime_payment('${entryB2}', 'Lançamento em duplicidade')`);
ok("estornar de novo é idempotente (nada muda)", r.ok && num((await auth(U.owner_b, `select public.oris360_time_bank_balance('${EB2}') b`)).rows[0].b) === saldoDepois);
r = await auth(U.owner_b, `select public.reverse_overtime_payment('${entryB}', 'Pagamento indevido')`);
ok("estorno bloqueado quando a folha já foi paga além do valor sem as horas (estorne antes os vales)", !r.ok && /ESTORNO_BLOQUEADO/.test(r.msg), r.msg);
const legado = (await q(`select id from public.time_bank_entries where employee_id='${EA}' and type='PAGO'`));
r = await auth(U.owner_a, `select public.reverse_overtime_payment('${legado[0]?.id ?? "00000000-0000-0000-0000-000000000000"}', 'Pagamento indevido')`);
ok("pagamento legado (feito pela despesa) não é estornado por aqui", !r.ok && /ESTORNO_LEGADO/.test(r.msg), r.msg);

// =============================================================================================
log("\n# 7. REVERSÃO (sem itens) devolve funções e totais ao estado anterior");
const snapFn = async () => (await q("select md5(replace(pg_get_functiondef('public.oris360_resolver_banco_horas(uuid,integer,text)'::regprocedure) || pg_get_functiondef('private.salary_balances(uuid)'::regprocedure), chr(13), '')) h"))[0].h;
r = await db.exec(REV).then(() => ({ ok: true })).catch((e) => ({ ok: false, msg: e.message }));
ok("reversão com itens existentes é BLOQUEADA (não destrói histórico)", !r.ok && /REVERSAO_BLOQUEADA/.test(r.msg), r.msg);
await db.close();

// reversão limpa: banco novo, estado de produção e estado pós-salário
for (const comSalario of [false, true]) {
  const t = await montar();
  if (comSalario) { await t.db.exec(SAL1); await t.db.exec(SAL2); }
  const fn = async () => (await t.q("select md5(replace(pg_get_functiondef('public.oris360_resolver_banco_horas(uuid,integer,text)'::regprocedure) || pg_get_functiondef('private.salary_balances(uuid)'::regprocedure), chr(13), '')) h"))[0].h;
  const grants = async () => (await t.q("select md5(string_agg(table_name||privilege_type||grantee, '|' order by table_name, privilege_type, grantee)) h from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')"))[0].h;
  const [h0, g0] = [await fn(), await grants()];
  await t.db.exec(MIG);
  ok(`[${comSalario ? "com" : "sem"} fase 2 de salário] a migração se aplica`, (await t.q("select to_regclass('public.salary_obligation_items') t"))[0].t !== null);
  if (comSalario) {
    await t.credito(EB, "2026-09-01", 150, U.owner_b);
    await t.obrigacao(U.owner_b, EB, "2026-09-01");
    const rr = await t.auth(U.owner_b, `select public.oris360_resolver_banco_horas('${EB}', 150, 'PAGO') id`);
    ok("[com fase 2 de salário] o pagamento funciona com a função DEFINER (employees sem privilégio de coluna salarial)", rr.ok, rr.msg);
    const ent = rr.rows[0].id;
    await t.auth(U.owner_b, `select public.reverse_overtime_payment('${ent}', 'Estorno para reverter a migração')`);
    await t.db.exec("delete from public.salary_obligation_items");
  }
  await t.db.exec(REV);
  ok(`[${comSalario ? "com" : "sem"} fase 2 de salário] reversão devolve o corpo da função e de salary_balances IDÊNTICOS (hash)`, (await fn()) === h0);
  ok(`[${comSalario ? "com" : "sem"} fase 2 de salário] reversão devolve os grants de tabela idênticos e remove a tabela`, (await grants()) === g0 && (await t.q("select to_regclass('public.salary_obligation_items') t"))[0].t === null);
  await t.db.close();
}

log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
process.exit(falhas === 0 ? 0 : 1);
