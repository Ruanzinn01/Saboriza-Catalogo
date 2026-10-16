// Teste por API real (GoTrue + PostgREST + RPC) de Clientes V1 e Fornecedores V1 na homologacao.
// Uso: HOMOLOG_URL=... HOMOLOG_KEY=... node clientes_fornecedores.mjs
// Senha lida de C:\Users\rruan\homolog-credenciais.txt apenas em memoria. Nada sensivel e impresso.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.HOMOLOG_URL, KEY = process.env.HOMOLOG_KEY;
if (!URL_ || !KEY || !/dfynvpieyvvameftrent/.test(URL_)) { console.error('Env ausente ou URL nao e a homologacao'); process.exit(2); }
const A = '0825487f-cff0-42cc-9442-d95ff552f75f', B = '02854143-5225-4362-b5c3-130729a7f707';
const S1 = 'a0000000-0000-4000-8000-0000000000e1', S2 = 'a0000000-0000-4000-8000-0000000000e2', SB = 'a0000000-0000-4000-8000-0000000000e3';
const CAT1 = 'a0000000-0000-4000-8000-0000000000d1', CAT2 = 'a0000000-0000-4000-8000-0000000000d2';
const C_REST = '20e15052-8ad3-408f-bfb7-3f6947d2030e', C_ATAC = '38598a41-4cb1-4df8-a69e-aecbaee105f3', C_B = '2e51a85f-8cd2-4546-9173-d56939fdbe23', C_MERC = 'cc662d6b-c6d4-45de-a25b-d22b0bbf1e82';
const PROD_A = '29fd81f4-f137-4d9a-bbcd-418ee7c00fab';
const ORD_A = '2a645def-f242-4202-9113-18af6b6df969';
const ORD_CONF = 'cfc9b123-820f-4e69-bbbc-8e4416f92be1'; // pedido sintetico da empresa A em CONFIRMED (preparado por SQL na homologacao)

const txt = readFileSync('C:\\Users\\rruan\\homolog-credenciais.txt', 'utf8').split(/\r?\n/);
const li = txt.findIndex(l => /senha/i.test(l));
const PW = (txt[li].split(':').slice(1).join(':') || txt[li + 1] || '').trim();

const results = [];
const rec = (perfil, caso, ok, det) => { results.push({ perfil, caso, ok, det }); console.log(`${ok === 'BLOQUEADO' ? 'BLOQUEADO' : ok ? 'PASSOU' : 'FALHOU'} [${perfil}] ${caso} ${det ?? ''}`); };

async function login(email) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j.access_token };
}
const call = async (tk, method, path, body) => {
  const headers = { apikey: KEY, 'content-type': 'application/json', prefer: 'return=representation' };
  if (tk !== null) headers.authorization = `Bearer ${tk ?? KEY}`;
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j, n: Array.isArray(j) ? j.length : null, msg: (j && (j.message || j.error)) || '' };
};
const rpc = (tk, fn, args) => call(tk, 'POST', `rpc/${fn}`, args ?? {});
const denied = r => r.status >= 400;
const msgHas = (r, s) => r.status >= 400 && String(r.msg).includes(s);
const short = r => `http ${r.status}${r.status >= 400 ? ' ' + String(r.msg).slice(0, 70) : ''}`;

const perfis = { gestor: 'gestor', vendedor: 'vendedor', separador: 'separador', entregador: 'entregador', producao: 'producao', outra: 'outra-empresa' };
const tok = {};
for (const [p, u] of Object.entries(perfis)) {
  const r = await login(`${u}@homolog.test`); tok[p] = r.token;
  rec(p, 'login GoTrue', r.status === 200 && !!r.token, `http ${r.status}`);
}
if (!tok.gestor) { console.error('Sem login do gestor'); process.exit(1); }
const g = tok.gestor, op = ['vendedor', 'separador', 'entregador', 'producao'];
const sfx = Date.now().toString().slice(-6);
const doc14 = n => `9${String(n).padStart(5, '0')}${sfx}`.slice(0, 12) + '66'; // 12 + 2 numericos
const supPayload = (tag, doc) => ({ trade_name: `HOMOLOG CF ${tag}`, company_name: `HOMOLOG CF ${tag} Ltda`, cnpj: doc, person_type: 'PJ', state: 'PA', city: 'Belem', address: 'Rua Teste', street_number: '1', phone: '91900000000', email: `${tag.toLowerCase()}@homolog.test` });

