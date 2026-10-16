// Prova da migration Clientes V1 no banco RECONSTRUÍDO (PGlite) a partir de supabase/migrations + crédito pendente.
// NÃO é homologação: sem PostgREST, Auth, Storage real nem concorrência real (PGlite é monoconexão).
// Uso: PGLITE_DIR=<pasta com @electric-sql/pglite> node supabase/pendentes/testes_clientes_v1_mestre.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = {
  gestor: "00000000-0000-0000-0000-0000000000a1",
  vendedor: "00000000-0000-0000-0000-0000000000a2",
  financeiro: "00000000-0000-0000-0000-0000000000a3",
  outra: "00000000-0000-0000-0000-0000000000b1",
};
const sql = (f) => fs.readFileSync(path.join(repo, "supabase/pendentes", f), "utf8");
const db = await criarBanco();
let falhas = 0;
const log = (s = "") => console.log(s);
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  -> " + detalhe : ""}`); };
const q = async (s) => (await db.query(s)).rows;
const cmd = () => crypto.randomUUID();
const j = (o) => JSON.stringify(o).replace(/'/g, "''");

async function como(uid, s) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: "authenticated" })}', false); set role authenticated;`);
  try { return { ok: true, rows: (await db.query(s)).rows }; } catch (e) { return { ok: false, msg: e.message, code: e.code }; } finally { await db.exec("reset role;"); }
}
async function comoAnon(s) {
  await db.exec(`select set_config('request.jwt.claims', '', false); set role anon;`);
  try { return { ok: true, rows: (await db.query(s)).rows }; } catch (e) { return { ok: false, msg: e.message }; } finally { await db.exec("reset role;"); }
}
const save = (uid, company, id, rev, data, command = cmd()) =>
  como(uid, `select public.oris360_customer_save('${command}', '${company}', ${id ? `'${id}'` : "null"}, ${rev ?? "null"}, '${j(data)}'::jsonb) as r`);
const list = (uid, company, args = "") => como(uid, `select public.oris360_customers_list('${company}'${args}) as r`);

log("# Reconstruindo o banco a partir de supabase/migrations");
const falhasReplay = await reaplicar(db, null, log);
ok("trilha reaplicada sem falha", falhasReplay.length === 0);
if (falhasReplay.length) process.exit(1);
await db.exec(sql("20261015120000_credito_cliente_fonte_unica.sql"));
ok("migration de crédito (dependência) aplicada", true);
const MIG = sql("20261016140000_clientes_v1_mestre.sql");
await db.exec(`
  insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a'),('${B}','Empresa B','INDUSTRY','empresa-b');
  insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(",")};
  insert into public.units (id, company_id, name) values ('cccccccc-0000-0000-0000-00000000000c','${A}','Matriz');
  insert into public.customers (company_id, name, company_name, phone, trade_name, cnpj) values
    ('${A}','Legado Um','Legado Um Ltda','7199','Mercearia São João','11222333000181'),
    ('${A}','Legado Dois','Legado Dois Ltda','7198','Padaria Central','');
  insert into public.ibge_cities (city_code, city_name, state_code, state_name) values
    ('1502954','Canaã dos Carajás','PA','Pará'),('2927408','Salvador','BA','Bahia') on conflict (city_code) do nothing;
`);
await db.exec(MIG);
ok("migration Clientes V1 aplicada sobre a trilha + crédito", true);
const legado = await q(`select display_number, revision, registration_status, person_type from public.customers order by display_number`);
ok("legado preservado e numerado por empresa (1,2), ATIVO, PJ, revisão 1", legado.length === 2 && legado[0].display_number === 1 && legado[1].display_number === 2 && legado.every((c) => c.revision === 1 && c.registration_status === "ATIVO" && c.person_type === "PJ"));

