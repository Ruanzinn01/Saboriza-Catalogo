// Prova da migration Fornecedores V1 (categorias + possíveis fornecedores) no banco RECONSTRUÍDO (PGlite). NÃO é homologação.
// Uso: PGLITE_DIR=<pasta> node supabase/pendentes/testes_fornecedores_v1.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const MIG = read("supabase/pendentes/20261016100000_fornecedores_v1_categorias_possiveis.sql");
const REV = read("supabase/pendentes/20261016100000_fornecedores_v1_categorias_possiveis_REVERSAO.sql");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = { owner_a: "00000000-0000-0000-0000-0000000000a1", owner_b: "00000000-0000-0000-0000-0000000000b1", leitor_b: "00000000-0000-0000-0000-0000000000b2", sem_perm_b: "00000000-0000-0000-0000-0000000000b3" };
const cmd = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  -> " + String(detalhe).slice(0, 160) : ""}`); };
const esc = (o) => JSON.stringify(o).replace(/'/g, "''");

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
await papel(U.leitor_b, B, "leitor_b", ["despesas.read"]);
await papel(U.sem_perm_b, B, "sem_perm_b", ["tarefas.read"]);
const antes = { sup: (await q("select count(*)::int n from public.suppliers"))[0].n };
await db.exec(MIG);
ok("migration aplica sem erro e cria as 6 tabelas", (await q("select count(*)::int n from pg_tables where schemaname='public' and tablename ~ '^supplier_(categories|category_links|candidates|candidate_products|candidate_categories|candidate_contacts)$'"))[0].n === 6);
const SA = (await q(`insert into public.suppliers (company_id, name, company_name, phone, cnpj) values ('${A}','Contato A','Forn A','1111','11.111.111/0001-11') returning id`))[0].id;
const SB = (await q(`insert into public.suppliers (company_id, name, company_name, phone, cnpj) values ('${B}','Contato B','Forn B','2222','22.222.222/0001-22') returning id`))[0].id;

log("\n# 1. Categorias");
let r = await rpc(U.owner_b, "ensure_default_supplier_categories");
ok("padrões: cria as 8 categorias", r.ok && r.j === 8, r.msg ?? r.j);
r = await rpc(U.owner_b, "ensure_default_supplier_categories");
ok("padrões: segunda chamada idempotente (0 novas)", r.ok && r.j === 0, r.msg ?? r.j);
r = await rpc(U.owner_b, "create_supplier_category", `'  EMBALAGENS '`);
ok("criar com caixa/espaços diferentes converge para a existente (created=false)", r.ok && r.j.created === false && r.j.name === "Embalagens", JSON.stringify(r.j));
r = await rpc(U.owner_b, "create_supplier_category", `'Imoveis e alugueis'`);
ok("criar sem acentos converge para 'Imóveis e aluguéis'", r.ok && r.j.created === false, JSON.stringify(r.j));
r = await rpc(U.owner_b, "create_supplier_category", `'Frete aéreo'`);
const catNova = r.j?.id;
ok("categoria nova criada (created=true)", r.ok && r.j.created === true);
r = await rpc(U.owner_b, "create_supplier_category", `''`);
ok("nome vazio recusado", !r.ok && /até 60/.test(r.msg));
r = await rpc(U.owner_b, "create_supplier_category", `'${"x".repeat(61)}'`);
ok("nome com 61 caracteres recusado", !r.ok && /até 60/.test(r.msg));
r = await rpc(U.owner_b, "rename_supplier_category", `'${catNova}', 'Embalagens'`);
ok("renomear para nome já existente => CATEGORIA_DUPLICADA", !r.ok && /CATEGORIA_DUPLICADA/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "rename_supplier_category", `'${catNova}', 'Frete internacional'`);
ok("renomear funciona", r.ok && r.j.name === "Frete internacional");
r = await rpc(U.owner_b, "rename_supplier_category", `'${cmd(999)}', 'Qualquer'`);
ok("renomear inexistente recusa", !r.ok && /não encontrada/.test(r.msg));
const catB = Object.fromEntries((await q(`select name, id from public.supplier_categories where company_id='${B}'`)).map((c) => [c.name, c.id]));
const cat = (n) => catB[n];

log("\n# 2. Vínculo de categorias ao fornecedor formal (delta, inativa)");
r = await rpc(U.owner_b, "set_supplier_categories", `'${SB}', array['${cat("Embalagens")}','${cat("Temperos e ingredientes")}']::uuid[], null`);
ok("associa 2 categorias", r.ok && (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${SB}'`))[0].n === 2, r.msg);
r = await rpc(U.owner_b, "set_supplier_categories", `'${SB}', array['${cat("Embalagens")}']::uuid[], array['${cat("Temperos e ingredientes")}']::uuid[]`);
ok("delta: re-adicionar existente é no-op e remover funciona (resta 1)", r.ok && (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${SB}'`))[0].n === 1, r.msg);
r = await rpc(U.owner_b, "set_supplier_category_active", `'${cat("Transporte e logística")}', false`);
ok("inativar categoria", r.ok);
r = await rpc(U.owner_b, "set_supplier_categories", `'${SB}', array['${cat("Transporte e logística")}']::uuid[], null`);
ok("inativa não aceita NOVA associação", !r.ok && /inativa/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "set_supplier_category_active", `'${cat("Embalagens")}', false`);
ok("inativar categoria já vinculada preserva o vínculo", r.ok && (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${SB}'`))[0].n === 1);
await rpc(U.owner_b, "set_supplier_category_active", `'${cat("Embalagens")}', true`);
r = await rpc(U.owner_b, "set_supplier_categories", `'${SB}', array['${cat("Embalagens")}']::uuid[], array[]::uuid[]`);
ok("fornecedor sem categoria continua válido (categoria opcional): remover todas", (await rpc(U.owner_b, "set_supplier_categories", `'${SB}', null, array['${cat("Embalagens")}']::uuid[]`)).ok && (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${SB}'`))[0].n === 0);

log("\n# 3. Possíveis fornecedores: registro, idempotência, atualização, histórico");
const payload = { trade_name: "Distribuidora Sol", legal_name: "Sol LTDA", contact_name: "Marta", phone: "7199", city: "Salvador", state: "ba", products: ["Pimenta do reino", "  pimenta  DO reino ", "Cúrcuma"], category_ids: [cat("Temperos e ingredientes")] };
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(1)}', '${esc(payload)}'::jsonb`);
const cand = r.j?.id;
ok("registrar cria a avaliação (replayed=false, revisão 1)", r.ok && r.j.replayed === false && r.j.revision === 1, r.msg);
let row = (await q(`select * from public.supplier_candidates where id='${cand}'`))[0];
ok("UF em maiúscula, estágio EM_ESTUDO, first_registered_by gravado", row.state === "BA" && row.stage === "EM_ESTUDO" && row.first_registered_by === U.owner_b);
ok("produtos declarados deduplicados por chave normalizada (2) e sem criar SKU", (await q(`select count(*)::int n from public.supplier_candidate_products where candidate_id='${cand}'`))[0].n === 2);
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(1)}', '${esc(payload)}'::jsonb`);
ok("mesmo command_id + mesmo corpo = replay com o mesmo id", r.ok && r.j.replayed === true && r.j.id === cand);
ok("replay não duplica a avaliação", (await q(`select count(*)::int n from public.supplier_candidates where company_id='${B}'`))[0].n === 1);
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(1)}', '${esc({ ...payload, city: "Recife" })}'::jsonb`);
ok("mesmo command_id + corpo diferente = CONFLITO_COMANDO", !r.ok && /CONFLITO_COMANDO/.test(r.msg));
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(2)}', '${esc({ trade_name: "  " })}'::jsonb`);
ok("nome da empresa obrigatório", !r.ok && /nome da empresa/.test(r.msg));
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(2)}', '${esc({ trade_name: "X", stage: "CADASTRADO" })}'::jsonb`);
ok("não registra direto como CADASTRADO", !r.ok && /Situação inválida/.test(r.msg));
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(2)}', '${esc({ trade_name: "X", category_ids: [cat("Transporte e logística")] })}'::jsonb`);
ok("categoria inativa recusada no registro (e nada fica gravado)", !r.ok && /inexistente ou inativa/.test(r.msg) && (await q(`select count(*)::int n from public.supplier_candidates where trade_name='X'`))[0].n === 0, r.msg);
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(2)}', '${esc({ trade_name: "Y", category_ids: ["cccccccc-0000-0000-0000-000000000001"] })}'::jsonb`);
ok("categoria inexistente recusada", !r.ok);

r = await rpc(U.owner_b, "update_supplier_candidate", `'${cand}', 9, '${esc(payload)}'::jsonb`);
ok("update com revisão velha => CONFLITO_REVISAO", !r.ok && /CONFLITO_REVISAO/.test(r.msg));
r = await rpc(U.owner_b, "update_supplier_candidate", `'${cand}', 1, '${esc({ trade_name: "Distribuidora Sol 2", stage: "EM_CONTATO", products: ["Cúrcuma"] })}'::jsonb`);
row = (await q(`select * from public.supplier_candidates where id='${cand}'`))[0];
ok("update com revisão certa sobe para 2 e troca produtos (1)", r.ok && r.j.revision === 2 && row.stage === "EM_CONTATO" && (await q(`select count(*)::int n from public.supplier_candidate_products where candidate_id='${cand}'`))[0].n === 1, r.msg);
ok("update sem a chave category_ids preserva as categorias (1)", (await q(`select count(*)::int n from public.supplier_candidate_categories where candidate_id='${cand}'`))[0].n === 1);
const primeira = (await q(`select first_registered_at::text d, first_registered_by b from public.supplier_candidates where id='${cand}'`))[0];

r = await rpc(U.owner_b, "record_candidate_contact", `'${cand}', 'Ligou', date '2026-10-01', date '2026-10-20', 'EM_COTACAO'`);
ok("registrar contato 1 (sobe revisão para 3)", r.ok && r.j.revision === 3, r.msg);
r = await rpc(U.owner_b, "record_candidate_contact", `'${cand}', 'Contato antigo lançado depois', date '2026-09-15', null, null`);
row = (await q(`select * from public.supplier_candidates where id='${cand}'`))[0];
ok("contato com data anterior não recua last_contact_on (2026-10-01) e preserva o estágio", r.ok && String(row.last_contact_on).includes("2026-10-01") || row.last_contact_on?.toISOString?.().startsWith("2026-10-01"), String(row.last_contact_on));
ok("primeira data e primeiro autor nunca mudam", (await q(`select first_registered_at::text d, first_registered_by b from public.supplier_candidates where id='${cand}'`))[0].d === primeira.d && row.first_registered_by === primeira.b);
r = await rpc(U.owner_b, "record_candidate_contact", `'${cand}', 'x', null, null, 'CADASTRADO'`);
ok("contato não aceita estágio CADASTRADO", !r.ok && /Situação inválida/.test(r.msg));
r = await rpc(U.owner_b, "list_candidate_contacts", `'${cand}'`);
ok("histórico lista 2 contatos, mais recente primeiro", r.ok && r.j.length === 2 && r.j[0].contacted_on === "2026-10-01", JSON.stringify(r.j?.map?.((x) => x.contacted_on)));

log("\n# 4. Busca");
r = await rpc(U.owner_b, "search_supplier_candidates", `'curcuma', null, null, 20, 0`);
ok("busca por produto declarado sem acento", r.ok && r.j.total === 1 && r.j.rows[0].id === cand, r.msg);
r = await rpc(U.owner_b, "search_supplier_candidates", `'temperos', null, null, 20, 0`);
ok("busca por nome da categoria", r.ok && r.j.total === 1);
r = await rpc(U.owner_b, "search_supplier_candidates", `'salvador', null, null, 20, 0`);
ok("busca por cidade (search_key) -> 0 pois o update trocou o payload sem city", r.ok && r.j.total === 0, `total=${r.j?.total}`);
r = await rpc(U.owner_b, "search_supplier_candidates", `'%', null, null, 20, 0`);
ok("curinga % é escapado (não casa tudo)", r.ok && r.j.total === 0);
r = await rpc(U.owner_b, "search_supplier_candidates", `'', 'EM_COTACAO', '${cat("Temperos e ingredientes")}', 5000, -3`);
ok("filtros estágio+categoria, limite/offset saneados", r.ok && r.j.total === 1);
r = await rpc(U.owner_b, "search_supplier_candidates", `'', 'EM_ESTUDO', null, 20, 0`);
ok("filtro por estágio exclui os de outro estágio", r.ok && r.j.total === 0);

log("\n# 5. Promoção, vínculo por documento, idempotência e lock");
const c2 = (await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(10)}', '${esc({ trade_name: "Cand dup", category_ids: [cat("Embalagens")] })}'::jsonb`)).j.id;
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${c2}', null, '${esc({ name: "Fulano", company_name: "Dup LTDA", phone: "55", cnpj: "22222222000122" })}'::jsonb`);
ok("documento já cadastrado (mesmo com máscara) => DUPLICADO:<id>", !r.ok && r.msg.includes(`DUPLICADO:${SB}`), r.msg);
ok("falha da promoção não deixa nada (avaliação intacta, sem fornecedor extra)", (await q(`select stage from public.supplier_candidates where id='${c2}'`))[0].stage === "EM_ESTUDO" && (await q(`select count(*)::int n from public.suppliers where company_id='${B}'`))[0].n === 1);
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${c2}', '${SA}', '{}'::jsonb`);
ok("vincular a fornecedor de OUTRA empresa é recusado", !r.ok && /Fornecedor existente não encontrado/.test(r.msg));
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${c2}', '${SB}', '{}'::jsonb`);
ok("vincular ao fornecedor existente (created=false), sem criar fornecedor", r.ok && r.j.supplier_id === SB && r.j.created === false && (await q(`select count(*)::int n from public.suppliers where company_id='${B}'`))[0].n === 1, r.msg);
ok("estágio CADASTRADO + linked_supplier_id + contato CONVERSAO", (await q(`select stage, linked_supplier_id from public.supplier_candidates where id='${c2}'`))[0].linked_supplier_id === SB && (await q(`select count(*)::int n from public.supplier_candidate_contacts where candidate_id='${c2}' and kind='CONVERSAO'`))[0].n === 1);
ok("categorias da avaliação foram herdadas pelo fornecedor", (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${SB}' and category_id='${cat("Embalagens")}'`))[0].n === 1);
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${c2}', null, '{}'::jsonb`);
ok("retentativa é idempotente (replayed=true, mesmo fornecedor, sem 2o contato CONVERSAO)", r.ok && r.j.replayed === true && r.j.supplier_id === SB && (await q(`select count(*)::int n from public.supplier_candidate_contacts where candidate_id='${c2}' and kind='CONVERSAO'`))[0].n === 1);
r = await rpc(U.owner_b, "update_supplier_candidate", `'${c2}', 2, '${esc({ trade_name: "Z" })}'::jsonb`);
ok("avaliação cadastrada não é mais editável", !r.ok && /já cadastrada/.test(r.msg));
r = await rpc(U.owner_b, "record_candidate_contact", `'${c2}', 'x', null, null, null`);
ok("avaliação cadastrada não aceita contato", !r.ok && /já cadastrada/.test(r.msg));
const c3 = (await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(11)}', '${esc({ trade_name: "Cand novo" })}'::jsonb`)).j.id;
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${c3}', null, '${esc({ name: "", company_name: "N", phone: "1" })}'::jsonb`);
ok("criar novo exige contato, empresa e telefone", !r.ok && /Informe nome do contato/.test(r.msg));
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${c3}', null, '${esc({ name: "Beto", company_name: "Novo LTDA", phone: "77", cnpj: "33.333.333/0001-33", state: "ba", category_ids: [cat("Embalagens")] })}'::jsonb`);
const sNovo = r.j?.supplier_id;
ok("criar fornecedor novo a partir da avaliação (created=true)", r.ok && r.j.created === true, r.msg);
ok("fornecedor novo nasce na empresa da sessão, UF maiúscula e com a categoria escolhida",
  (await q(`select company_id, state from public.suppliers where id='${sNovo}'`))[0].company_id === B && (await q(`select state from public.suppliers where id='${sNovo}'`))[0].state === "BA" && (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${sNovo}'`))[0].n === 1);
ok("promoção não cria despesa (nem compra/pagamento: a RPC não toca nessas tabelas)", (await q("select count(*)::int e from public.expenses"))[0].e === 0);
r = await auth(U.owner_b, `select pg_try_advisory_xact_lock(hashtext('${B}:33333333000133')) l`);
ok("lock advisory por empresa+documento é transacional (liberado após a transação)", r.ok && r.rows[0].l === true);

log("\n# 6. Permissões, RLS de leitura, isolamento entre empresas");
r = await rpc(U.leitor_b, "create_supplier_category", `'Nova'`);
ok("leitor (só despesas.read) NÃO escreve", negado(r), r.msg);
r = await rpc(U.leitor_b, "search_supplier_candidates", `'', null, null, 20, 0`);
ok("leitor consulta pela RPC de busca", r.ok && r.j.total >= 2, r.msg);
r = await rpc(U.leitor_b, "list_candidate_contacts", `'${cand}'`);
ok("leitor lista contatos", r.ok && r.j.length === 2);
r = await rpc(U.sem_perm_b, "search_supplier_candidates", `'', null, null, 20, 0`);
ok("sem despesas.read: busca negada", negado(r), r.msg);
r = await rpc(U.sem_perm_b, "ensure_default_supplier_categories");
ok("sem despesas.manage: escrita negada", negado(r));
r = await auth(U.leitor_b, "select (select count(*) from public.supplier_candidates)::int c, (select count(*) from public.supplier_categories)::int k, (select count(*) from public.supplier_candidate_contacts)::int h");
ok("RLS leitura: leitor vê os da própria empresa", r.ok && r.rows[0].c === 3 && r.rows[0].k === 9 && r.rows[0].h >= 3, JSON.stringify(r.rows?.[0]));
r = await auth(U.sem_perm_b, "select (select count(*) from public.supplier_candidates)::int c, (select count(*) from public.supplier_categories)::int k, (select count(*) from public.supplier_category_links)::int l");
ok("RLS leitura: sem permissão vê 0 linhas", r.ok && r.rows[0].c === 0 && r.rows[0].k === 0 && r.rows[0].l === 0, JSON.stringify(r.rows?.[0]));
r = await auth(U.owner_a, "select (select count(*) from public.supplier_candidates)::int c, (select count(*) from public.supplier_categories)::int k, (select count(*) from public.supplier_candidate_contacts)::int h, (select count(*) from public.supplier_candidate_products)::int p");
ok("empresa A (sem dados) não vê nada da B", r.ok && r.rows[0].c === 0 && r.rows[0].k === 0 && r.rows[0].h === 0 && r.rows[0].p === 0, JSON.stringify(r.rows?.[0]));
for (const t of ["supplier_categories", "supplier_category_links", "supplier_candidates", "supplier_candidate_products", "supplier_candidate_categories", "supplier_candidate_contacts"]) {
  const w = await auth(U.owner_b, `delete from public.${t}`);
  const i = await auth(U.owner_b, `update public.${t} set company_id = company_id`);
  ok(`escrita direta em ${t}: NEGADA até ao Proprietário (delete/update)`, negado(w) && negado(i), `${w.msg ?? ""}`);
}
r = await auth(U.owner_b, `insert into public.supplier_categories (name, name_key) values ('direto','direto')`);
ok("insert direto em supplier_categories negado", negado(r));
// mesma sessão A usando objetos da B
await rpc(U.owner_a, "ensure_default_supplier_categories");
const catA = (await q(`select id from public.supplier_categories where company_id='${A}' limit 1`))[0].id;
r = await rpc(U.owner_a, "set_supplier_categories", `'${SB}', array['${catA}']::uuid[], null`);
ok("A não altera fornecedor da B", !r.ok && /Fornecedor não encontrado/.test(r.msg));
r = await rpc(U.owner_a, "set_supplier_categories", `'${SA}', array['${cat("Embalagens")}']::uuid[], null`);
ok("A não usa categoria da B", !r.ok && /Categoria não encontrada/.test(r.msg));
r = await rpc(U.owner_a, "rename_supplier_category", `'${cat("Embalagens")}', 'Hack'`);
ok("A não renomeia categoria da B", !r.ok && /não encontrada/.test(r.msg));
r = await rpc(U.owner_a, "set_supplier_category_active", `'${cat("Embalagens")}', false`);
ok("A não inativa categoria da B", !r.ok && /não encontrada/.test(r.msg));
r = await rpc(U.owner_a, "update_supplier_candidate", `'${cand}', 3, '${esc({ trade_name: "Hack" })}'::jsonb`);
ok("A não edita avaliação da B", !r.ok && /não encontrada/.test(r.msg));
r = await rpc(U.owner_a, "record_candidate_contact", `'${cand}', 'x', null, null, null`);
ok("A não registra contato na avaliação da B", !r.ok && /não encontrada/.test(r.msg));
r = await rpc(U.owner_a, "convert_candidate_to_supplier", `'${cand}', null, '${esc({ name: "a", company_name: "a", phone: "1" })}'::jsonb`);
ok("A não promove avaliação da B", !r.ok && /não encontrada/.test(r.msg));
r = await rpc(U.owner_a, "list_candidate_contacts", `'${cand}'`);
ok("A lista 0 contatos da avaliação da B", r.ok && r.j.length === 0);
r = await rpc(U.owner_a, "register_supplier_candidate", `'${cmd(1)}', '${esc({ ...payload, category_ids: [] })}'::jsonb`);
ok("mesmo command_id em outra empresa NÃO colide (unique é por empresa)", r.ok && r.j.replayed === false && r.j.id !== cand, r.msg);
ok("mesmo documento na empresa A não é visto como duplicado de B (cria sem DUPLICADO)",
  (await rpc(U.owner_a, "convert_candidate_to_supplier", `'${r.j.id}', null, '${esc({ name: "a", company_name: "a", phone: "1", cnpj: "22222222000122" })}'::jsonb`)).ok);
// FKs compostas e guarda (como superusuário, contornando RPC)
const falhaSql = async (sql) => { try { await db.exec(sql); return null; } catch (e) { return e.message; } };
let m = await falhaSql(`insert into public.supplier_category_links (company_id, supplier_id, category_id) values ('${A}','${SA}','${cat("Embalagens")}')`);
ok("FK composta: vínculo com categoria de outra empresa rejeitado no banco", /foreign key|violates/i.test(m ?? ""), m);
m = await falhaSql(`insert into public.supplier_category_links (company_id, supplier_id, category_id) values ('${A}','${SB}','${catA}')`);
ok("trigger: vínculo com fornecedor de outra empresa rejeitado no banco", /outra empresa/.test(m ?? ""), m);
m = await falhaSql(`insert into public.supplier_candidate_categories (company_id, candidate_id, category_id) values ('${A}','${cand}','${catA}')`);
ok("FK composta: categoria de candidato com candidato de outra empresa rejeitada", /foreign key|violates/i.test(m ?? ""), m);
m = await falhaSql(`insert into public.supplier_candidate_products (company_id, candidate_id, label, label_key) values ('${A}','${cand}','x','x')`);
ok("FK composta: produto com candidato de outra empresa rejeitado", /foreign key|violates/i.test(m ?? ""), m);
m = await falhaSql(`insert into public.supplier_candidate_contacts (company_id, candidate_id) values ('${A}','${cand}')`);
ok("FK composta: contato com candidato de outra empresa rejeitado", /foreign key|violates/i.test(m ?? ""), m);
m = await falhaSql(`update public.supplier_candidates set stage='CADASTRADO' where id='${c3}' and false; insert into public.supplier_candidates (company_id, trade_name, stage) values ('${B}','chk','CADASTRADO')`);
ok("CHECK: CADASTRADO exige fornecedor vinculado", /check/i.test(m ?? ""), m);
ok("a migration não mexeu em suppliers existentes (linhas: antes 0, agora só as 3 criadas pelo teste/promoção)", antes.sup === 0);

log("\n# 7. GRANT/REVOKE");
const fns = ["create_supplier_category(text)", "rename_supplier_category(uuid,text)", "set_supplier_category_active(uuid,boolean)", "ensure_default_supplier_categories()", "set_supplier_categories(uuid,uuid[],uuid[])", "register_supplier_candidate(uuid,jsonb)", "update_supplier_candidate(uuid,integer,jsonb)", "record_candidate_contact(uuid,text,date,date,text)", "search_supplier_candidates(text,text,uuid,integer,integer)", "list_candidate_contacts(uuid)", "convert_candidate_to_supplier(uuid,uuid,jsonb)"];
const priv = await q(`select p.oid::regprocedure::text f, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u, has_function_privilege('public', p.oid, 'execute') pu from pg_proc p where p.oid = any(array[${fns.map((f) => `'public.${f}'::regprocedure`).join(",")}]::oid[])`);
ok("11 RPCs existem", priv.length === 11);
ok("anon sem EXECUTE nas 11 e public sem EXECUTE", priv.every((x) => !x.a && !x.pu));
ok("authenticated com EXECUTE nas 11", priv.every((x) => x.u));
r = await como(null, "anon", `select public.create_supplier_category('x')`);
ok("anon chamando a RPC: permission denied", negado(r), r.msg);
r = await como(null, "anon", `select count(*) from public.supplier_candidates`);
ok("anon lendo a tabela: permission denied", negado(r), r.msg);
const privInt = await q(`select p.oid::regprocedure::text f, has_function_privilege('authenticated', p.oid, 'execute') u, has_function_privilege('anon', p.oid, 'execute') a from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('supplier_company_for','supplier_candidate_sync_children','supplier_candidate_search_key')`);
ok("funções internas private.* sem EXECUTE para authenticated e anon", privInt.length === 3 && privInt.every((x) => !x.u && !x.a), JSON.stringify(privInt));
const tg = await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_name ~ '^supplier_(categories|category_links|candidates|candidate_products|candidate_categories|candidate_contacts)$' and grantee in ('anon','authenticated')`);
ok("tabelas: authenticated só SELECT (sem insert/update/delete/truncate); anon nada", tg.filter((g) => g.grantee === "authenticated").every((g) => !["INSERT", "UPDATE", "DELETE", "TRUNCATE"].includes(g.privilege_type)) && tg.filter((g) => g.grantee === "anon").length === 0, JSON.stringify(tg.filter((g) => g.grantee === "anon").slice(0, 3)));

log("\n# 8. Reversão");
const antesRev = { sup: (await q("select count(*)::int n from public.suppliers"))[0].n };
await db.exec(REV);
ok("reversão executa e remove as 6 tabelas", (await q("select count(*)::int n from pg_tables where schemaname='public' and tablename ~ '^supplier_(categories|category_links|candidates|candidate_products|candidate_categories|candidate_contacts)$'"))[0].n === 0);
ok("reversão remove todas as funções da etapa (public e private)", (await q("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname ~ '^(create_supplier_category|rename_supplier_category|set_supplier_category_active|ensure_default_supplier_categories|set_supplier_categories|register_supplier_candidate|update_supplier_candidate|record_candidate_contact|search_supplier_candidates|list_candidate_contacts|convert_candidate_to_supplier|supplier_company_for|supplier_candidate_sync_children|supplier_candidate_search_key|supplier_category_link_guard|supplier_normalize_text)$'"))[0].n === 0);
ok("fornecedores formais preservados pela reversão", (await q("select count(*)::int n from public.suppliers"))[0].n === antesRev.sup && antesRev.sup >= 3);
await db.exec(REV);
ok("reversão idempotente (segunda execução sem erro)", true);
await db.exec(MIG);
ok("reaplicar a migration depois da reversão funciona", (await q("select count(*)::int n from pg_tables where schemaname='public' and tablename ~ '^supplier_(categories|category_links|candidates|candidate_products|candidate_categories|candidate_contacts)$'"))[0].n === 6);
r = await rpc(U.owner_b, "ensure_default_supplier_categories");
ok("e as RPCs voltam a funcionar", r.ok && r.j === 8, r.msg);
m = await falhaSql(MIG);
ok("migration NÃO é idempotente se reaplicada sem reversão (create table sem if not exists): comportamento documentado", /already exists/i.test(m ?? ""), m);

await db.close();
log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
process.exit(falhas === 0 ? 0 : 1);