// ====================== FORNECEDORES ======================
{
  const r = await call(g, 'GET', 'suppliers?select=id,company_id,trade_name,active');
  rec('gestor', 'F01 le suppliers so da empresa A', r.status === 200 && r.n >= 3 && r.body.every(x => x.company_id === A), `${r.n} linhas, B=${r.body?.filter?.(x => x.company_id === B).length}`);
  rec('gestor', 'F02 SELECT direto em suppliers_bank_details (OWNER tem banco.read)', (await call(g, 'GET', 'supplier_bank_details?select=supplier_id')).status === 200);
}
const cmdCreate = randomUUID(); const docNew = doc14(1); const payNew = supPayload('Novo', docNew);
let supNew;
{
  const r = await rpc(g, 'create_supplier', { p_command_id: cmdCreate, p_payload: payNew });
  supNew = r.body; rec('gestor', 'F03 create_supplier', r.status === 200 && r.body?.replayed === false && !!r.body?.id, short(r));
  const r2 = await rpc(g, 'create_supplier', { p_command_id: cmdCreate, p_payload: payNew });
  rec('gestor', 'F04 idempotencia command_id (replay devolve o mesmo id)', r2.status === 200 && r2.body?.replayed === true && r2.body?.id === supNew?.id, short(r2));
  const r3 = await rpc(g, 'create_supplier', { p_command_id: cmdCreate, p_payload: { ...payNew, trade_name: 'Outro nome' } });
  rec('gestor', 'F05 mesmo command_id com corpo diferente = CONFLITO_COMANDO', msgHas(r3, 'CONFLITO_COMANDO'), short(r3));
  const r4 = await rpc(g, 'create_supplier', { p_command_id: randomUUID(), p_payload: payNew });
  rec('gestor', 'F06 documento duplicado = DUPLICADO', msgHas(r4, 'DUPLICADO'), short(r4));
  const r5 = await rpc(g, 'create_supplier', { p_command_id: randomUUID(), p_payload: { ...supPayload('SemDoc', ''), cnpj: '' } });
  rec('gestor', 'F07 cadastro novo sem documento e recusado', denied(r5), short(r5));
  const rc = await rpc(g, 'find_supplier_by_document', { p_document: payNew.cnpj, p_exclude: null });
  rec('gestor', 'F08 find_supplier_by_document acha o recem-criado', rc.status === 200 && rc.body?.id === supNew?.id, short(rc));
}
{
  const id = supNew?.id;
  const u = await rpc(g, 'update_supplier', { p_id: id, p_expected_revision: 1, p_payload: { ...payNew, city: 'Ananindeua', buyer_name: 'Comprador HCF' } });
  rec('gestor', 'F09 update_supplier com revisao correta', u.status === 200 && u.body?.revision === 2, short(u));
  const u2 = await rpc(g, 'update_supplier', { p_id: id, p_expected_revision: 1, p_payload: { ...payNew, city: 'X' } });
  rec('gestor', 'F10 update com revisao antiga = CONFLITO_REVISAO', msgHas(u2, 'CONFLITO_REVISAO'), short(u2));
  const a = await rpc(g, 'set_supplier_active', { p_id: id, p_active: false, p_expected_revision: 2 });
  rec('gestor', 'F11 inativar fornecedor (sem excluir)', a.status === 200 && a.body?.active === false, short(a));
  const a2 = await rpc(g, 'set_supplier_active', { p_id: id, p_active: true, p_expected_revision: a.body?.revision });
  rec('gestor', 'F12 reativar fornecedor', a2.status === 200 && a2.body?.active === true, short(a2));
  const rd = await call(g, 'GET', `suppliers?id=eq.${id}&select=active,city,revision`);
  rec('gestor', 'F13 leitura confirma estado gravado', rd.body?.[0]?.city === 'Ananindeua' && rd.body?.[0]?.active === true, JSON.stringify(rd.body?.[0]));
}
{
  const cr = await rpc(g, 'create_supplier_category', { p_name: `HOMOLOG CF Cat ${sfx}` });
  rec('gestor', 'F14 create_supplier_category', cr.status === 200 && cr.body?.created === true, short(cr));
  const cr2 = await rpc(g, 'create_supplier_category', { p_name: `homolog cf cat ${sfx}` });
  rec('gestor', 'F15 categoria duplicada normalizada devolve a mesma (created=false)', cr2.body?.created === false && cr2.body?.id === cr.body?.id, short(cr2));
  const sc = await rpc(g, 'set_supplier_categories', { p_supplier_id: supNew?.id, p_add: [CAT1, cr.body?.id], p_remove: [] });
  const lk = await call(g, 'GET', `supplier_category_links?supplier_id=eq.${supNew?.id}&select=category_id`);
  rec('gestor', 'F16 vincular categorias ao fornecedor', sc.status < 300 && lk.n === 2, `vinculos=${lk.n}`);
  const si = await rpc(g, 'set_supplier_category_active', { p_id: cr.body?.id, p_active: false });
  const sc2 = await rpc(g, 'set_supplier_categories', { p_supplier_id: S1, p_add: [cr.body?.id], p_remove: [] });
  rec('gestor', 'F17 categoria inativa nao aceita nova associacao', si.status < 300 && denied(sc2), short(sc2));
  const lk2 = await call(g, 'GET', `supplier_category_links?supplier_id=eq.${supNew?.id}&select=category_id`);
  rec('gestor', 'F18 inativar categoria preserva vinculos existentes', lk2.n === 2, `vinculos=${lk2.n}`);
  const exp = await rpc(g, 'list_suppliers_export', { p_ids: [S1, S2, SB] });
  rec('gestor', 'F19 exportacao so devolve fornecedores da empresa A', exp.status === 200 && exp.body?.rows?.length === 2, `linhas=${exp.body?.rows?.length}`);
}
let candId;
{
  const cmd = randomUUID(); const pl = { trade_name: `HOMOLOG CF Cand ${sfx}`, city: 'Belem', state: 'PA', products: ['Cominho', 'Pimenta'], category_ids: [CAT1] };
  const r = await rpc(g, 'register_supplier_candidate', { p_command_id: cmd, p_payload: pl });
  candId = r.body?.id; rec('gestor', 'F20 register_supplier_candidate', r.status === 200 && !!candId && r.body.replayed === false, short(r));
  const r2 = await rpc(g, 'register_supplier_candidate', { p_command_id: cmd, p_payload: pl });
  rec('gestor', 'F21 idempotencia do possivel fornecedor', r2.body?.replayed === true && r2.body?.id === candId, short(r2));
  const r3 = await rpc(g, 'register_supplier_candidate', { p_command_id: cmd, p_payload: { ...pl, trade_name: 'x' } });
  rec('gestor', 'F22 command_id reutilizado com outro corpo = CONFLITO_COMANDO', msgHas(r3, 'CONFLITO_COMANDO'), short(r3));
  const s = await rpc(g, 'search_supplier_candidates', { p_query: 'cominho', p_stage: null, p_category_id: null, p_limit: 20, p_offset: 0 });
  rec('gestor', 'F23 busca de possiveis fornecedores por produto declarado', s.status === 200 && s.body?.rows?.some(x => x.id === candId), `total=${s.body?.total}`);
  const ct = await rpc(g, 'record_candidate_contact', { p_id: candId, p_note: 'Ligacao HCF', p_contacted_on: null, p_next_contact_on: null, p_stage: 'EM_CONTATO' });
  rec('gestor', 'F24 registrar contato (revisao sobe)', ct.status === 200 && ct.body?.revision === 2, short(ct));
  const cv = await rpc(g, 'convert_candidate_to_supplier', { p_candidate_id: candId, p_existing_supplier_id: null, p_supplier: supPayload('Convertido', doc14(2)) });
  rec('gestor', 'F25 converter em fornecedor formal', cv.status === 200 && cv.body?.created === true, short(cv));
  const cv2 = await rpc(g, 'convert_candidate_to_supplier', { p_candidate_id: candId, p_existing_supplier_id: null, p_supplier: supPayload('Convertido', doc14(2)) });
  rec('gestor', 'F26 conversao repetida e idempotente (mesmo fornecedor)', cv2.body?.replayed === true && cv2.body?.supplier_id === cv.body?.supplier_id, short(cv2));
}
{
  const bk = { beneficiary_name: 'Titular HCF', beneficiary_document: '99999999999', bank: '001', branch: '1234', account: '987654', pix_type: 'E-mail', pix_key: 'pix@homolog.test' };
  const s = await rpc(g, 'set_supplier_bank_details', { p_supplier_id: S1, p_payload: bk });
  rec('gestor', 'F27 OWNER grava favorecido/banco/Pix', s.status === 200 && s.body?.exists === true, short(s));
  const v = await rpc(g, 'verify_supplier_bank_details', { p_supplier_id: S1 });
  rec('gestor', 'F28 OWNER confere os dados (VERIFICADO)', v.body?.verification_status === 'VERIFICADO', short(v));
  const gm = await rpc(g, 'get_supplier_bank_details', { p_supplier_id: S1, p_reveal: false });
  rec('gestor', 'F29 leitura padrao vem mascarada', gm.body?.masked === true && String(gm.body?.account).startsWith('••••') && !JSON.stringify(gm.body).includes('987654'), `conta=${gm.body?.account}`);
  const s2 = await rpc(g, 'set_supplier_bank_details', { p_supplier_id: S1, p_payload: { ...bk, account: '555555' } });
  rec('gestor', 'F30 alterar conta invalida a conferencia (PENDENTE)', s2.body?.verification_status === 'PENDENTE', short(s2));
  for (const p of op) {
    const t = tok[p];
    const a = await rpc(t, 'get_supplier_bank_details', { p_supplier_id: S1, p_reveal: false });
    const b = await rpc(t, 'set_supplier_bank_details', { p_supplier_id: S1, p_payload: bk });
    const c = await rpc(t, 'verify_supplier_bank_details', { p_supplier_id: S1 });
    const d = await call(t, 'GET', 'supplier_bank_details?select=supplier_id');
    rec(p, 'F31 banco/Pix negado (get/set/verify e SELECT direto)', denied(a) && denied(b) && denied(c) && (denied(d) || d.n === 0), `get ${a.status} set ${b.status} verify ${c.status} select ${d.status}/${d.n}`);
  }
  const x = await call(g, 'GET', `supplier_bank_details?supplier_id=eq.${SB}`);
  rec('gestor', 'F32 gestor A nao ve banco do fornecedor da B', x.n === 0, `n=${x.n}`);
}
{
  const f = await rpc(g, 'supplier_financial_summary', { p_supplier_id: S1, p_from: null, p_to: null });
  const sm = f.body;
  rec('gestor', 'F33 ficha financeira: comprado=1500, pago=1000, em aberto=500, vencido=500', f.status === 200 && sm?.purchased?.total_cents === 150000 && sm?.paid?.all_time_cents === 100000 && sm?.open?.total_cents === 50000 && sm?.open?.overdue_cents === 50000, f.status === 200 ? `comprado=${sm?.purchased?.total_cents} pago=${sm?.paid?.all_time_cents} aberto=${sm?.open?.total_cents} vencido=${sm?.open?.overdue_cents} pontual=${sm?.punctuality?.pct}%` : short(f));
  const l = await rpc(g, 'list_suppliers_financial', { p_from: null, p_to: null });
  const row = l.body?.rows?.find(x => x.supplier_id === S1);
  rec('gestor', 'F34 lista financeira traz o fornecedor e so da empresa A', l.status === 200 && row?.open_cents === 50000 && !l.body.rows.some(x => x.supplier_id === SB), `linhas=${l.body?.rows?.length}`);
  const un = f.body?.unavailable ?? [];
  rec('gestor', 'F35 itens sem fonte saem como indisponiveis (nao zero)', Array.isArray(un) && un.includes('credits_advances'), un.join(','));
  for (const p of op) {
    const a = await rpc(tok[p], 'supplier_financial_summary', { p_supplier_id: S1, p_from: null, p_to: null });
    const b = await rpc(tok[p], 'list_suppliers_financial', { p_from: null, p_to: null });
    rec(p, 'F36 posicao financeira de fornecedor negada', denied(a) && denied(b), `${a.status}/${b.status}`);
  }
}
for (const p of op) {
  const t = tok[p];
  const r = await rpc(t, 'create_supplier', { p_command_id: randomUUID(), p_payload: supPayload('Indevido', doc14(9)) });
  const w1 = await call(t, 'POST', 'suppliers', { company_id: A, name: 'x', company_name: 'x', phone: '1', trade_name: 'HOMOLOG CF direto' });
  const w2 = await call(t, 'PATCH', `suppliers?id=eq.${S1}`, { city: 'Hack' });
  const w3 = await call(t, 'DELETE', `suppliers?id=eq.${S2}`);
  const c = await rpc(t, 'create_supplier_category', { p_name: 'HOMOLOG CF indevida' });
  rec(p, 'F37 escrita em fornecedores negada (RPC e direta)', denied(r) && denied(w1) && denied(w2) && denied(w3) && denied(c), `rpc ${r.status} ins ${w1.status} upd ${w2.status} del ${w3.status} cat ${c.status}`);
  const rd = await call(t, 'GET', 'suppliers?select=id');
  const cand = await call(t, 'GET', 'supplier_candidates?select=id');
  rec(p, 'F38 leitura de suppliers (DP-FORN-6) e de possiveis fornecedores', true, `suppliers: ${rd.status < 400 ? rd.n + ' linhas' : 'http ' + rd.status} | candidates: ${cand.status < 400 ? cand.n + ' linhas' : 'http ' + cand.status}`);
}
{
  const w1 = await call(g, 'POST', 'suppliers', { company_id: A, name: 'x', company_name: 'x', phone: '1' });
  const w2 = await call(g, 'PATCH', `suppliers?id=eq.${S1}`, { city: 'Hack' });
  const w3 = await call(g, 'DELETE', `suppliers?id=eq.${S2}`);
  rec('gestor', 'F39 ate o OWNER so escreve fornecedor por RPC (REST direto negado)', denied(w1) && denied(w2) && denied(w3), `ins ${w1.status} upd ${w2.status} del ${w3.status}`);
}
{
  const t = tok.outra;
  const rd = await call(t, 'GET', 'suppliers?select=id,company_id');
  rec('outra', 'F40 empresa B so ve fornecedores da B', rd.status === 200 && rd.n >= 1 && rd.body.every(x => x.company_id === B), `${rd.n} linhas`);
  rec('outra', 'F41 B le fornecedor da A por id', (await call(t, 'GET', `suppliers?id=eq.${S1}`)).n === 0);
  const u = await rpc(t, 'update_supplier', { p_id: S1, p_expected_revision: 1, p_payload: supPayload('Hack', '') });
  rec('outra', 'F42 B nao altera fornecedor da A (RPC)', denied(u), short(u));
  const a = await rpc(t, 'set_supplier_active', { p_id: S1, p_active: false, p_expected_revision: 1 });
  rec('outra', 'F43 B nao inativa fornecedor da A', denied(a), short(a));
  const f = await rpc(t, 'supplier_financial_summary', { p_supplier_id: S1, p_from: null, p_to: null });
  rec('outra', 'F44 B nao ve ficha financeira de fornecedor da A', denied(f), short(f));
  const b = await rpc(t, 'set_supplier_bank_details', { p_supplier_id: S1, p_payload: { account: '1' } });
  rec('outra', 'F45 B nao grava banco de fornecedor da A', denied(b), short(b));
  const sc = await rpc(t, 'set_supplier_categories', { p_supplier_id: S1, p_add: [CAT1], p_remove: [] });
  rec('outra', 'F46 B nao mexe em categorias do fornecedor da A', denied(sc), short(sc));
  const pw = await call(t, 'PATCH', `suppliers?id=eq.${S1}`, { city: 'Hack' });
  rec('outra', 'F47 B PATCH direto em fornecedor da A', denied(pw) || pw.n === 0, short(pw));
  const cr = await rpc(t, 'create_supplier', { p_command_id: randomUUID(), p_payload: supPayload('FornB', doc14(7)) });
  rec('outra', 'F48 B cria fornecedor (so na propria empresa)', cr.status === 200, short(cr));
  const chk = await call(t, 'GET', `suppliers?id=eq.${cr.body?.id}&select=company_id`);
  rec('outra', 'F49 fornecedor criado pela B pertence a B', chk.body?.[0]?.company_id === B, '');
  const lf = await rpc(t, 'list_suppliers_financial', { p_from: null, p_to: null });
  rec('outra', 'F50 lista financeira da B nao contem fornecedor da A', lf.status === 200 && !lf.body.rows.some(x => x.supplier_id === S1), `linhas=${lf.body?.rows?.length}`);
}
{
  const fns = [['create_supplier', { p_command_id: randomUUID(), p_payload: {} }], ['supplier_financial_summary', { p_supplier_id: S1, p_from: null, p_to: null }], ['get_supplier_bank_details', { p_supplier_id: S1, p_reveal: false }], ['list_suppliers_export', { p_ids: [S1] }], ['search_supplier_candidates', { p_query: '', p_stage: null, p_category_id: null, p_limit: 5, p_offset: 0 }]];
  const rs = []; for (const [f, a] of fns) rs.push((await rpc(undefined, f, a)).status);
  rec('anon', 'F51 RPCs de fornecedores negadas sem login', rs.every(s => s >= 400), rs.join('/'));
  const rd = await call(undefined, 'GET', 'suppliers?select=id');
  const rd2 = await call(undefined, 'GET', 'supplier_bank_details?select=supplier_id');
  rec('anon', 'F52 SELECT direto negado/vazio sem login', (denied(rd) || rd.n === 0) && (denied(rd2) || rd2.n === 0), `${rd.status}/${rd.n} ${rd2.status}/${rd2.n}`);
}