async function papel(uid, empresa, chave, perms) {
  const role = crypto.randomUUID(); const mem = crypto.randomUUID();
  await db.exec(`
    insert into public.roles (id, company_id, key, name) values ('${role}','${empresa}','${chave}','${chave}');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${empresa}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
    insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${empresa}','${uid}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${empresa}','${mem}','${role}');`);
}
await papel(U.gestor, A, "gestor", ["billing.view_credit_analysis", "billing.view_receivables", "billing.invoice_order", "billing.settle_receivable", "customer_credit.change_permanent_limit"]);
await papel(U.vendedor, A, "vendedor", ["billing.view_credit_analysis"]);
await papel(U.financeiro, A, "financeiro", ["billing.view_receivables", "billing.view_credit_analysis", "billing.invoice_order", "billing.settle_receivable"]);
await papel(U.outra, B, "outra", ["billing.view_receivables", "customer_credit.change_permanent_limit"]);
const emp = async (empresa, nome) => (await q(`insert into public.employees (company_id, name, status) values ('${empresa}','${nome}','ATIVO') returning id`))[0].id;
const sellerA = await emp(A, "Raimundo Santos");
const promoterA = await emp(A, "Fernando Lima");
const sellerB = await emp(B, "Vendedor B");

log("\n# Criar/editar: validação, documento, IBGE, ponto, revisão, idempotência");
const base = { trade_name: "Tio Óris Supermercados", company_name: "Óris Santos Comércio Ltda", name: "Óris Santos", phone: "(94) 99138-5788",
  person_type: "PJ", cnpj: "12.ABC.345/01DE-35", state: "PA", city: "Canaã dos Carajás", ibge_code: "1502954", address: "Avenida Castanheira", address_number: "S/N", neighborhood: "Park Carajás", cep: "68537-000" };
const c1cmd = cmd();
let r = await save(U.gestor, A, null, null, base, c1cmd);
ok("cria cliente via comando", r.ok && r.rows[0].r.revision === 1 && r.rows[0].r.replayed === false, r.msg);
const id1 = r.rows?.[0]?.r.customer_id;
let row = (await q(`select cnpj, display_number, cep from public.customers where id='${id1}'`))[0];
ok("CNPJ alfanumérico preserva letras e zeros (caixa canônica); CEP só dígitos; número 3 na empresa", row.cnpj === "12ABC34501DE35" && row.cep === "68537000" && row.display_number === 3, JSON.stringify(row));
r = await como(U.gestor, `select public.oris360_customer_save('${c1cmd}', '${A}', null, null, '${j(base)}'::jsonb) as r`);
ok("retry com o mesmo command_id devolve o mesmo cliente (replayed) sem duplicar", r.ok && r.rows[0].r.customer_id === id1 && r.rows[0].r.replayed === true && (await q(`select count(*)::int n from public.customers where company_id='${A}'`))[0].n === 3);
r = await como(U.gestor, `select public.oris360_customer_save('${c1cmd}', '${A}', null, null, '${j({ ...base, phone: "000" })}'::jsonb)`);
ok("mesmo command_id com corpo diferente é conflito", !r.ok && /COMANDO_REUSADO/.test(r.msg), r.msg);
r = await save(U.gestor, A, null, null, { ...base, trade_name: "Outro", cnpj: "12abc34501de35" });
ok("documento duplicado na empresa é recusado (normalizado)", !r.ok && /DOCUMENTO_DUPLICADO/.test(r.msg), r.msg);
r = await save(U.gestor, A, null, null, { ...base, cnpj: "12ABC345010AB" });
ok("CNPJ com 13 posições é recusado no servidor", !r.ok && /CNPJ invalido/.test(r.msg), r.msg);
r = await save(U.gestor, A, null, null, { ...base, cnpj: "12ABC345010A3B" });
ok("CNPJ com letra nos dígitos finais é recusado", !r.ok && /CNPJ invalido/.test(r.msg), r.msg);
r = await save(U.gestor, A, null, null, { ...base, person_type: "PF", cnpj: "123.456.789-09", trade_name: "Banca da Ana", company_name: "Ana Souza", ibge_code: "2927408", state: "BA", city: "Salvador" });
ok("PF com CPF de 11 números é aceito", r.ok, r.msg);
r = await save(U.gestor, A, null, null, { ...base, trade_name: "X", cnpj: "00ABC345010035", ibge_code: "2927408" });
ok("IBGE que não pertence à UF é recusado", !r.ok && /IBGE_INVALIDO/.test(r.msg), r.msg);
r = await save(U.gestor, A, null, null, { ...base, trade_name: "Sem nome" , company_name: "", cnpj: "00ABC345010036" });
ok("razão social/nome completo obrigatório na criação", !r.ok, r.msg);

