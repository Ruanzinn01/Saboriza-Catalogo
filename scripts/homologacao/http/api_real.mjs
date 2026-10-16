// Teste por API real (GoTrue + PostgREST + RPC) na homologacao. Uso: HOMOLOG_URL=... HOMOLOG_KEY=... node api_real.mjs
// Senha lida de C:\Users\rruan\homolog-credenciais.txt apenas em memoria. Nada sensivel e impresso.
import { readFileSync, writeFileSync } from 'node:fs';

const URL_ = process.env.HOMOLOG_URL, KEY = process.env.HOMOLOG_KEY;
if (!URL_ || !KEY || !/dfynvpieyvvameftrent/.test(URL_)) { console.error('Env ausente ou URL nao e a homologacao'); process.exit(2); }
const A = '0825487f-cff0-42cc-9442-d95ff552f75f', B = '02854143-5225-4362-b5c3-130729a7f707';
const ORD_B = '022c045e-f0e0-4566-a008-6948a0373dcc', ITEM_B = 'ca1fed73-1722-4e64-b50d-fb9345b11ef8';
const PROD_B = '4909430e-258f-4398-81d0-1323bce1610e';
const ORD_A = '2a645def-f242-4202-9113-18af6b6df969', ITEM_A = 'a5a747c6-8a18-4ec3-ad33-38b493a5b395';
const ORD_A_CANC = '795ac2fc-cfcc-42f4-afcf-1cd0d3d3c605', PROD_A = '29fd81f4-f137-4d9a-bbcd-418ee7c00fab';
const FILIAL = '8e91f8bf-6764-4b74-85c9-4a7938ccd955';

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
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { apikey: KEY, authorization: `Bearer ${tk ?? KEY}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j, n: Array.isArray(j) ? j.length : null };
};
const rpc = (tk, fn, args) => call(tk, 'POST', `rpc/${fn}`, args);
const blocked = r => r.status >= 400 || r.n === 0 || r.body === false;
const fixture = r => r.status === 409 && r.body?.code === '23505';
const recRpc = (p, caso, r, esperaBloq) => {
  if (fixture(r)) return rec(p, caso, 'BLOQUEADO', 'pedido B de fixture com order_number vazio colide (23505)');
  rec(p, caso, esperaBloq ? blocked(r) : (r.status === 200 && r.body !== false), `http ${r.status} corpo=${typeof r.body === 'boolean' ? r.body : '-'}`);
};

const perfis = { gestor: 'gestor', vendedor: 'vendedor', separador: 'separador', entregador: 'entregador', producao: 'producao', outra: 'outra-empresa', unidade: 'rot-unidade' };
const tok = {};
for (const [p, u] of Object.entries(perfis)) {
  const r = await login(`${u}@homolog.test`); tok[p] = r.token;
  rec(p, 'login GoTrue por senha', r.status === 200 && !!r.token ? true : (p === 'unidade' ? 'BLOQUEADO' : false), `http ${r.status}`);
}
if (!tok.gestor) { console.error('Sem login do gestor; abortando'); process.exit(1); }

const leituras = ['orders', 'order_items', 'customers', 'products', 'stock_movements', 'inventory_sessions', 'raw_materials'];
const cont = {};
for (const p of Object.keys(perfis)) {
  if (!tok[p]) continue; cont[p] = {};
  for (const t of leituras) {
    const r = await call(tok[p], 'GET', `${t}?select=company_id&limit=1000`);
    if (r.status >= 400) { cont[p][t] = `http${r.status}`; rec(p, `leitura ${t}`, true, `negada (http ${r.status})`); continue; }
    const a = r.body.filter(x => x.company_id === A).length, b = r.body.filter(x => x.company_id === B).length;
    cont[p][t] = `${a}A/${b}B`;
    rec(p, `leitura ${t} isolada`, p === 'outra' ? a === 0 : b === 0, `${a}A/${b}B`);
  }
}

for (const p of ['gestor', 'vendedor', 'separador', 'entregador', 'producao']) {
  const t = tok[p]; if (!t) continue;
  rec(p, 'A le pedido da B por id', (await call(t, 'GET', `orders?id=eq.${ORD_B}`)).n === 0);
  rec(p, 'A UPDATE pedido da B', blocked(await call(t, 'PATCH', `orders?id=eq.${ORD_B}`, { status: 'NEW' })));
  rec(p, 'A DELETE item da B', blocked(await call(t, 'DELETE', `order_items?id=eq.${ITEM_B}`)));
  const ins = await call(t, 'POST', 'customers', { company_id: B, company_name: 'HOMOLOG API cruzado', phone: '000' });
  rec(p, 'A INSERT cliente na B', ins.status >= 400 || !ins.body?.length);
  if (ins.body?.[0]?.id) await call(tok.outra, 'DELETE', `customers?id=eq.${ins.body[0].id}`);
}
{
  const t = tok.outra;
  rec('outra', 'B le pedido da A por id', (await call(t, 'GET', `orders?id=eq.${ORD_A}`)).n === 0);
  rec('outra', 'B UPDATE pedido da A', blocked(await call(t, 'PATCH', `orders?id=eq.${ORD_A}`, { status: 'NEW' })));
  rec('outra', 'B DELETE item da A', blocked(await call(t, 'DELETE', `order_items?id=eq.${ITEM_A}`)));
  const ins = await call(t, 'POST', 'customers', { company_id: A, company_name: 'HOMOLOG API cruzado', phone: '000' });
  rec('outra', 'B INSERT cliente na A', ins.status >= 400 || !ins.body?.length);
  if (ins.body?.[0]?.id) await call(tok.gestor, 'DELETE', `customers?id=eq.${ins.body[0].id}`);
}

const g = await call(tok.gestor, 'GET', `products?id=eq.${PROD_A}&select=unit_price`);
const prodPatch = g.body?.[0] ? { unit_price: g.body[0].unit_price } : null;
for (const p of ['separador', 'entregador', 'producao']) {
  const t = tok[p]; if (!t) continue;
  const ip = await call(t, 'POST', 'products', { company_id: A, name: 'HOMOLOG API indevido', unit_price: 1 });
  rec(p, 'INSERT produto', ip.status >= 400 || !ip.body?.length);
  if (ip.body?.[0]?.id) await call(tok.gestor, 'DELETE', `products?id=eq.${ip.body[0].id}`);
  if (prodPatch) {
    const novoPreco = Number(prodPatch.unit_price) + 0.01;
    const u = await call(t, 'PATCH', `products?id=eq.${PROD_A}`, { unit_price: novoPreco });
    const efetivo = u.status < 400 && u.n > 0 && Number(u.body[0].unit_price) === Number(novoPreco.toFixed(2));
    if (efetivo) await call(tok.gestor, 'PATCH', `products?id=eq.${PROD_A}`, prodPatch);
    rec(p, 'UPDATE preco produto (mudanca real, revertida)', !efetivo, `http ${u.status} linhas=${u.n}`);
  }
  const ic = await call(t, 'POST', 'customers', { company_id: A, company_name: 'HOMOLOG API indevido', phone: '000' });
  rec(p, 'INSERT cliente', ic.status >= 400 || !ic.body?.length);
  if (ic.body?.[0]?.id) await call(tok.gestor, 'DELETE', `customers?id=eq.${ic.body[0].id}`);
  if (p !== 'separador') rec(p, 'UPDATE pedido', blocked(await call(t, 'PATCH', `orders?id=eq.${ORD_A_CANC}`, { status: 'CANCELLED' })));
  rec(p, 'DELETE pedido', blocked(await call(t, 'DELETE', `orders?id=eq.${ORD_A_CANC}`)));
}

const nome = `HOMOLOG API TESTE ${new Date().toISOString().slice(0, 16)}`;
const mk = (company, prod) => ({ p_company_id: company, p_customer_name: nome, p_company_name: nome, p_phone: '71999990000', p_items: [{ product_id: prod, packs_quantity: 1 }] });
let novo;
{
  const r = await rpc(tok.vendedor, 'create_order', mk(A, PROD_A));
  novo = r.body; recRpc('vendedor', 'RPC create_order empresa A', r, false);
  recRpc('vendedor', 'create_order na B com produto da A', await rpc(tok.vendedor, 'create_order', mk(B, PROD_A)), true);
  recRpc('vendedor', 'create_order na A com produto da B', await rpc(tok.vendedor, 'create_order', mk(A, PROD_B)), true);
  recRpc('anon', 'create_order sem login (vitrine publica, informativo)', await rpc(undefined, 'create_order', mk(A, PROD_A)), false);
  recRpc('outra', 'create_order logado da B na empresa A (vitrine, informativo)', await rpc(tok.outra, 'create_order', mk(A, PROD_A)), false);
}
const oid = (novo && (novo.id || novo.order?.id || novo.order_id)) || null;
const itemNovo = oid ? (await call(tok.gestor, 'GET', `order_items?order_id=eq.${oid}&select=id`)).body?.[0]?.id : ITEM_A;
await rpc(tok.gestor, 'separation_set_item', { p_item_id: itemNovo, p_separated: false });
{ const ac = await rpc(tok.separador, 'separation_accept_order', { p_order_id: oid ?? ORD_A });
  rec('separador', 'RPC separation_accept_order (permitido)', ac.status === 200 && ac.body !== false, `http ${ac.status} corpo=${typeof ac.body === 'boolean' ? ac.body : '-'}`); }
for (const [p, esperaOk] of [['separador', true], ['entregador', false], ['producao', false], ['outra', false]]) {
  const estado = async () => (await call(tok.gestor, 'GET', `order_items?id=eq.${itemNovo}&select=separated_at`)).body?.[0]?.separated_at != null;
  const antes = await estado();
  const r = await rpc(tok[p], 'separation_set_item', { p_item_id: itemNovo, p_separated: !antes });
  const depois = await estado();
  const mudou = antes !== depois;
  rec(p, `RPC separation_set_item (${esperaOk ? 'permitido' : 'indevido'}) muda estado real`, esperaOk ? mudou : !mudou, `http ${r.status} corpo=${typeof r.body === 'boolean' ? r.body : '-'} separado ${antes}->${depois}`);
  if (mudou) await rpc(tok.gestor, 'separation_set_item', { p_item_id: itemNovo, p_separated: antes });
}
{
  recRpc('separador', 'separation_set_item em item da B', await rpc(tok.separador, 'separation_set_item', { p_item_id: ITEM_B, p_separated: true }), true);
  recRpc('separador', 'separation_accept_order em pedido da B', await rpc(tok.separador, 'separation_accept_order', { p_order_id: ORD_B }), true);
}
for (const p of ['separador', 'producao', 'outra']) {
  const r = await rpc(tok[p], 'reserve_delivery_er', { p_order_id: oid ?? ORD_A });
  rec(p, 'RPC reserve_delivery_er indevido', r.status >= 400, `http ${r.status}`);
}
{
  const r = await rpc(tok.entregador, 'reserve_delivery_er', { p_order_id: ORD_B });
  rec('entregador', 'reserve_delivery_er em pedido da B', r.status >= 400, `http ${r.status}`);
  const f = await rpc(tok.entregador, 'finalize_delivery', { p_order_id: ORD_B, p_er_code: 'x', p_result: 'DELIVERED', p_receiver_name: 'x', p_doc_type: 'CPF', p_doc: '0', p_role: 'x', p_notes: '', p_signature_path: '', p_pdf_path: '', p_items: [] });
  rec('entregador', 'finalize_delivery em pedido da B', f.status >= 400, `http ${f.status}`);
}
for (const p of ['entregador', 'separador', 'outra']) {
  recRpc(p, 'RPC create_production indevido', await rpc(tok[p], 'create_production', { p_product_id: PROD_A, p_packs_quantity: 1, p_employee_ids: [], p_urgent_demand_id: null }), true);
}
{
  recRpc('producao', 'create_production com produto da B', await rpc(tok.producao, 'create_production', { p_product_id: PROD_B, p_packs_quantity: 1, p_employee_ids: [], p_urgent_demand_id: null }), true);
}
for (const p of ['gestor', 'separador', 'entregador', 'outra']) {
  const r = await rpc(tok[p], 'inventory_list_sessions', {});
  const s = JSON.stringify(r.body ?? '');
  rec(p, 'RPC inventory_list_sessions sem dado da outra empresa', r.status >= 400 || !s.includes(p === 'outra' ? A : B), `http ${r.status}`);
}

if (!tok.unidade) rec('unidade', 'achado 1: UNIT_LIST (so Matriz) nao le Filial', 'BLOQUEADO', 'sem senha conhecida para rot-unidade@ (login 400); achado 1 segue so com a prova SQL');
else {
  const tabs = ['audit_events', 'employees', 'separation_jobs', 'stock_movements', 'production_records', 'stock_returns', 'urgent_demands', 'loading_jobs'];
  const gaps = [];
  for (const t of tabs) {
    const r = await call(tok.unidade, 'GET', `${t}?select=unit_id&unit_id=eq.${FILIAL}&limit=5`);
    if (r.status < 400 && r.n > 0) gaps.push(t);
  }
  rec('unidade', 'achado 1: UNIT_LIST (so Matriz) nao le Filial', gaps.length === 0, gaps.length ? `LE a Filial em: ${gaps.join(',')}` : 'sem vazamento nas tabelas testadas');
}
{
  const o = await call(tok.entregador, 'GET', 'orders?select=id&limit=1000'), it = await call(tok.entregador, 'GET', 'order_items?select=id&limit=1000');
  rec('entregador', 'achado 2: entregador so ve pedidos atribuidos', false, `ve ${o.n} pedidos e ${it.n} itens da empresa A, sem atribuicao (confirma achado)`);
}

const f = results.filter(r => r.ok === false).length, b = results.filter(r => r.ok === 'BLOQUEADO').length;
console.log(`\nTotal ${results.length}, PASSOU ${results.length - f - b}, FALHOU ${f}, BLOQUEADO ${b}`);
writeFileSync(process.env.HOMOLOG_OUT || 'resultado.json', JSON.stringify({ results, cont }, null, 1));