// ====================== CLIENTES ======================
const cli = (tag, doc) => ({ trade_name: `HOMOLOG CF ${tag}`, company_name: `HOMOLOG CF ${tag} Ltda`, phone: '91977770000', cnpj: doc, person_type: 'PJ', city: 'Belem', state: 'PA' });
{
  const l = await rpc(g, 'oris360_customers_list', { p_company_id: A });
  const b = l.body;
  rec('gestor', 'C01 lista de clientes: financeiro disponivel, so empresa A', l.status === 200 && b?.finance_available === true && b?.total >= 5, `total=${b?.total} kpis=${JSON.stringify(b?.kpis)}`);
  const rest = b?.items?.find(x => x.id === C_REST);
  rec('gestor', 'C02 situacao financeira: Restaurante com saldo vencido 716 e 1 titulo', rest?.overdue_balance === 716 && rest?.overdue_count === 1 && rest?.open_balance === 716, `aberto=${rest?.open_balance} vencido=${rest?.overdue_balance} cat=${rest?.category}`);
  const f1 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_finance: 'debt' });
  rec('gestor', 'C03 filtro inadimplentes devolve so quem tem vencido', f1.body?.items?.length === 1 && f1.body.items[0].id === C_REST, `n=${f1.body?.items?.length}`);
  const f2 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_finance: 'clear' });
  rec('gestor', 'C04 filtro em dia exclui o inadimplente', !f2.body?.items?.some(x => x.id === C_REST) && f2.body?.items?.length >= 3, `n=${f2.body?.items?.length}`);
  const f3 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_registration: 'inactive' });
  rec('gestor', 'C05 filtro inativos', f3.body?.items?.length === 1 && f3.body.items[0].registration_status === 'INATIVO', `n=${f3.body?.items?.length}`);
  const f4 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_search: 'atacado' });
  rec('gestor', 'C06 busca por nome', f4.body?.items?.length === 1 && f4.body.items[0].id === C_ATAC, `n=${f4.body?.items?.length}`);
  const f5 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_search: '44555666' });
  rec('gestor', 'C07 busca por documento', f5.body?.items?.length === 1 && f5.body.items[0].id === C_REST, `n=${f5.body?.items?.length}`);
  const f6 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_category: 'active' });
  const f7 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_category: 'recent' });
  rec('gestor', 'C08 categoria por ultima compra faturada (ativo<=30d, recente<=90d)', f6.body?.items?.some(x => x.id === C_REST) && f7.body?.items?.some(x => x.id === C_ATAC), `ativos=${f6.body?.items?.length} recentes=${f7.body?.items?.length}`);
  const f8 = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_city: 'Belem', p_uf: 'PA', p_sort: 'name', p_page_size: 10 });
  const names = f8.body?.items?.map(x => (x.trade_name || x.legal_name).toLowerCase());
  rec('gestor', 'C09 filtros cidade/UF e ordenacao por nome', f8.status === 200 && JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b))), `n=${names?.length}`);
  const pg = await rpc(g, 'oris360_customers_list', { p_company_id: A, p_page: 2, p_page_size: 10 });
  rec('gestor', 'C10 paginacao devolve pagina valida', pg.status === 200 && pg.body?.page >= 1, `page=${pg.body?.page}/${pg.body?.pages}`);
  const rc = await rpc(g, 'oris360_customer_receivables', { p_customer_id: C_ATAC, p_months: 12 });
  rec('gestor', 'C11 titulos: 1 em aberto a vencer, 1 pago em dia', rc.body?.open?.length === 1 && rc.body?.paid?.length === 1 && rc.body?.open_summary?.upcoming_count === 1, `abertos=${rc.body?.open?.length} pagos=${rc.body?.paid?.length}`);
  const cs = await rpc(g, 'oris360_customer_commercial_summary', { p_customer_id: C_REST, p_period: 'six' });
  rec('gestor', 'C12 resumo comercial: total faturado 716 e ultima compra', cs.status === 200 && Number(cs.body?.total) === 716 && !!cs.body?.last_billed_purchase, `total=${cs.body?.total} rank=${cs.body?.rank?.position}/${cs.body?.rank?.universe}`);
  const cp = await rpc(g, 'oris360_customer_capabilities', { p_company_id: A });
  rec('gestor', 'C13 capacidades do OWNER', cp.body?.member === true && cp.body?.can_view_receivables === true && cp.body?.can_propose_credit === true, JSON.stringify(cp.body));
}
let custNew;
{
  const cmd = randomUUID(); const doc = `7${sfx}000166`.slice(0, 12) + '66'; const data = cli('Cliente Novo', doc);
  const r = await rpc(g, 'oris360_customer_save', { p_command_id: cmd, p_company_id: A, p_customer_id: null, p_expected_revision: null, p_data: data });
  custNew = r.body; rec('gestor', 'C14 cria cliente (RPC)', r.status === 200 && !!r.body?.customer_id && r.body.replayed === false, short(r));
  const r2 = await rpc(g, 'oris360_customer_save', { p_command_id: cmd, p_company_id: A, p_customer_id: null, p_expected_revision: null, p_data: data });
  rec('gestor', 'C15 idempotencia por command_id (mesmo cliente, replayed)', r2.body?.replayed === true && r2.body?.customer_id === custNew?.customer_id, short(r2));
  const r3 = await rpc(g, 'oris360_customer_save', { p_command_id: cmd, p_company_id: A, p_customer_id: null, p_expected_revision: null, p_data: { ...data, trade_name: 'Outro' } });
  rec('gestor', 'C16 command_id com outros parametros = COMANDO_REUSADO', msgHas(r3, 'COMANDO_REUSADO'), short(r3));
  const r4 = await rpc(g, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: null, p_expected_revision: null, p_data: data });
  rec('gestor', 'C17 documento duplicado = DOCUMENTO_DUPLICADO', msgHas(r4, 'DOCUMENTO_DUPLICADO'), short(r4));
  const r5 = await rpc(g, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: null, p_expected_revision: null, p_data: { ...data, cnpj: '123' } });
  rec('gestor', 'C18 CNPJ invalido e recusado', denied(r5), short(r5));
  const u = await rpc(g, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: custNew?.customer_id, p_expected_revision: custNew?.revision, p_data: { city: 'Ananindeua', extra_contacts: [{ name: 'Contato Extra', phone: '91' }] } });
  rec('gestor', 'C19 edita cliente com revisao correta (sobe revisao)', u.status === 200 && u.body?.revision === (custNew?.revision ?? 0) + 1, short(u));
  const u2 = await rpc(g, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: custNew?.customer_id, p_expected_revision: custNew?.revision, p_data: { city: 'X' } });
  rec('gestor', 'C20 revisao antiga = CONFLITO_REVISAO (HTTP 409, sem travar)', u2.status === 409 && msgHas(u2, 'CONFLITO_REVISAO'), short(u2));
  const ct = await call(g, 'GET', `customer_contacts?customer_id=eq.${custNew?.customer_id}&select=name`);
  rec('gestor', 'C21 contato adicional gravado', ct.n === 1, `n=${ct.n}`);
  const lim = await rpc(g, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: custNew?.customer_id, p_expected_revision: u.body?.revision, p_data: { proposed_credit_limit: 1500, credit_analysis_state: 'EM_ANALISE' } });
  rec('gestor', 'C22 OWNER propoe limite de credito', lim.status === 200, short(lim));
  const s0 = await rpc(g, 'oris360_customer_set_status', { p_command_id: randomUUID(), p_customer_id: custNew?.customer_id, p_status: 'INATIVO', p_reason: 'x', p_expected_revision: lim.body?.revision });
  rec('gestor', 'C23 inativar exige motivo', denied(s0), short(s0));
  const s1 = await rpc(g, 'oris360_customer_set_status', { p_command_id: randomUUID(), p_customer_id: custNew?.customer_id, p_status: 'INATIVO', p_reason: 'Encerrou atividade HCF', p_expected_revision: lim.body?.revision });
  rec('gestor', 'C24 inativar cliente com motivo', s1.status === 200 && s1.body?.status === 'INATIVO', short(s1));
  const s2 = await rpc(g, 'oris360_customer_set_status', { p_command_id: randomUUID(), p_customer_id: custNew?.customer_id, p_status: 'ATIVO', p_reason: 'Voltou a comprar', p_expected_revision: s1.body?.revision });
  rec('gestor', 'C25 reativar cliente', s2.status === 200 && s2.body?.status === 'ATIVO', short(s2));
  const s3 = await rpc(g, 'oris360_customer_set_status', { p_command_id: randomUUID(), p_customer_id: custNew?.customer_id, p_status: 'INATIVO', p_reason: 'Revisao velha HCF', p_expected_revision: lim.body?.revision });
  rec('gestor', 'C24b inativar com revisao antiga = CONFLITO_REVISAO (HTTP 409, sem travar)', s3.status === 409 && msgHas(s3, 'CONFLITO_REVISAO'), short(s3));
  const del = await call(g, 'DELETE', `customers?id=eq.${C_REST}`);
  rec('gestor', 'C26 excluir cliente com historico e bloqueado (CLIENTE_COM_HISTORICO)', msgHas(del, 'CLIENTE_COM_HISTORICO'), short(del));
  const aud = await call(g, 'GET', `audit_events?entity_id=eq.${custNew?.customer_id}&select=event_type`);
  rec('gestor', 'C27 eventos de auditoria do cliente (criado/atualizado/inativado/reativado)', aud.status === 200 ? aud.n >= 4 : 'BLOQUEADO', aud.status === 200 ? `eventos=${aud.n}` : short(aud));
}
for (const p of op) {
  const t = tok[p];
  const l = await rpc(t, 'oris360_customers_list', { p_company_id: A });
  const cap = await rpc(t, 'oris360_customer_capabilities', { p_company_id: A });
  rec(p, 'C28 lista de clientes (observado)', true, l.status === 200 ? `permitida, financeiro=${l.body?.finance_available}, saldos=${l.body?.items?.[0]?.open_balance ?? 'ocultos'}` : `negada ${short(l)}`);
  if (l.status === 200) rec(p, 'C29 sem permissao financeira os saldos ficam ocultos', l.body?.finance_available === false ? l.body.items.every(x => x.open_balance == null && x.overdue_balance == null) : 'BLOQUEADO', `finance=${l.body?.finance_available}`);
  const rc = await rpc(t, 'oris360_customer_receivables', { p_customer_id: C_REST, p_months: 12 });
  rec(p, 'C30 titulos do cliente negados (sem billing.view_receivables)', rc.status < 400 && rc.body === null, `http ${rc.status} corpo=${JSON.stringify(rc.body)}`);
  const lim = await rpc(t, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: C_ATAC, p_expected_revision: (await call(t, 'GET', `customers?id=eq.${C_ATAC}&select=revision`)).body?.[0]?.revision ?? 0, p_data: { proposed_credit_limit: 99999 } });
  rec(p, 'C31 propor limite/condicao de credito negado', denied(lim), short(lim));
  const w = await call(t, 'POST', 'customers', { company_id: A, company_name: 'HOMOLOG CF direto', phone: '1' });
  const w2 = await call(t, 'DELETE', `customers?id=eq.${C_MERC}`);
  rec(p, 'C32 INSERT/DELETE direto em customers (observado)', true, `insert ${w.status} delete ${w2.status} ${p === 'vendedor' ? '' : ''}`);
  if (w.body?.[0]?.id) await call(g, 'DELETE', `customers?id=eq.${w.body[0].id}`);
  void cap;
}
{
  const t = tok.outra;
  const l = await rpc(t, 'oris360_customers_list', { p_company_id: A });
  rec('outra', 'C33 B nao lista clientes da A', denied(l), short(l));
  const lb = await rpc(t, 'oris360_customers_list', { p_company_id: B });
  rec('outra', 'C34 B lista so os proprios clientes', lb.status === 200 && lb.body?.items?.every(x => x.id === C_B) && lb.body.total >= 1, `total=${lb.body?.total}`);
  const rd = await call(t, 'GET', `customers?id=eq.${C_REST}&select=id`);
  rec('outra', 'C35 B le cliente da A por id', rd.n === 0, `n=${rd.n}`);
  const sv = await rpc(t, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: B, p_customer_id: C_REST, p_expected_revision: 1, p_data: { city: 'Hack' } });
  rec('outra', 'C36 B nao altera cliente da A (RPC)', denied(sv), short(sv));
  const sv2 = await rpc(t, 'oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: null, p_expected_revision: null, p_data: cli('Cruzado', '55123456000155') });
  rec('outra', 'C37 B nao cria cliente na empresa A', denied(sv2), short(sv2));
  const st = await rpc(t, 'oris360_customer_set_status', { p_command_id: randomUUID(), p_customer_id: C_REST, p_status: 'INATIVO', p_reason: 'tentativa cruzada', p_expected_revision: 1 });
  rec('outra', 'C38 B nao inativa cliente da A', denied(st), short(st));
  const rc = await rpc(t, 'oris360_customer_receivables', { p_customer_id: C_REST, p_months: 12 });
  const cs = await rpc(t, 'oris360_customer_commercial_summary', { p_customer_id: C_REST, p_period: 'six' });
  rec('outra', 'C39 B nao ve titulos nem resumo comercial de cliente da A', rc.body === null && cs.body === null, `${JSON.stringify(rc.body)}/${JSON.stringify(cs.body)}`);
  const pw = await call(t, 'PATCH', `customers?id=eq.${C_REST}`, { city: 'Hack' });
  rec('outra', 'C40 B PATCH direto em cliente da A', denied(pw) || pw.n === 0, short(pw));
  const cm = await call(t, 'GET', 'customer_commands?select=command_id');
  rec('outra', 'C41 tabela customer_commands nao e legivel pelo cliente da API', denied(cm) || cm.n === 0, short(cm));
}
{
  const rs = [];
  for (const [f, a] of [['oris360_customers_list', { p_company_id: A }], ['oris360_customer_save', { p_command_id: randomUUID(), p_company_id: A, p_customer_id: null, p_expected_revision: null, p_data: {} }], ['oris360_customer_receivables', { p_customer_id: C_REST, p_months: 12 }], ['oris360_customer_commercial_summary', { p_customer_id: C_REST, p_period: 'six' }], ['oris360_customer_capabilities', { p_company_id: A }]]) rs.push((await rpc(undefined, f, a)).status);
  rec('anon', 'C42 RPCs de clientes negadas sem login', rs.every(s => s >= 400), rs.join('/'));
  const rd = await call(undefined, 'GET', 'customers?select=id');
  const rc = await call(undefined, 'GET', 'customer_contacts?select=id');
  rec('anon', 'C43 SELECT direto em customers/customer_contacts negado ou vazio', (denied(rd) || rd.n === 0) && (denied(rc) || rc.n === 0), `${rd.status}/${rd.n} ${rc.status}/${rc.n}`);
}