r = await save(U.gestor, A, id1, 1, { latitude: "-6.5303" });
ok("latitude sem longitude é recusada", !r.ok && /juntas/.test(r.msg), r.msg);
r = await save(U.gestor, A, id1, 1, { latitude: "95", longitude: "-49.8" });
ok("latitude fora da faixa é recusada", !r.ok, r.msg);
r = await save(U.gestor, A, id1, 1, { latitude: "0", longitude: "0", location_confirmed: true, location_source: "MANUAL", location_accuracy_m: 12 });
ok("ponto 0,0 é válido e confirmado com origem/precisão", r.ok && r.rows[0].r.revision === 2, r.msg);
row = (await q(`select location_confirmed_at is not null as conf, location_source, location_accuracy_m::int acc from public.customers where id='${id1}'`))[0];
ok("confirmação gravada com origem e precisão", row.conf === true && row.location_source === "MANUAL" && row.acc === 12);
r = await save(U.gestor, A, id1, 2, { address: "Rua Nova" });
row = (await q(`select location_confirmed_at is null as sem from public.customers where id='${id1}'`))[0];
ok("mudar endereço invalida a confirmação do ponto", r.ok && row.sem === true, r.msg);
r = await save(U.gestor, A, id1, 2, { service_notes: "x" });
ok("revisão desatualizada é conflito (sem last-write-wins)", !r.ok && /CONFLITO_REVISAO/.test(r.msg) && r.code === "40001", r.msg);
r = await save(U.gestor, A, id1, 3, { seller_employee_id: sellerA, promoter_employee_id: promoterA, segment: "Supermercado" });
ok("vendedor/promotor da empresa são vinculados", r.ok, r.msg);
r = await save(U.gestor, A, id1, 4, { seller_employee_id: sellerB });
ok("vendedor de outra empresa é recusado", !r.ok && /outra empresa/.test(r.msg), r.msg);
r = await save(U.gestor, A, id1, 4, { name: "Contato Novo" });
ok("update parcial não apaga campos não enviados", r.ok && (await q(`select company_name, seller_employee_id from public.customers where id='${id1}'`))[0].company_name === "Óris Santos Comércio Ltda");
r = await save(U.gestor, A, id1, 5, { extra_contacts: [{ name: "Maria", role: "Financeiro", phone: "9499", whatsapp_enabled: true }, { name: "" }] });
ok("contatos adicionais gravados (nome vazio ignorado)", r.ok && (await q(`select count(*)::int n from public.customer_contacts where customer_id='${id1}'`))[0].n === 1);

log("\n# Limite proposto x limite aprovado");
await db.exec(`select set_config('request.jwt.claims','', false)`);
await como(U.gestor, `select public.oris360_set_credit_limit('${id1}', 5000, 'aprovado em comite')`);
r = await save(U.vendedor, A, id1, 6, { proposed_credit_limit: 9000 });
ok("sem permissão não altera proposta de crédito", !r.ok && /propor condicoes/.test(r.msg), r.msg);
r = await save(U.vendedor, A, id1, 6, { service_notes: "vendedor edita atendimento" });
ok("mesma pessoa edita campos comuns", r.ok, r.msg);
r = await save(U.gestor, A, id1, 7, { proposed_credit_limit: 9000, preferred_payment_days: "28", preferred_payment_method: "Boleto" });
ok("gestor autorizado grava proposta", r.ok, r.msg);
row = (await q(`select c.proposed_credit_limit::int p, cc.credit_limit::int a from public.customers c join public.customer_credit cc on cc.customer_id = c.id where c.id='${id1}'`))[0];
ok("salvar a ficha NÃO altera o limite aprovado (proposto 9000, aprovado 5000)", row.p === 9000 && row.a === 5000, JSON.stringify(row));
r = await como(U.vendedor, `update public.customers set proposed_credit_limit = 1 where id='${id1}'`);
ok("UPDATE direto da proposta sem permissão é recusado pelo gatilho", !r.ok && /propor condicoes/.test(r.msg), r.msg);
r = await como(U.vendedor, `update public.customer_credit set credit_limit = 1 where customer_id='${id1}'`);
ok("limite aprovado só por RPC (escrita direta recusada)", !r.ok, r.msg);

