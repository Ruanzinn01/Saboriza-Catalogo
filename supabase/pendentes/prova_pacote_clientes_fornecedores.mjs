// Prova do pacote mínimo Clientes V1 + Fornecedores V1 em PGlite (NÃO é homologação).
// Uso: PGLITE_DIR=<pasta> node supabase/pendentes/prova_pacote_clientes_fornecedores.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const P = (f) => fs.readFileSync(path.join(repo, "supabase/pendentes", f), "utf8");
const ORDEM = [
  "20261015120000_credito_cliente_fonte_unica.sql",
  "20261016100000_fornecedores_v1_categorias_possiveis.sql",
  "20261016140000_clientes_v1_mestre.sql",
  "20261016141000_fornecedores_v1_mestre_complemento.sql",
  "20261016142000_clientes_v1_fix_conflito_revisao_errcode.sql",
];
const REV = {
  "20261016141000_fornecedores_v1_mestre_complemento.sql": "20261016141000_fornecedores_v1_mestre_complemento_REVERSAO.sql",
  "20261016140000_clientes_v1_mestre.sql": "20261016140000_clientes_v1_mestre_REVERSAO.sql",
  "20261016100000_fornecedores_v1_categorias_possiveis.sql": "20261016100000_fornecedores_v1_categorias_possiveis_REVERSAO.sql",
};
let falhas = 0;
const ok = (n, c, d = "") => { if (!c) falhas++; console.log(`${c ? "[OK]   " : "[FALHA]"} ${n}${d ? " -> " + d : ""}`); };
const tenta = async (db, f) => { try { await db.exec(P(f)); return null; } catch (e) { return e.message; } };
const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const sementeProd = `
 insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a');
 insert into public.customers (company_id, name, company_name, phone) values ('${A}','Cli1','Cli1 Ltda','7191'),('${A}','Cli2','Cli2 Ltda','7192');
 insert into public.suppliers (company_id, name, company_name, phone) values ('${A}','Forn1','Forn1 Ltda','7193'),('${A}','Forn2','Forn2 Ltda','7194');`;
const fresh = async () => { const db = await criarBanco(); const f = await reaplicar(db, null, () => {}); if (f.length) throw new Error("trilha falhou " + f[0].file); await db.exec(sementeProd); return db; };
const cnt = async (db) => (await db.query("select (select count(*) from customers)::int c,(select count(*) from suppliers)::int s")).rows[0];

let db = await fresh();
let e = await tenta(db, ORDEM[2]);
const objs = (await db.query("select to_regclass('public.receivable_payments') is not null as rp, to_regprocedure('private.company_today(uuid)') is not null as ct")).rows[0];
ok("Clientes V1 SEM crédito: cria (plpgsql é late-bound) mas referencia objetos inexistentes", !e && !objs.rp && !objs.ct, `receivable_payments=${objs.rp} company_today=${objs.ct}`);
await db.close();

db = await fresh();
e = await tenta(db, ORDEM[1]); const e2 = e ?? (await tenta(db, ORDEM[3]));
ok("Fornecedores (100000+141000) aplicam SEM crédito", !e2, e2 || "ok");
await db.close();

db = await fresh();
const antes = await cnt(db);
for (const f of ORDEM) { const er = await tenta(db, f); ok(`aplicar ${f}`, !er, er || ""); if (er) break; }
const depois = await cnt(db);
ok("dados legados preservados", antes.c === depois.c && antes.s === depois.s, JSON.stringify(depois));
const reap = [];
for (const f of ORDEM) reap.push([f, await tenta(db, f)]);
for (const [f, er] of reap) console.log(`[--]    reaplicar ${f}: ${er ? "falha fechada (" + er.slice(0, 60) + ")" : "sem erro (create or replace)"}`);
const posReap = await cnt(db);
ok("reaplicar a ordem não altera dados (falha antes de gravar)", posReap.c === antes.c && posReap.s === antes.s, JSON.stringify(posReap));
await db.close();