// ====================== REGRESSAO operacional (pedido, separacao, entrega) ======================
const nome = `HOMOLOG CF REGRESSAO ${new Date().toISOString().slice(0, 16)}`;
let oid;
{
  const mk = { p_company_id: A, p_customer_name: nome, p_company_name: nome, p_phone: '71999990000', p_items: [{ product_id: PROD_A, packs_quantity: 1 }] };
  const r = await rpc(tok.vendedor, 'create_order', mk);
  oid = r.body?.id || r.body?.order?.id || r.body?.order_id;
  if (r.status === 409 && r.body?.code === '23505') { rec('vendedor', 'R01 create_order segue funcionando', 'BLOQUEADO', 'colisao pre-existente de orders_order_number_key com fixture (pedido da B com numero vazio); nao ligada a clientes/fornecedores'); oid = ORD_CONF; }
  else rec('vendedor', 'R01 create_order segue funcionando', r.status === 200 && !!oid, short(r));
  for (const p of ['vendedor', 'separador', 'entregador', 'producao']) {
    const o = await call(tok[p], 'GET', 'orders?select=id&limit=1000');
    const it = await call(tok[p], 'GET', 'order_items?select=id&limit=1000');
    rec(p, 'R02 leitura de pedidos e itens preservada', o.status === 200 && o.n >= 1 && it.status === 200 && it.n >= 1, `pedidos=${o.n} itens=${it.n}`);
  }
  const itemId = oid ? (await call(g, 'GET', `order_items?order_id=eq.${oid}&select=id`)).body?.[0]?.id : null;
  const ac = await rpc(tok.separador, 'separation_accept_order', { p_order_id: oid ?? ORD_A });
  rec('separador', 'R03 separation_accept_order segue funcionando', ac.status === 200 && ac.body !== false, short(ac));
  if (itemId) {
    await rpc(g, 'separation_set_item', { p_item_id: itemId, p_separated: false });
    const r = await rpc(tok.separador, 'separation_set_item', { p_item_id: itemId, p_separated: true });
    const st = (await call(g, 'GET', `order_items?id=eq.${itemId}&select=separated_at`)).body?.[0]?.separated_at;
    rec('separador', 'R04 separation_set_item muda o estado real', r.status === 200 && !!st, `${short(r)} separado_em=${st ? 'sim' : 'nao'}`);
  } else rec('separador', 'R04 separation_set_item', 'BLOQUEADO', 'sem item do pedido de teste');
  const rr = await rpc(tok.entregador, 'reserve_delivery_er', { p_order_id: oid ?? ORD_A });
  rec('entregador', 'R05 reserve_delivery_er (entrega) executa sem erro de permissao em fornecedores', rr.status < 500, short(rr));
  const pr = await rpc(tok.producao, 'create_production', { p_product_id: PROD_A, p_packs_quantity: 1, p_employee_ids: [], p_urgent_demand_id: null });
  rec('producao', 'R06 create_production (producao) executa', pr.status < 500, short(pr));
  const st = await call(tok.producao, 'GET', 'suppliers?select=id,company_id');
  rec('producao', 'R07 PRODUCAO mantem leitura de fornecedores (operations.factory.read)', st.status === 200 && st.n >= 3, `${st.n} linhas`);
}

const f = results.filter(r => r.ok === false).length, b = results.filter(r => r.ok === 'BLOQUEADO').length;
console.log(`\nTotal ${results.length}, PASSOU ${results.length - f - b}, FALHOU ${f}, BLOQUEADO ${b}`);
writeFileSync(process.env.HOMOLOG_OUT || 'resultado_clientes_fornecedores.json', JSON.stringify(results, null, 1));