log("\n# Isolamento por empresa");
r = await save(U.outra, B, id1, 8, { service_notes: "invasor" });
ok("outra empresa não grava cliente de A", !r.ok && /acesso/.test(r.msg), r.msg);
r = await save(U.outra, A, null, null, { ...base, cnpj: "00ABC345010037", trade_name: "Intruso" });
ok("outra empresa não cria cliente em A (mesmo passando company_id de A)", !r.ok && /acesso/.test(r.msg), r.msg);
r = await list(U.outra, A);
ok("outra empresa não lista clientes de A", !r.ok && /acesso/.test(r.msg), r.msg);
r = await como(U.outra, `select count(*)::int n from public.customers`);
ok("RLS: outra empresa enxerga 0 clientes", r.rows[0].n === 0);
r = await como(U.outra, `select public.oris360_customer_receivables('${id1}') as r`);
ok("outra empresa recebe null nos títulos", r.ok && r.rows[0].r === null);
r = await como(U.outra, `select public.oris360_customer_commercial_summary('${id1}') as r`);
ok("outra empresa recebe null no resumo comercial", r.ok && r.rows[0].r === null);
r = await como(U.outra, `select public.oris360_customer_set_status('${cmd()}', '${id1}', 'INATIVO', 'tentativa indevida', 8)`);
ok("outra empresa não inativa cliente de A", !r.ok && /acesso/.test(r.msg), r.msg);

log("\n# Inativar em vez de excluir");
const cliComPedido = (await q(`select id from public.customers where trade_name='Padaria Central'`))[0].id;
await db.exec(`insert into public.orders (order_number, customer_name, phone, total_amount, status, customer_id, company_id) values ('#H1','x','7199',50,'NEW','${cliComPedido}','${A}')`);
r = await como(U.gestor, `delete from public.customers where id='${cliComPedido}'`);
ok("excluir cliente com pedido é recusado no servidor", !r.ok && /CLIENTE_COM_HISTORICO/.test(r.msg), r.msg);
const rev0 = (await q(`select revision from public.customers where id='${cliComPedido}'`))[0].revision;
r = await como(U.gestor, `select public.oris360_customer_set_status('${cmd()}', '${cliComPedido}', 'INATIVO', 'abc', ${rev0})`);
ok("inativar exige motivo", !r.ok && /motivo/.test(r.msg), r.msg);
const stCmd = cmd();
r = await como(U.gestor, `select public.oris360_customer_set_status('${stCmd}', '${cliComPedido}', 'INATIVO', 'encerrou as atividades', ${rev0}) as r`);
row = (await q(`select registration_status, inactivated_at is not null as a, inactivation_reason from public.customers where id='${cliComPedido}'`))[0];
ok("inativa com motivo, data e autor; pedidos preservados", r.ok && row.registration_status === "INATIVO" && row.a && row.inactivation_reason === "encerrou as atividades" && (await q(`select count(*)::int n from public.orders where customer_id='${cliComPedido}'`))[0].n === 1, r.msg);
r = await como(U.gestor, `select public.oris360_customer_set_status('${stCmd}', '${cliComPedido}', 'INATIVO', 'encerrou as atividades', ${rev0}) as r`);
ok("retry idempotente da inativação", r.ok && r.rows[0].r.replayed === true);
ok("auditoria registrada (created/updated/inactivated)", (await q(`select count(*)::int n from public.audit_events where entity_type='customer' and event_type in ('customer.created','customer.updated','customer.inactivated')`))[0].n >= 5);
const rev1 = (await q(`select revision from public.customers where id='${cliComPedido}'`))[0].revision;
r = await como(U.gestor, `select public.oris360_customer_set_status('${cmd()}', '${cliComPedido}', 'ATIVO', 'voltou a comprar', ${rev1}) as r`);
row = (await q(`select registration_status, inactivated_at, inactivation_reason from public.customers where id='${cliComPedido}'`))[0];
ok("reativa limpando a inativação", r.ok && row.registration_status === "ATIVO" && row.inactivated_at === null && row.inactivation_reason === null);