db = await fresh();
for (const f of ORDEM) await tenta(db, f);
for (const f of [...ORDEM].reverse()) {
  const r = REV[f];
  if (!r) { console.log(`[--]    sem arquivo de reversão: ${f}`); continue; }
  const er = await tenta(db, r); ok(`reverter ${r}`, !er, er || "");
}
const fim = await cnt(db);
ok("dados preservados após reversões", fim.c === antes.c && fim.s === antes.s, JSON.stringify(fim));
await db.close();
const U = { gest: "00000000-0000-0000-0000-0000000000a1", semperm: "00000000-0000-0000-0000-0000000000a2" };
async function como(db, uid, role, s) {
  await db.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, role }) : ""}', false); set role ${role};`);
  try { return { ok: true, rows: (await db.query(s)).rows }; } catch (e) { return { ok: false, msg: e.message }; } finally { await db.exec("reset role;"); }
}
async function fluxos(db, rotulo) {
  const R = {};
  await db.exec(`insert into auth.users (id) values ('${U.gest}'),('${U.semperm}') on conflict do nothing;
    insert into public.roles (id, company_id, key, name) values ('dddddddd-0000-0000-0000-000000000001','${A}','g${rotulo}','g'),('dddddddd-0000-0000-0000-000000000002','${A}','s${rotulo}','s');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${A}','dddddddd-0000-0000-0000-000000000001', key from public.permissions where key in ('despesas.read','despesas.manage');
    insert into public.memberships (id, company_id, user_id, status) values ('eeeeeeee-0000-0000-0000-000000000001','${A}','${U.gest}','ACTIVE'),('eeeeeeee-0000-0000-0000-000000000002','${A}','${U.semperm}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${A}','eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001'),('${A}','eeeeeeee-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000002');`);
  const cat = (await db.query(`insert into public.categories (company_id, name, slug) values ('${A}','C','c') returning id`)).rows[0].id;
  const prod = (await db.query(`insert into public.products (company_id, category_id, name, presentation, weight_volume, unit_price, pack_quantity, packaging_type) values ('${A}','${cat}','P','x','1kg',10,1,'Caixa') returning id`)).rows[0].id;
  const itens = JSON.stringify([{ product_id: prod, packs_quantity: 2 }]);
  const cid = (await db.query(`select id from public.customers where name='Cli1'`)).rows[0].id;
  const marca = (r) => (r.ok ? "ok" : r.msg.slice(0, 70));
  R.pedido_vitrine_cliente_novo = marca(await como(db, null, "anon", `select public.create_order('${A}','Novo Cliente','Novo Ltda','71999990001','${itens}'::jsonb) as r`));
  R.pedido_vitrine_cliente_existente = marca(await como(db, null, "anon", `select public.create_order('${A}','Cli1','Cli1 Ltda','7191','${itens}'::jsonb,'','','','','','','','','','','${cid}') as r`));
  R.cadastro_rapido_cliente_direto = marca(await como(db, U.gest, "authenticated", `insert into public.customers (company_id, name, company_name, phone) values ('${A}','Rapido','Rapido Ltda','7195')`));
  R.update_cliente_direto = marca(await como(db, U.gest, "authenticated", `update public.customers set phone='7196' where name='Rapido'`));
  R.delete_cliente_sem_historico = marca(await como(db, U.gest, "authenticated", `delete from public.customers where name='Rapido'`));
  let r = await como(db, U.gest, "authenticated", `select count(*)::int n from public.suppliers`);
  R.leitura_fornecedores_com_despesas_read = r.ok ? "n=" + r.rows[0].n : r.msg;
  r = await como(db, U.semperm, "authenticated", `select count(*)::int n from public.suppliers`);
  R.leitura_fornecedores_membro_sem_permissao = r.ok ? "n=" + r.rows[0].n : r.msg;
  R.insert_fornecedor_direto = marca(await como(db, U.gest, "authenticated", `insert into public.suppliers (company_id, name, company_name, phone) values ('${A}','Direto','D Ltda','7197')`));
  R.update_fornecedor_direto = marca(await como(db, U.gest, "authenticated", `update public.suppliers set phone='1' where name='Forn1'`));
  return R;
}
db = await fresh();
const antesF = await fluxos(db, "a");
await db.close();
db = await fresh();
for (const f of ORDEM) await tenta(db, f);
const depoisF = await fluxos(db, "d");
await db.close();
for (const k of Object.keys(antesF)) console.log(`[${antesF[k] === depoisF[k] ? "IGUAL" : "MUDA "}] ${k}: antes=${antesF[k]} | depois=${depoisF[k]}`);
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODAS AS PROVAS OK");
process.exit(falhas ? 1 : 0);