log("\n# Faturamento, títulos e histórico de pagamentos (dados sintéticos)");
const pm = (valor, venc) => JSON.stringify([{ type: "BOLETO", amount: valor, generates_credit: true, installments: [{ number: 1, days: 30, due_date: venc, amount: valor }] }]);
let seq = 0;
async function faturar(cli, total, venc, chave) {
  const ped = (await q(`insert into public.orders (order_number, customer_name, phone, total_amount, status, customer_id, company_id) values ('#F${++seq}','x','7199',${total},'CONFIRMED','${cli}','${A}') returning id`))[0].id;
  const rr = await como(U.financeiro, `select public.oris360_billing_confirm('${ped}','${pm(total, venc)}'::jsonb,'SEM_DOCUMENTO_FISCAL','${chave}') as id`);
  if (!rr.ok) throw new Error(rr.msg);
  return { ped, billing: rr.rows[0].id, rec: (await q(`select id from public.receivables where billing_id='${rr.rows[0].id}'`))[0].id };
}
await db.exec(`insert into public.products (company_id, category_id, name) select '${A}', (select id from public.categories limit 1), 'x' where false`).catch(() => {});
const f1 = await faturar(id1, 1000, "2027-12-01", "key-fat-0001");
const f2 = await faturar(id1, 500, "2027-12-01", "key-fat-0002");
const f3 = await faturar(id1, 300, "2027-12-01", "key-fat-0003");
const hoje = (await q(`select private.company_today('${A}')::text d`))[0].d;
await db.exec(`update public.receivables set due_date = (date '${hoje}' - 10) where id='${f1.rec}'`);
await db.exec(`update public.receivables set due_date = (date '${hoje}' - 4) where id='${f2.rec}'`);
r = await como(U.financeiro, `select public.oris360_receivable_pay('${f1.rec}', 400, 'pay-key-0001', null)`);
ok("baixa parcial via RPC existente", r.ok, r.msg);
r = await como(U.financeiro, `select public.oris360_receivable_pay('${f2.rec}', 500, 'pay-key-0002', null)`);
r = await como(U.financeiro, `select public.oris360_receivable_pay('${f3.rec}', 300, 'pay-key-0003', null)`);
await db.exec(`update public.receivables set due_date = (date '${hoje}' + 2) where id='${f3.rec}'`);
let rec = (await como(U.financeiro, `select public.oris360_customer_receivables('${id1}') as r`)).rows[0].r;
ok("título com baixa parcial continua ABERTO e marcado parcial (não 'quitado')", rec.open.length === 1 && rec.open[0].partial === true && Number(rec.open[0].balance) === 600 && rec.open[0].overdue === true && rec.open[0].days_late === 10, JSON.stringify(rec.open));
ok("quitados: 2 (um em atraso de 4 dias... pelo vencimento alterado, outro adiantado)", rec.paid.length === 2, JSON.stringify(rec.paid.map((p) => p.days_late)));
const late = rec.paid.find((p) => p.days_late > 0);
ok("atraso do quitado usa a data efetiva de quitação (4 dias), antecipado = 0", late && late.days_late === 4 && rec.paid.some((p) => p.days_late === 0 && p.on_time), JSON.stringify(rec.paid));
ok("pontualidade 50% por quantidade; forma = boleto (do meio real)", Number(rec.summary.on_time_percent) === 50 && rec.summary.paid_count === 2 && rec.paid[0].method === "BOLETO");
ok("resumo de abertos: vencidos 1 / R$ 600 / mais antigo 10d", rec.open_summary.overdue_count === 1 && Number(rec.open_summary.overdue_amount) === 600 && rec.open_summary.oldest_days === 10);
const pagId = (await q(`select id from public.receivable_payments where receivable_id='${f2.rec}' and kind='BAIXA'`))[0].id;
await como(U.financeiro, `select public.oris360_receivable_reverse('${pagId}', 'rev-key-0001', 'pagamento em duplicidade')`);
rec = (await como(U.financeiro, `select public.oris360_customer_receivables('${id1}') as r`)).rows[0].r;
ok("estorno reabre o título: some do histórico de pagos", rec.paid.length === 1 && rec.open.length === 2);
r = await como(U.vendedor, `select public.oris360_customer_receivables('${id1}') as r`);
ok("sem billing.view_receivables a leitura é null (tela mostra restrito, nunca zero)", r.ok && r.rows[0].r === null);
const cSem = (await q(`select id from public.customers where trade_name='Padaria Central'`))[0].id;
rec = (await como(U.financeiro, `select public.oris360_customer_receivables('${cSem}') as r`)).rows[0].r;
ok("sem histórico: percentual nulo (sem 100% fictício)", rec.summary.on_time_percent === null && rec.summary.paid_count === 0);

log("\n# Lista: filtros, ordenação, paginação, situação financeira");
r = await list(U.gestor, A);
let L = r.rows?.[0]?.r;
ok("lista base: total 4, página 1, tamanho 10", r.ok && L.total === 4 && L.page === 1 && L.page_size === 10, r.msg);
ok("kpis da empresa: clientes, sem compra, com vencidos", L.kpis.total === 4 && L.kpis.with_debt === 1);
L = (await list(U.gestor, A, `, p_search => 'sao joao'`)).rows[0].r;
ok("busca sem acento encontra 'São João'", L.total === 1 && L.items[0].trade_name === "Mercearia São João");
L = (await list(U.gestor, A, `, p_search => '12.abc.345/01de-35'`)).rows[0].r;
ok("busca por CNPJ alfanumérico (pontuação ignorada, letras mantidas)", L.total === 1 && L.items[0].document === "12ABC34501DE35");
L = (await list(U.gestor, A, `, p_finance => 'debt'`)).rows[0].r;
ok("filtro financeiro: com títulos vencidos (600 parcial + 500 estornado)", L.total === 1 && Number(L.items[0].overdue_balance) === 1100 && L.items[0].overdue_count === 2 && Number(L.items[0].open_balance) === 1100, JSON.stringify(L.items[0]));
L = (await list(U.gestor, A, `, p_finance => 'clear'`)).rows[0].r;
ok("filtro financeiro: sem vencidos", L.total === 3);
L = (await list(U.gestor, A, `, p_city => 'Salvador'`)).rows[0].r;
ok("filtro cidade", L.total === 1 && L.items[0].person_type === "PF");
L = (await list(U.gestor, A, `, p_uf => 'pa', p_neighborhood => 'park'`)).rows[0].r;
ok("filtros UF + bairro combinados (AND, sem acento/caixa)", L.total === 1);
L = (await list(U.gestor, A, `, p_seller => '${sellerA}'`)).rows[0].r;
ok("filtro por vendedor (id estável)", L.total === 1 && L.items[0].seller.name === "Raimundo Santos");
L = (await list(U.gestor, A, `, p_registration => 'inactive'`)).rows[0].r;
ok("situação cadastral inativo (nenhum no momento)", L.total === 0);
L = (await list(U.gestor, A, `, p_sort => 'debt'`)).rows[0].r;
ok("ordenação por maior saldo vencido", L.items[0].id === id1);
L = (await list(U.gestor, A, `, p_sort => 'name'`)).rows[0].r;
ok("ordenação por nome A-Z (normalizada)", L.items[0].trade_name === "Banca da Ana");
L = (await list(U.gestor, A, `, p_page_size => 5`)).rows[0].r;
ok("tamanho 5 não existe: volta para 10", L.page_size === 10);
L = (await list(U.gestor, A, `, p_page_size => 20, p_page => 99`)).rows[0].r;
ok("página fora do intervalo é recalculada", L.page === 1 && L.pages === 1);
for (let i = 0; i < 12; i++) await save(U.gestor, A, null, null, { ...base, trade_name: `Lote ${String(i).padStart(2, "0")}`, cnpj: `00ABC3450${String(i).padStart(2, "0")}A${i % 10}`.slice(0, 12) + "00", company_name: "Lote" });
L = (await list(U.gestor, A, `, p_sort => 'name', p_page => 2, p_page_size => 10`)).rows[0].r;
ok("paginação: 16 clientes, 2 páginas, 6 na segunda", L.total === 16 && L.pages === 2 && L.page === 2 && L.items.length === 6, `total=${L.total} pages=${L.pages} itens=${L.items.length}`);
L = (await list(U.gestor, A, `, p_category => 'prospect'`)).rows[0].r;
ok("segmento 'sem primeira compra' filtra a lista, resumo mantém o denominador", L.total === 15 && L.summary.total === 16 && L.summary.active === 1 && L.summary.prospect === 15);
const cliCompra = (await q(`select id from public.customers where id='${id1}'`))[0].id;
L = (await list(U.gestor, A, `, p_category => 'active'`)).rows[0].r;
ok("compra faturada hoje = 'compras recentes' (30 dias); o resumo continua sobre o conjunto filtrado antes do segmento", L.total === 1 && L.items[0].id === cliCompra && L.summary.total === 16 && L.items[0].last_purchase === hoje);
L = (await list(U.vendedor, A)).rows[0].r;
ok("sem permissão financeira: campos financeiros nulos e filtro ignorado", L.finance_available === false && L.items[0].overdue_balance === null && L.kpis.with_debt === null);
L = (await list(U.vendedor, A, `, p_finance => 'debt'`)).rows[0].r;
ok("filtro financeiro sem permissão não vaza quem deve", L.total === 16);

log("\n# Resumo comercial");
await db.exec(`insert into public.order_items (company_id, order_id, product_name, presentation, pack_quantity, packs_quantity, total_units, unit_price, total_price, weight_volume)
  values ('${A}','${f1.ped}','Colorau 100 g','Caixa',10,2,20,50,1000,'100 g'),('${A}','${f2.ped}','Detergente 500 ml','Caixa',10,1,10,50,500,'500 ml')`);
let S = (await como(U.vendedor, `select public.oris360_customer_commercial_summary('${id1}','six') as r`)).rows[0].r;
ok("compras do período: R$ 1.800 em 3 pedidos faturados", Number(S.total) === 1800 && S.count === 3);
ok("série mensal tem 6 pontos e inclui meses sem compra com zero", S.series.length === 6 && S.series.filter((x) => Number(x.value) === 0).length === 5);
ok("ranking dense_rank (1º de N clientes ativos), critério documentado", S.rank.position === 1 && S.rank.universe === 16 && /dense_rank/.test(S.rank.criterion));
ok("produtos: ordenados por valor líquido, todos os comprados, paginação global", S.products_total === 2 && S.products[0].name === "Colorau 100 g" && S.products[0].position === 1 && Number(S.products[0].share) === 55.6);
S = (await como(U.vendedor, `select public.oris360_customer_commercial_summary('${id1}','six', 1, 1) as r`)).rows[0].r;
ok("'ver mais' mantém a posição global (offset 1 => posição 2)", S.products.length === 1 && S.products[0].position === 2);
await db.exec(`update public.orders set status='CANCELLED' where id='${f2.ped}'`);
S = (await como(U.vendedor, `select public.oris360_customer_commercial_summary('${id1}','month') as r`)).rows[0].r;
ok("pedido cancelado sai da compra líquida", Number(S.total) === 1300 && S.count === 2);
S = (await como(U.vendedor, `select public.oris360_customer_commercial_summary('${cSem}','six') as r`)).rows[0].r;
ok("cliente sem compra: total 0, sem última compra (não inventa data), sem produtos", Number(S.total) === 0 && S.last_billed_purchase === null && S.products_total === 0);

log("\n# Capacidades");
let cap = (await como(U.vendedor, `select public.oris360_customer_capabilities('${A}') as r`)).rows[0].r;
ok("vendedor: membro, sem proposta de crédito nem leitura de títulos", cap.member && !cap.can_propose_credit && !cap.can_view_receivables && cap.can_view_credit);
cap = (await como(U.gestor, `select public.oris360_customer_capabilities('${A}') as r`)).rows[0].r;
ok("gestor: proposta e títulos", cap.can_propose_credit && cap.can_view_receivables);
cap = (await como(U.outra, `select public.oris360_customer_capabilities('${A}') as r`)).rows[0].r;
ok("outra empresa não é membro de A e não lê títulos de A", cap.member === false && !cap.can_view_receivables);

log("\n# Mídia");
const med = async (uid, cli, cat, prim, path) => como(uid, `insert into public.customer_media (customer_id, category, primary_front, storage_path, mime_type, size_bytes, caption) values ('${cli}','${cat}',${prim},'${path}','image/jpeg',1000,'x') returning id`);
r = await med(U.gestor, id1, "FACHADA", true, `${id1}/a.jpg`);
ok("membro grava metadados de foto; empresa vem do cliente", r.ok && (await q(`select company_id from public.customer_media where customer_id='${id1}'`))[0].company_id === A, r.msg);
const m1 = r.rows?.[0]?.id;
r = await med(U.gestor, id1, "FACHADA", true, `${id1}/b.jpg`);
ok("só uma fachada principal por cliente", !r.ok, r.msg);
r = await med(U.gestor, id1, "INTERIOR", true, `${id1}/c.jpg`);
ok("foto interna não pode ser principal", !r.ok, r.msg);
r = await med(U.gestor, id1, "FACHADA", false, `${id1}/d.jpg`);
const m2 = r.rows?.[0]?.id;
r = await como(U.gestor, `select public.oris360_customer_media_set_primary('${m2}')`);
ok("trocar a principal por RPC (atômico)", r.ok && (await q(`select count(*)::int n from public.customer_media where customer_id='${id1}' and primary_front`))[0].n === 1 && (await q(`select primary_front from public.customer_media where id='${m2}'`))[0].primary_front === true, r.msg);
r = await como(U.outra, `select public.oris360_customer_media_set_primary('${m1}')`);
ok("outra empresa não mexe na foto de A", !r.ok);
r = await como(U.outra, `select count(*)::int n from public.customer_media`);
ok("RLS da mídia: outra empresa enxerga 0", r.rows[0].n === 0);
r = await como(U.gestor, `insert into public.customer_media (customer_id, category, storage_path, mime_type, size_bytes) values ('${id1}','OUTRA','${id1}/e.gif','image/gif',10)`);
ok("tipo de arquivo fora de jpeg/png/webp é recusado no banco", !r.ok);
ok("bucket customer-media é privado, 8 MB, só imagens", (await q(`select public, file_size_limit, allowed_mime_types from storage.buckets where id='customer-media'`)).every((b) => b.public === false && Number(b.file_size_limit) === 8388608 && b.allowed_mime_types.length === 3));

log("\n# Grants e anon");
for (const fn of ["oris360_customer_save(uuid,uuid,uuid,integer,jsonb)", "oris360_customer_set_status(uuid,uuid,text,text,integer)", "oris360_customers_list(uuid,text,text,text,text,uuid,uuid,text,text,text,text,integer,integer)",
  "oris360_customer_receivables(uuid,integer)", "oris360_customer_commercial_summary(uuid,text,integer,integer)", "oris360_customer_media_set_primary(uuid)", "oris360_customer_capabilities(uuid)"]) {
  const g = (await q(`select has_function_privilege('anon','public.${fn}','execute') a, has_function_privilege('authenticated','public.${fn}','execute') u`))[0];
  ok(`${fn.split("(")[0]}: authenticated sim, anon não`, g.u === true && g.a === false);
}
r = await comoAnon(`select public.oris360_customers_list('${A}')`);
ok("anon chamando a lista é recusado", !r.ok, r.msg);
r = await comoAnon(`select count(*) from public.customer_contacts`);
ok("anon sem acesso às tabelas novas", !r.ok);
r = await como(U.gestor, `select count(*) from public.customer_commands`);
ok("customer_commands não é legível pela API", !r.ok);

log("\n# Reversão");
await db.exec(sql("20261016140000_clientes_v1_mestre_REVERSAO.sql"));
const resto = (await q(`select
  (select count(*)::int from information_schema.columns where table_schema='public' and table_name='customers' and column_name in ('revision','latitude','seller_employee_id','proposed_credit_limit')) cols,
  (select count(*)::int from pg_proc where proname like 'oris360_customer%' and proname not like 'oris360_customer_credit%') fns,
  (select count(*)::int from information_schema.tables where table_name in ('customer_media','customer_contacts','customer_commands')) tabs,
  (select count(*)::int from public.customers) clientes`))[0];
ok("reversão remove colunas, funções e tabelas novas e preserva os clientes", resto.cols === 0 && resto.fns === 0 && resto.tabs === 0 && resto.clientes === 16, JSON.stringify(resto));

log(falhas ? `\nRESULTADO: ${falhas} FALHA(S)` : "\nRESULTADO: todos os testes passaram (banco reconstruído, não é homologação)");
await db.close();
process.exit(falhas ? 1 : 0);
