// Prova da migration Fornecedores V1 · complemento (20261016141000) no banco RECONSTRUÍDO (PGlite). NÃO é homologação.
// Aplica primeiro 20261016100000 e depois 20261016141000. Dados 100% sintéticos.
// Uso: PGLITE_DIR=<pasta> node supabase/pendentes/testes_fornecedores_v1_complemento.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const MIG1 = read("supabase/pendentes/20261016100000_fornecedores_v1_categorias_possiveis.sql");
const MIG2 = read("supabase/pendentes/20261016141000_fornecedores_v1_mestre_complemento.sql");
const REV2 = read("supabase/pendentes/20261016141000_fornecedores_v1_mestre_complemento_REVERSAO.sql");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const U = {
  owner_a: "00000000-0000-0000-0000-0000000000a1", owner_b: "00000000-0000-0000-0000-0000000000b1",
  legado_b: "00000000-0000-0000-0000-0000000000b2", leitor_b: "00000000-0000-0000-0000-0000000000b3",
  gestor_b: "00000000-0000-0000-0000-0000000000b4", sem_perm_b: "00000000-0000-0000-0000-0000000000b5",
  fin_b: "00000000-0000-0000-0000-0000000000b6", banco_b: "00000000-0000-0000-0000-0000000000b7",
};
const cmd = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  -> " + String(detalhe).slice(0, 170) : ""}`); };
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
const falhaSql = async (sql) => { try { await db.exec(sql); return null; } catch (e) { return e.message; } };
const J = (o) => `'${esc(o)}'::jsonb`;
const base = (extra = {}) => ({ trade_name: "Fantasia Sintética", company_name: "Razão Sintética Ltda", cnpj: "11.222.333/0001-81", state: "BA", city: "Salvador", address: "Rua Teste", street_number: "10", ...extra });

log("# 0. Base reconstruída, migration 100000 e backfill de permissões");
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
const antesPerms = (await q("select key from public.permissions where key <> 'separa_confere.operar'")).map((r) => r.key);
await db.exec(MIG1);
// papéis criados ANTES da migration nova: provam o backfill
await papel(U.owner_a, A, "OWNER", antesPerms);
await papel(U.owner_b, B, "OWNER", antesPerms);
await papel(U.legado_b, B, "legado_despesas", ["despesas.read", "despesas.manage"]);
await papel(U.leitor_b, B, "leitor_despesas", ["despesas.read"]);
await papel(U.sem_perm_b, B, "sem_perm", ["tarefas.read"]);
// fornecedores legados (como existem em produção): sem colunas novas, contato/telefone preenchidos
const LA = (await q(`insert into public.suppliers (company_id, name, company_name, phone, cnpj) values ('${A}','Contato A','Forn A','1111','99.999.999/0001-99') returning id`))[0].id;
const LB = (await q(`insert into public.suppliers (company_id, name, company_name, phone, cnpj, city) values ('${B}','Contato B','Forn B legado','2222','','') returning id`))[0].id;
const antesSup = (await q("select count(*)::int n from public.suppliers"))[0].n;
await db.exec(MIG2);
ok("migration complemento aplica sem erro", true);
ok("fornecedores existentes preservados (mesma contagem) e ativos por padrão", (await q("select count(*)::int n from public.suppliers where active"))[0].n === antesSup);
ok("9 chaves fornecedores.* criadas", (await q("select count(*)::int n from public.permissions where key like 'fornecedores.%'"))[0].n === 9);
const permsDe = async (chave, emp) => (await q(`select rp.permission_key k from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.key = '${chave}' and r.company_id = '${emp}'`)).map((x) => x.k);
let pl = await permsDe("legado_despesas", B);
ok("backfill: despesas.manage -> manage/categorias/anexos/exportar; despesas.read -> read/financeiro", ["fornecedores.manage", "fornecedores.categorias", "fornecedores.anexos", "fornecedores.exportar", "fornecedores.read", "fornecedores.financeiro"].every((k) => pl.includes(k)));
ok("backfill: banco/Pix NUNCA herdado de despesas.*", !pl.some((k) => k.startsWith("fornecedores.banco")));
pl = await permsDe("leitor_despesas", B);
ok("backfill: leitor ganha só read+financeiro", pl.filter((k) => k.startsWith("fornecedores.")).sort().join() === "fornecedores.financeiro,fornecedores.read");
ok("OWNER recebe as 3 chaves de banco", (await permsDe("OWNER", B)).filter((k) => k.startsWith("fornecedores.banco")).length === 3);
ok("papel sem despesas.* não ganha nada", (await permsDe("sem_perm", B)).every((k) => !k.startsWith("fornecedores.")));
const todas = (await q("select key from public.permissions where key <> 'separa_confere.operar'")).map((r) => r.key);
await papel(U.gestor_b, B, "gestor_forn", ["fornecedores.read", "fornecedores.manage", "fornecedores.categorias", "fornecedores.anexos", "fornecedores.exportar"]);
await papel(U.fin_b, B, "fin_forn", ["fornecedores.read", "fornecedores.financeiro"]);
await papel(U.banco_b, B, "banco_forn", ["fornecedores.read", "fornecedores.banco.read"]);

log("\n# 1. RLS de suppliers: leitura por permissão, escrita só por RPC");
let r = await auth(U.sem_perm_b, "select count(*)::int n from public.suppliers");
ok("membro ativo SEM permissão não lê mais fornecedores (antes lia)", r.ok && r.rows[0].n === 0);
r = await auth(U.leitor_b, "select count(*)::int n from public.suppliers");
ok("despesas.read continua lendo (compatibilidade com Compras/Despesas) só da própria empresa", r.ok && r.rows[0].n === 1, JSON.stringify(r.rows));
r = await auth(U.owner_a, `select count(*)::int n from public.suppliers where company_id = '${B}'`);
ok("isolamento: A não vê fornecedor de B", r.ok && r.rows[0].n === 0);
r = await auth(U.owner_b, `insert into public.suppliers (company_id, name, company_name, phone) values ('${B}','x','x','x')`);
ok("INSERT direto negado até para o proprietário", negado(r), r.msg);
r = await auth(U.owner_b, `update public.suppliers set trade_name = 'hack' where id = '${LB}'`);
ok("UPDATE direto negado até para o proprietário", negado(r), r.msg);
r = await auth(U.owner_b, `delete from public.suppliers where id = '${LB}'`);
ok("DELETE direto negado (sem exclusão: ativo/inativo)", negado(r), r.msg);
r = await como(null, "anon", "select count(*) from public.suppliers");
ok("anon não lê suppliers", negado(r), r.msg);

log("\n# 2. create_supplier: validação, idempotência, duplicidade por documento normalizado");
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ trade_name: " " }))}`);
ok("sem nome fantasia é recusado", !r.ok && /nome do fornecedor/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ company_name: "" }))}`);
ok("sem razão social é recusado", !r.ok && /razão social/.test(r.msg), r.msg);
for (const [campo, rx] of [["cnpj", /documento/], ["state", /estado/], ["city", /município/], ["address", /logradouro/], ["street_number", /número/]]) {
  r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ [campo]: "" }))}`);
  ok(`cadastro novo sem ${campo} recusado`, !r.ok && rx.test(r.msg), r.msg);
}
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ cnpj: "123" }))}`);
ok("CNPJ inválido recusado", !r.ok && /CNPJ deve conter 14/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ person_type: "PF", cnpj: "123.456.789-0" }))}`);
ok("CPF inválido recusado", !r.ok && /CPF deve conter 11/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ website: "site.com" }))}`);
ok("site sem http recusado", !r.ok && /http/.test(r.msg));
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ email: "sem-arroba" }))}`);
ok("e-mail inválido recusado", !r.ok && /E-mail inválido/.test(r.msg));
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ ibge_code: "123" }))}`);
ok("IBGE com 3 dígitos recusado (7 exigidos)", !r.ok && /IBGE/.test(r.msg));
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(base({ cep: "123" }))}`);
ok("CEP com 3 dígitos recusado", !r.ok && /CEP/.test(r.msg));
const payloadOk = base({ phone: "71 99999-0001", email: "c@exemplo.com", ibge_code: "2927408", cep: "40000-000", lead_time_days: 7, minimum_order_cents: 50000, credit_limit_cents: 2500000, payment_terms: "28", supply_type: "Embalagens" });
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(payloadOk)}`);
const S1 = r.j?.id;
ok("cria fornecedor completo (revisão 1, replayed=false)", r.ok && r.j.revision === 1 && r.j.replayed === false, r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J(payloadOk)}`);
ok("mesmo command_id + mesmo corpo = replay, mesmo id, sem duplicar", r.ok && r.j.replayed === true && r.j.id === S1 && (await q(`select count(*)::int n from public.suppliers where company_id='${B}' and trade_name='Fantasia Sintética'`))[0].n === 1);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(1)}', ${J({ ...payloadOk, city: "Recife" })}`);
ok("mesmo command_id + corpo diferente = CONFLITO_COMANDO", !r.ok && /CONFLITO_COMANDO/.test(r.msg));
r = await rpc(U.owner_b, "create_supplier", `'${cmd(2)}', ${J(base({ trade_name: "Outro nome", cnpj: "11222333000181" }))}`);
ok("duplicidade: mesmo documento SEM pontuação => DUPLICADO:<id>", !r.ok && r.msg.includes("DUPLICADO:" + S1), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(2)}', ${J(base({ trade_name: "Alfa", cnpj: "12.ABC.345/01DE-35" }))}`);
const S2 = r.j?.id;
ok("CNPJ alfanumérico aceito, letras preservadas", r.ok && (await q(`select document_key k from public.suppliers where id='${S2}'`))[0].k === "12ABC34501DE35", r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(3)}', ${J(base({ trade_name: "Alfa minúsc", cnpj: "12.abc.345/01de-35" }))}`);
ok("duplicidade ignora caixa das letras", !r.ok && /DUPLICADO/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(4)}', ${J(base({ trade_name: "Zeros", cnpj: "00.000.000/0001-91" }))}`);
const S3 = r.j?.id;
ok("zeros à esquerda preservados no documento", r.ok && (await q(`select cnpj c, document_key k from public.suppliers where id='${S3}'`))[0].k === "00000000000191", r.msg);
r = await rpc(U.owner_a, "create_supplier", `'${cmd(1)}', ${J(base())}`);
ok("mesmo documento e mesmo command_id em OUTRA empresa: permitido (escopo por empresa)", r.ok && r.j.replayed === false, r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(5)}', ${J(base({ trade_name: "Sem contato", cnpj: "", state: "BA" }))}`);
ok("documento é exigido no cadastro novo", !r.ok);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(5)}', ${J(base({ trade_name: "Sem contato", cnpj: "33.444.555/0001-66", name: "", phone: "" }))}`);
const S4 = r.j?.id;
ok("contato e telefone NÃO são exigidos", r.ok, r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(6)}', ${J(base({ trade_name: "Com cat", cnpj: "44.555.666/0001-77", category_ids: [] }))}`);
ok("sem categoria é válido (categoria opcional)", r.ok, r.msg);
r = await rpc(U.leitor_b, "create_supplier", `'${cmd(7)}', ${J(base({ cnpj: "55.666.777/0001-88" }))}`);
ok("leitor (despesas.read) não cria", negado(r), r.msg);
r = await rpc(U.sem_perm_b, "create_supplier", `'${cmd(7)}', ${J(base({ cnpj: "55.666.777/0001-88" }))}`);
ok("sem permissão não cria", negado(r), r.msg);
r = await rpc(U.gestor_b, "create_supplier", `'${cmd(7)}', ${J(base({ trade_name: "Do gestor", cnpj: "55.666.777/0001-88" }))}`);
ok("gestor com fornecedores.manage cria (sem precisar de despesas.*)", r.ok, r.msg);
r = await rpc(U.owner_b, "find_supplier_by_document", `'11.222.333/0001-81', null`);
ok("find_supplier_by_document acha por documento normalizado", r.ok && r.j.id === S1);
r = await rpc(U.owner_b, "find_supplier_by_document", `'11.222.333/0001-81', '${S1}'`);
ok("find_supplier_by_document respeita exclusão do próprio", r.ok && r.j === null);
r = await rpc(U.owner_a, "find_supplier_by_document", `'11.222.333/0001-81', '${S1}'`);
ok("find_supplier_by_document não vê fornecedor de outra empresa", r.ok && r.j?.id !== S1);

log("\n# 3. Localização: par lat/lon, faixas, confirmação, vírgula, zero");
const geo = (o) => base({ trade_name: "Geo " + Math.random(), cnpj: String(Math.floor(Math.random() * 1e11)).padStart(11, "0").slice(0, 11) + "", person_type: "PF", ...o });
r = await rpc(U.owner_b, "create_supplier", `'${cmd(10)}', ${J(geo({ latitude: "-12,9714" }))}`);
ok("latitude sem longitude recusada", !r.ok && /juntas/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(11)}', ${J(geo({ latitude: "91", longitude: "10", location_confirmed: true }))}`);
ok("latitude fora da faixa recusada", !r.ok && /faixa/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(12)}', ${J(geo({ latitude: "10", longitude: "181", location_confirmed: true }))}`);
ok("longitude fora da faixa recusada", !r.ok && /faixa/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(13)}', ${J(geo({ latitude: "-12,9714", longitude: "-38,5014" }))}`);
ok("coordenadas sem confirmação do ponto recusadas", !r.ok && /Confirme/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(14)}', ${J(geo({ latitude: "-12,9714", longitude: "-38,5014", location_confirmed: true, location_source: "MANUAL" }))}`);
const SG = r.j?.id;
let row = (await q(`select latitude, longitude, location_confirmed_at, location_confirmed_by from public.suppliers where id='${SG}'`))[0];
ok("vírgula normalizada e confirmação gravada com autor/data", r.ok && Number(row.latitude) === -12.9714 && row.location_confirmed_at && row.location_confirmed_by === U.owner_b, r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(15)}', ${J(geo({ latitude: "0", longitude: "0", location_confirmed: true }))}`);
ok("zero é coordenada válida (0,0)", r.ok, r.msg);
r = await rpc(U.owner_b, "create_supplier", `'${cmd(16)}', ${J(geo({ location_source: "SATELITE" }))}`);
ok("origem do ponto inválida recusada", !r.ok && /Origem/.test(r.msg));
let m = await falhaSql(`update public.suppliers set latitude = 10, longitude = null where id='${SG}'`);
ok("CHECK no banco: lat sem lon rejeitada mesmo fora da RPC", /check|violates/i.test(m ?? ""), m);

log("\n# 4. update_supplier: revisão, legado, invalidação do ponto, contatos, categorias, ativo");
r = await rpc(U.owner_b, "update_supplier", `'${S1}', 99, ${J(payloadOk)}`);
ok("revisão errada => CONFLITO_REVISAO (sem sobrescrita silenciosa)", !r.ok && /CONFLITO_REVISAO/.test(r.msg), r.msg);
const cats = (await rpc(U.owner_b, "ensure_default_supplier_categories")).j;
ok("categorias padrão criadas (exige fornecedores.categorias, owner tem)", cats === 8);
const catB = Object.fromEntries((await q(`select name, id from public.supplier_categories where company_id='${B}'`)).map((c) => [c.name, c.id]));
r = await rpc(U.owner_b, "update_supplier", `'${S1}', 1, ${J({ ...payloadOk, trade_name: "Fantasia Editada", whatsapp: true, category_add: [catB["Embalagens"], catB["Imóveis e aluguéis"]], contacts: [{ name: "Maria", role: "Vendas", phone: "71 98888-0000", whatsapp: true, email: "m@exemplo.com" }, { name: "", phone: "", email: "" }] })}`);
ok("edição válida sobe a revisão para 2", r.ok && r.j.revision === 2, r.msg);
ok("contato adicional gravado (linha vazia ignorada)", (await q(`select count(*)::int n from public.supplier_contacts where supplier_id='${S1}'`))[0].n === 1);
ok("categorias associadas por delta (2)", (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${S1}'`))[0].n === 2);
r = await rpc(U.owner_b, "update_supplier", `'${S1}', 2, ${J({ ...payloadOk, trade_name: "Fantasia Editada", category_add: [catB["Embalagens"]], category_remove: [catB["Imóveis e aluguéis"]] })}`);
ok("delta: remove uma, mantém a outra; contatos preservados quando a chave não vem", r.ok && (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${S1}'`))[0].n === 1 && (await q(`select count(*)::int n from public.supplier_contacts where supplier_id='${S1}'`))[0].n === 1, r.msg);
await rpc(U.owner_b, "set_supplier_category_active", `'${catB["Máquinas e equipamentos"]}', false`);
r = await rpc(U.owner_b, "update_supplier", `'${S1}', 3, ${J({ ...payloadOk, trade_name: "Fantasia Editada", category_add: [catB["Máquinas e equipamentos"]] })}`);
ok("categoria inativa não aceita NOVA associação", !r.ok && /inativa/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "update_supplier", `'${S1}', 3, ${J({ ...payloadOk, trade_name: "Fantasia Editada", cnpj: "33.444.555/0001-66" })}`);
ok("trocar documento para o de outro fornecedor => DUPLICADO", !r.ok && /DUPLICADO/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "update_supplier", `'${S1}', 3, ${J({ ...payloadOk, trade_name: "Fantasia Editada", address: "" })}`);
ok("não permite apagar logradouro já preenchido", !r.ok && /logradouro/.test(r.msg), r.msg);
// legado (sem documento/endereço) edita sem ser bloqueado
r = await rpc(U.owner_b, "update_supplier", `'${LB}', 1, ${J({ trade_name: "Legado editado", company_name: "Forn B legado", name: "Contato B", phone: "2222" })}`);
ok("legado SEM documento/endereço pode ser editado (campos vazios continuam vazios)", r.ok && r.j.revision === 2, r.msg);
r = await rpc(U.owner_b, "update_supplier", `'${LA}', 1, ${J({ trade_name: "Hack" })}`);
ok("B não edita fornecedor de A", !r.ok && /não encontrado/.test(r.msg), r.msg);
// confirmação do ponto
r = await rpc(U.owner_b, "update_supplier", `'${SG}', 1, ${J({ ...(await q(`select trade_name, company_name, cnpj, state, city, address, street_number, person_type from public.suppliers where id='${SG}'`))[0], latitude: "-12.9714", longitude: "-38.5014", location_confirmed: true })}`);
row = (await q(`select location_confirmed_at a from public.suppliers where id='${SG}'`))[0];
const confirmadoAntes = row.a;
ok("reenviar o mesmo ponto confirmado mantém a data da confirmação", r.ok && String(row.a) === String(confirmadoAntes) && row.a !== null, r.msg);
const sg = (await q(`select trade_name, company_name, cnpj, state, city, address, street_number, person_type, revision from public.suppliers where id='${SG}'`))[0];
r = await rpc(U.owner_b, "update_supplier", `'${SG}', ${sg.revision}, ${J({ ...sg, revision: undefined, address: "Outra rua", latitude: "-12.9714", longitude: "-38.5014" })}`);
ok("mudar endereço mantendo coordenadas SEM reconfirmar => recusado (invalida)", !r.ok && /Confirme/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "update_supplier", `'${SG}', ${sg.revision}, ${J({ ...sg, revision: undefined, address: "Outra rua" })}`);
row = (await q(`select location_confirmed_at a, latitude from public.suppliers where id='${SG}'`))[0];
ok("sem ponto informado, a confirmação anterior é limpa", r.ok && row.a === null && row.latitude === null, r.msg);
// ativo/inativo
r = await rpc(U.owner_b, "set_supplier_active", `'${S4}', false, 1`);
ok("inativar no lugar de excluir (revisão sobe)", r.ok && r.j.active === false && r.j.revision === 2, r.msg);
r = await rpc(U.owner_b, "set_supplier_active", `'${S4}', true, 1`);
ok("set_supplier_active com revisão velha => CONFLITO_REVISAO", !r.ok && /CONFLITO_REVISAO/.test(r.msg));
r = await rpc(U.leitor_b, "set_supplier_active", `'${S4}', true, 2`);
ok("leitor não ativa/inativa", negado(r), r.msg);

log("\n# 5. Banco / Pix: permissão própria, máscara, invalidação, nunca em eventos");
const bankPayload = { beneficiary_name: "Titular Sintético", beneficiary_document: "11122233344", bank: "001", branch: "1234", account: "99887-6", pix_type: "Aleatória", pix_key: "chave-pix-secreta-0001", notes: "ok" };
r = await rpc(U.gestor_b, "set_supplier_bank_details", `'${S1}', ${J(bankPayload)}`);
ok("gestor de cadastro (sem banco.manage) NÃO grava banco/Pix", negado(r), r.msg);
r = await rpc(U.gestor_b, "get_supplier_bank_details", `'${S1}', false`);
ok("gestor de cadastro NÃO lê banco/Pix", negado(r), r.msg);
r = await auth(U.gestor_b, `select count(*)::int n from public.supplier_bank_details`);
ok("RLS: tabela de banco vazia para quem não tem banco.read", r.ok && r.rows[0].n === 0);
r = await rpc(U.owner_b, "set_supplier_bank_details", `'${S1}', ${J(bankPayload)}`);
ok("proprietário grava banco/Pix (status PENDENTE)", r.ok && r.j.verification_status === "PENDENTE", r.msg);
r = await rpc(U.banco_b, "get_supplier_bank_details", `'${S1}', false`);
ok("banco.read vê MASCARADO (•••• + 4 finais)", r.ok && r.j.masked === true && r.j.pix_key === "••••0001" && r.j.account === "••••87-6".replace("87-6", "87-6") || (r.ok && r.j.pix_key === "••••0001"), JSON.stringify(r.j));
r = await rpc(U.banco_b, "get_supplier_bank_details", `'${S1}', true`);
ok("reveal completo exige banco.manage (banco.read não basta)", !r.ok && /Sem permiss/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "get_supplier_bank_details", `'${S1}', true`);
ok("owner revela valores completos para editar", r.ok && r.j.pix_key === "chave-pix-secreta-0001");
r = await rpc(U.owner_a, "get_supplier_bank_details", `'${S1}', true`);
ok("A não lê banco de fornecedor de B (sem registro na empresa A)", r.ok && r.j.exists === false);
r = await rpc(U.owner_a, "set_supplier_bank_details", `'${S1}', ${J(bankPayload)}`);
ok("A não grava banco em fornecedor de B", !r.ok && /não encontrado/.test(r.msg), r.msg);
r = await rpc(U.owner_b, "verify_supplier_bank_details", `'${S1}'`);
ok("owner confere os dados (VERIFICADO)", r.ok && r.j.verification_status === "VERIFICADO", r.msg);
r = await rpc(U.banco_b, "verify_supplier_bank_details", `'${S1}'`);
ok("banco.read sem banco.verify não confere", negado(r), r.msg);
r = await rpc(U.owner_b, "set_supplier_bank_details", `'${S1}', ${J({ ...bankPayload, notes: "só observação" })}`);
ok("mudar só a observação mantém VERIFICADO", r.ok && r.j.verification_status === "VERIFICADO" && r.j.bank_revision === 1, JSON.stringify(r.j));
r = await rpc(U.owner_b, "set_supplier_bank_details", `'${S1}', ${J({ ...bankPayload, pix_key: "outra-chave-0002" })}`);
ok("mudar a chave Pix INVALIDA a conferência (volta PENDENTE, revisão 2)", r.ok && r.j.verification_status === "PENDENTE" && r.j.bank_revision === 2, JSON.stringify(r.j));
r = await rpc(U.owner_b, "set_supplier_bank_details", `'${S1}', ${J({ ...bankPayload, pix_type: "Boleto" })}`);
ok("tipo de chave inválido recusado", !r.ok && /Pix inválido/.test(r.msg));
r = await auth(U.owner_b, `select * from public.suppliers where id = '${S1}'`);
ok("a linha de suppliers NÃO carrega colunas de banco/Pix (listas não vazam)", r.ok && !Object.keys(r.rows[0]).some((c) => /pix|bank|account|branch|beneficiary/.test(c)), Object.keys(r.rows[0] ?? {}).join(","));
r = await rpc(U.owner_b, "verify_supplier_bank_details", `'${S3}'`);
ok("não confere fornecedor sem dados bancários", !r.ok && /Não há dados/.test(r.msg));

log("\n# 6. Eventos mínimos");
const tipos = Object.fromEntries((await q(`select event_type, count(*)::int n from public.supplier_events where company_id='${B}' group by 1`)).map((e) => [e.event_type, e.n]));
ok("eventos supplier.created / supplier.updated / categories_changed registrados", tipos["supplier.created"] >= 5 && tipos["supplier.updated"] >= 3 && tipos["supplier.categories_changed"] >= 3, JSON.stringify(tipos));
ok("eventos supplier_category.created e .deactivated", tipos["supplier_category.created"] === 8 && tipos["supplier_category.deactivated"] === 1, JSON.stringify(tipos));
ok("eventos bank_details_changed e bank_details_verified", tipos["supplier.bank_details_changed"] >= 2 && tipos["supplier.bank_details_verified"] === 1, JSON.stringify(tipos));
const vazou = await q(`select count(*)::int n from public.supplier_events where payload::text ~* '(chave-pix|outra-chave|99887|11122233344|71 99999|71 98888|Titular|11.222.333|Rua Teste)'`);
ok("payload dos eventos NÃO contém telefone, documento, banco, Pix, endereço (só ids e nomes de campo)", vazou[0].n === 0);
ok("evento supplier.updated lista NOMES de campos alterados", (await q(`select count(*)::int n from public.supplier_events where event_type='supplier.updated' and payload ? 'fields'`))[0].n >= 2);
r = await auth(U.sem_perm_b, "select count(*)::int n from public.supplier_events");
ok("sem fornecedores.read não lê eventos", r.ok && r.rows[0].n === 0);
r = await auth(U.owner_a, `select count(*)::int n from public.supplier_events where company_id='${B}'`);
ok("A não lê eventos da B", r.ok && r.rows[0].n === 0);
r = await auth(U.owner_b, `insert into public.supplier_events (company_id, event_type, entity_type, entity_id) values ('${B}','x','x','${S1}')`);
ok("eventos não são graváveis pelo cliente", negado(r), r.msg);

log("\n# 7. Arquivos e fotos (storage privado)");
const objeto = async (nome, meta) => db.exec(`insert into storage.objects (bucket_id, name, metadata) values ('supplier-files','${nome}','${esc(meta)}')`);
const pathB = (n) => `${B}/${n}`;
await objeto(pathB("fachada.png"), { mimetype: "image/png", size: 1000 });
await objeto(pathB("contrato.pdf"), { mimetype: "application/pdf", size: 2000 });
await objeto(pathB("exe.bin"), { mimetype: "application/x-msdownload", size: 10 });
await objeto(pathB("grande.png"), { mimetype: "image/png", size: 9 * 1024 * 1024 });
await objeto(pathB("foto-pdf.pdf"), { mimetype: "application/pdf", size: 100 });
await objeto(`${A}/outra.png`, { mimetype: "image/png", size: 100 });
const reg = (uid, sup, cand, kind, p, mime, size, cap = "", pk = "Fachada", prim = false) =>
  rpc(uid, "register_supplier_file", `${sup ? `'${sup}'` : "null"}, ${cand ? `'${cand}'` : "null"}, '${kind}', '${p}', 'arq', '${mime}', ${size}, '${cap}', '${pk}', ${prim}`);
r = await reg(U.owner_b, S1, null, "FOTO", pathB("fachada.png"), "image/png", 1000, "Fachada", "Fachada", true);
const F1 = r.j?.id;
ok("registra foto de fachada principal", r.ok && r.j.replayed === false, r.msg);
r = await reg(U.owner_b, S1, null, "FOTO", pathB("fachada.png"), "image/png", 1000);
ok("retry do mesmo upload não duplica (replayed)", r.ok && r.j.replayed === true && r.j.id === F1);
r = await reg(U.owner_b, S1, null, "DOCUMENTO", pathB("contrato.pdf"), "application/pdf", 2000);
ok("registra contrato PDF", r.ok, r.msg);
r = await reg(U.owner_b, S1, null, "DOCUMENTO", pathB("exe.bin"), "application/pdf", 10);
ok("tipo real do storage manda (cliente mentiu PDF, é executável) => recusado", !r.ok && /não aceito/.test(r.msg), r.msg);
r = await reg(U.owner_b, S1, null, "FOTO", pathB("grande.png"), "image/png", 1);
ok("foto acima de 8 MB recusada pelo tamanho REAL do storage (cliente disse 1 byte)", !r.ok && /fora do limite/.test(r.msg), r.msg);
r = await reg(U.owner_b, S1, null, "FOTO", pathB("foto-pdf.pdf"), "image/png", 100);
ok("foto que na verdade é PDF recusada", !r.ok && /JPG, PNG/.test(r.msg), r.msg);
r = await reg(U.owner_b, S1, null, "FOTO", pathB("nao-existe.png"), "image/png", 100);
ok("arquivo que não existe no storage recusado (sem vínculo órfão)", !r.ok && /não encontrado/.test(r.msg), r.msg);
r = await reg(U.owner_b, S1, null, "FOTO", `${A}/outra.png`, "image/png", 100);
ok("caminho de OUTRA empresa recusado", !r.ok && /outra empresa/.test(r.msg), r.msg);
r = await reg(U.gestor_b, S1, null, "FOTO", pathB("fachada.png"), "image/png", 1000);
ok("gestor com fornecedores.anexos registra (retry idempotente)", r.ok);
r = await reg(U.fin_b, S1, null, "DOCUMENTO", pathB("contrato.pdf"), "application/pdf", 2000);
ok("sem fornecedores.anexos não registra", negado(r), r.msg);
r = await auth(U.fin_b, "select count(*)::int n from public.supplier_files");
ok("sem fornecedores.anexos não lista arquivos (contrato tem acesso próprio)", r.ok && r.rows[0].n === 0);
r = await auth(U.owner_a, `select count(*)::int n from public.supplier_files where company_id='${B}'`);
ok("A não lista arquivos da B", r.ok && r.rows[0].n === 0);
await objeto(pathB("fachada2.png"), { mimetype: "image/png", size: 500 });
r = await reg(U.owner_b, S1, null, "FOTO", pathB("fachada2.png"), "image/png", 500, "Nova", "Fachada", true);
ok("nova fachada principal desmarca a anterior (uma só principal)", r.ok && (await q(`select count(*)::int n from public.supplier_files where supplier_id='${S1}' and is_primary and removed_at is null`))[0].n === 1);
r = await rpc(U.owner_b, "remove_supplier_file", `'${F1}'`);
ok("retirar marca removido, NÃO apaga registro nem objeto", r.ok && (await q(`select count(*)::int n from public.supplier_files where id='${F1}' and removed_at is not null`))[0].n === 1 && (await q(`select count(*)::int n from storage.objects where name='${pathB("fachada.png")}'`))[0].n === 1);
r = await rpc(U.owner_a, "remove_supplier_file", `'${F1}'`);
ok("A não retira arquivo da B", !r.ok && /não encontrado/.test(r.msg));
// políticas do storage
r = await auth(U.gestor_b, `insert into storage.objects (bucket_id, name) values ('supplier-files','${pathB("up-gestor.png")}')`);
ok("storage: gestor com anexos grava no caminho da própria empresa", r.ok, r.msg);
r = await auth(U.gestor_b, `insert into storage.objects (bucket_id, name) values ('supplier-files','${A}/invasao.png')`);
ok("storage: não grava no caminho de outra empresa", negado(r), r.msg);
r = await auth(U.fin_b, `insert into storage.objects (bucket_id, name) values ('supplier-files','${pathB("up-fin.png")}')`);
ok("storage: sem fornecedores.anexos não grava", negado(r), r.msg);
r = await auth(U.gestor_b, `select count(*)::int n from storage.objects where bucket_id='supplier-files'`);
ok("storage: gestor lê só os objetos da própria empresa", r.ok && r.rows[0].n >= 6 && (await auth(U.gestor_b, `select count(*)::int n from storage.objects where name like '${A}/%'`)).rows[0].n === 0);
r = await auth(U.fin_b, `select count(*)::int n from storage.objects where bucket_id='supplier-files'`);
ok("storage: sem anexos não lê nada", r.ok && r.rows[0].n === 0);
r = await auth(U.owner_b, `delete from storage.objects where name='${pathB("contrato.pdf")}'`);
ok("storage: usuário não apaga objeto (evidência preservada)", (await q(`select count(*)::int n from storage.objects where name='${pathB("contrato.pdf")}'`))[0].n === 1);

log("\n# 8. Avaliação: cotação, promoção com arquivos, vínculo a existente");
const payloadC = { trade_name: "Moinho Sintético", legal_name: "Moinho Ltda", contact_name: "Renato", phone: "7199", city: "Xinguara", state: "PA", products: ["Farinha de milho", "Granola"], category_ids: [catB["Temperos e ingredientes"]] };
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(100)}', ${J(payloadC)}`);
const C1 = r.j?.id;
ok("avaliação registrada (rpc da migration anterior continua válida com as chaves novas)", r.ok, r.msg);
r = await rpc(U.leitor_b, "register_supplier_candidate", `'${cmd(101)}', ${J(payloadC)}`);
ok("leitor despesas.read não registra avaliação (agora exige fornecedores.manage)", negado(r), r.msg);
r = await rpc(U.fin_b, "search_supplier_candidates", `'granola', null, null, 10, 0`);
ok("fornecedores.read busca por produto declarado", r.ok && r.j.total === 1, r.msg);
r = await rpc(U.sem_perm_b, "search_supplier_candidates", `'granola', null, null, 10, 0`);
ok("sem fornecedores.read: busca de avaliações negada", negado(r), r.msg);
r = await rpc(U.owner_b, "add_candidate_quote", `'${C1}', ${J({ item: "Farinha de milho", unit: "kg", quantity: 100, price_cents: 450, freight_cents: 18000, valid_until: "2026-12-20", source: "e-mail" })}`);
ok("registra cotação (estimativa)", r.ok, r.msg);
r = await rpc(U.owner_b, "add_candidate_quote", `'${C1}', ${J({ item: "", unit: "kg", quantity: 1, price_cents: 1 })}`);
ok("cotação sem item recusada", !r.ok);
r = await rpc(U.owner_b, "add_candidate_quote", `'${C1}', ${J({ item: "x", unit: "kg", quantity: 0, price_cents: 1 })}`);
ok("cotação com quantidade 0 recusada", !r.ok);
r = await rpc(U.owner_a, "add_candidate_quote", `'${C1}', ${J({ item: "x", unit: "kg", quantity: 1, price_cents: 1 })}`);
ok("A não cota avaliação da B", !r.ok && /não encontrada/.test(r.msg), r.msg);
ok("cotação não cria compra/título: expense_launches e expenses seguem vazios", (await q("select (select count(*)::int from public.expense_launches) + (select count(*)::int from public.expenses) n"))[0].n === 0);
ok("cotação entra no histórico da avaliação (kind COTACAO)", (await q(`select count(*)::int n from public.supplier_candidate_contacts where candidate_id='${C1}' and kind='COTACAO'`))[0].n === 1);
await objeto(pathB("catalogo.pdf"), { mimetype: "application/pdf", size: 3000 });
r = await reg(U.owner_b, null, C1, "REFERENCIA", pathB("catalogo.pdf"), "application/pdf", 3000);
const CF = r.j?.id;
ok("arquivo de referência da avaliação registrado", r.ok, r.msg);
r = await reg(U.owner_b, null, C1, "FOTO", pathB("fachada2.png"), "image/png", 500);
ok("foto não pertence a avaliação", !r.ok);
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${C1}', null, ${J(base({ trade_name: "Moinho Sintético", company_name: "Moinho Ltda", cnpj: "77.888.999/0001-10", category_ids: [catB["Embalagens"]] }))}`);
const SC = r.j?.supplier_id;
ok("promoção cria fornecedor completo (created=true)", r.ok && r.j.created === true, r.msg);
ok("categorias da avaliação + do formulário vinculadas (2)", (await q(`select count(*)::int n from public.supplier_category_links where supplier_id='${SC}'`))[0].n === 2);
ok("arquivo da avaliação passa a valer para o fornecedor, mantendo a origem (candidate_id)", (await q(`select count(*)::int n from public.supplier_files where id='${CF}' and supplier_id='${SC}' and candidate_id='${C1}'`))[0].n === 1);
ok("avaliação preservada: primeira data, cotação, produtos e histórico", (await q(`select count(*)::int n from public.supplier_candidates c where c.id='${C1}' and c.stage='CADASTRADO' and c.linked_supplier_id='${SC}' and c.first_registered_at is not null and exists (select 1 from public.supplier_candidate_quotes where candidate_id=c.id) and exists (select 1 from public.supplier_candidate_products where candidate_id=c.id)`))[0].n === 1);
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${C1}', null, ${J(base({ cnpj: "77.888.999/0001-10" }))}`);
ok("retentativa devolve o MESMO fornecedor (sem duplicar)", r.ok && r.j.replayed === true && r.j.supplier_id === SC);
ok("promoção sem compra/saldo/título", (await q("select (select count(*)::int from public.expense_launches) + (select count(*)::int from public.expenses) n"))[0].n === 0);
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(102)}', ${J({ trade_name: "Duplicata Doc" })}`);
const C2 = r.j.id;
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${C2}', null, ${J(base({ cnpj: "77.888.999/0001-10", trade_name: "Duplicata" }))}`);
ok("promoção com documento já cadastrado => DUPLICADO:<id>", !r.ok && r.msg.includes("DUPLICADO:" + SC), r.msg);
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${C2}', '${SC}', '{}'::jsonb`);
ok("vincular ao fornecedor existente (sem criar outro)", r.ok && r.j.created === false && r.j.supplier_id === SC, r.msg);
r = await rpc(U.owner_b, "register_supplier_candidate", `'${cmd(103)}', ${J({ trade_name: "Cross" })}`);
r = await rpc(U.owner_b, "convert_candidate_to_supplier", `'${r.j.id}', '${LA}', '{}'::jsonb`);
ok("não vincula a fornecedor de OUTRA empresa", !r.ok && /não encontrado/.test(r.msg), r.msg);
ok("evento supplier_candidate.converted registrado", (await q(`select count(*)::int n from public.supplier_events where event_type='supplier_candidate.converted'`))[0].n >= 2);
ok("eventos media.changed registrados", (await q(`select count(*)::int n from public.supplier_events where event_type='media.changed'`))[0].n >= 4);

log("\n# 9. Posição financeira (fonte: expense_launches + expenses), dados sintéticos");
const hoje = (await q(`select (now() at time zone 'America/Belem')::date::text d`))[0].d;
const dia = (n) => `('${hoje}'::date + (${n}))`;
const lanc = async (emp, sup, status, total, emissao, usr) => (await q(`insert into public.expense_launches (company_id, kind, party_type, party_name, supplier_id, competence, total_amount, document_issue_date, status, document_ref) values ('${emp}','expense','supplier','x','${sup}',${emissao},${total},${emissao},'${status}','NF-${Math.floor(Math.random() * 1e6)}') returning id`))[0].id;
const parc = async (emp, launch, n, cnt, amount, due, status, paidAt, paidAmount, usr) =>
  q(`insert into public.expenses (company_id, description, amount, status, due_date, paid_at, paid_amount, launch_id, installment_number, installment_count, created_by) values ('${emp}','p',${amount},'${status}',${due},${paidAt ? paidAt : "null"},${paidAmount ?? "null"},'${launch}',${n},${cnt},'${U.owner_b}')`);
const L1 = await lanc(B, S1, "ABERTO", 1000, dia(-40));
await parc(B, L1, 1, 2, 500, dia(-20), "PAGO", `(${dia(-21)})::timestamptz + interval '12 hours'`, 500); // em dia (pago 1 dia antes)
await parc(B, L1, 2, 2, 500, dia(-5), "ABERTO", null, null); // vencida
const L2 = await lanc(B, S1, "ABERTO", 600, dia(-10));
await parc(B, L2, 1, 2, 300, dia(0), "ABERTO", null, null); // vence hoje
await parc(B, L2, 2, 2, 300, dia(15), "AGENDADO", null, null); // a vencer, agendada
const L3 = await lanc(B, S1, "ABERTO", 200, dia(-60));
await parc(B, L3, 1, 1, 200, dia(-50), "PAGO", `(${dia(-45)})::timestamptz + interval '12 hours'`, 200); // atrasada (pago 5 dias após)
await lanc(B, S1, "RASCUNHO", 9999, dia(-2)); // fora das somas
const L4 = await lanc(B, S2, "ABERTO", 5000, dia(-30));
await parc(B, L4, 1, 1, 5000, dia(10), "ABERTO", null, null);
const LAx = await lanc(A, LA, "ABERTO", 7777, dia(-30));
await parc(A, LAx, 1, 1, 7777, dia(-1), "ABERTO", null, null);
await db.exec(`insert into public.expense_launch_items (launch_id, kind, name_snapshot, unit, quantity, unit_price, amount) values ('${L1}','stock','Farinha','kg',10,50,500),('${L1}','stock','Embalagem','un',100,5,500),('${L2}','stock','Farinha','kg',20,30,600)`);
r = await rpc(U.fin_b, "supplier_financial_summary", `'${S1}', null, null`);
const f = r.j;
ok("fornecedores.financeiro lê a ficha financeira", r.ok, r.msg);
ok("comprado = soma de lançamentos confirmados (1000+600+200 = R$1.800,00); rascunho FORA", f.purchased.total_cents === 180000 && f.purchased.count === 3, JSON.stringify(f.purchased));
ok("pago por data da baixa (500+200 = R$700,00)", f.paid.all_time_cents === 70000 && f.paid.period_cents === 70000, JSON.stringify(f.paid));
ok("em aberto = 500+300+300 = R$1.100,00 (posição atual, todos os períodos)", f.open.total_cents === 110000 && f.open.count === 3, JSON.stringify(f.open));
ok("vencido R$500,00 (due < hoje); vence hoje R$300,00 separado; futuro não é atraso", f.open.overdue_cents === 50000 && f.open.due_today_cents === 30000);
ok("agendado continua em aberto (não é pago)", f.open.titles.some((t) => t.status === "AGENDADO" && t.balance_cents === 30000));
ok("pontualidade: 2 quitados, 1 em dia, 1 atrasado => 50%", f.punctuality.settled === 2 && f.punctuality.on_time === 1 && f.punctuality.late === 1 && f.punctuality.pct === 50, JSON.stringify(f.punctuality));
ok("rascunho aparece identificado e fora da soma (counted=false)", f.purchases.some((p) => p.state === "RASCUNHO" && p.counted === false));
ok("ranking: S1 em 2º (S2 comprou mais: 5000)", f.purchased.rank === 2 && f.purchased.ranked_suppliers === 2, JSON.stringify(f.purchased));
ok("itens: Farinha agregada por unidade (30 kg, R$ 11,00) em 1º", f.items[0].name === "Farinha" && Number(f.items[0].quantity) === 30 && f.items[0].value_cents === 110000);
ok("prazos: contratado e efetivo calculados (ponderados por valor)", Number.isInteger(f.terms.contracted_avg_days) && Number.isInteger(f.terms.effective_avg_days), JSON.stringify(f.terms));
ok("série mensal presente com meses sem movimento = 0 real", Array.isArray(f.monthly) && f.monthly.length >= 2);
ok("indisponíveis declarados (adiantamentos, estornos, juros, devolução, cancelamento), nunca zero falso", ["credits_advances", "reversals", "returns"].every((k) => f.unavailable.includes(k)));
r = await rpc(U.fin_b, "supplier_financial_summary", `'${S1}', '${hoje}'::date - 30, '${hoje}'::date`);
ok("filtro de período: comprado só do período (600+... emissões <=30d), aberto continua posição atual", r.ok && r.j.purchased.total_cents === 60000 && r.j.open.total_cents === 110000 && r.j.purchased.all_time_cents === 180000, JSON.stringify(r.j?.purchased));
r = await rpc(U.fin_b, "list_suppliers_financial", `null, null`);
const linhaS1 = r.j.rows.find((x) => x.supplier_id === S1);
ok("lista financeira: linha do S1 bate com a ficha", r.ok && linhaS1.purchased_cents === 180000 && linhaS1.open_cents === 110000 && linhaS1.overdue_cents === 50000 && linhaS1.paid_cents === 70000 && linhaS1.rank === 2, JSON.stringify(linhaS1));
ok("lista financeira: fornecedor sem compra tem 0 compras e rank nulo (só da empresa B)", r.j.rows.every((x) => x.supplier_id !== LA) && r.j.rows.find((x) => x.supplier_id === S3).rank === null);
r = await rpc(U.owner_a, "supplier_financial_summary", `'${S1}', null, null`);
ok("A não lê financeiro de fornecedor da B", !r.ok && /não encontrado/.test(r.msg), r.msg);
r = await rpc(U.owner_a, "list_suppliers_financial", `null, null`);
ok("A lista só a própria empresa (R$77,77 em aberto de LA)", r.ok && r.j.rows.length === (await q(`select count(*)::int n from public.suppliers where company_id='${A}'`))[0].n && r.j.rows.find((x) => x.supplier_id === LA).open_cents === 777700);
r = await rpc(U.gestor_b, "supplier_financial_summary", `'${S1}', null, null`);
ok("gestor sem fornecedores.financeiro: acesso restrito", negado(r), r.msg);
r = await rpc(U.sem_perm_b, "list_suppliers_financial", `null, null`);
ok("sem permissão: lista financeira negada", negado(r), r.msg);

log("\n# 10. Exportação");
r = await rpc(U.gestor_b, "list_suppliers_export", `array['${S1}','${LA}']::uuid[]`);
ok("exporta só ids da própria empresa (LA da empresa A é ignorado)", r.ok && r.j.rows.length === 1 && r.j.rows[0].id === S1, r.msg);
ok("exportação não traz banco/Pix", !JSON.stringify(r.j).match(/pix|account|beneficiary/i));
r = await rpc(U.fin_b, "list_suppliers_export", `array['${S1}']::uuid[]`);
ok("sem fornecedores.exportar: negado", negado(r), r.msg);

log("\n# 10b. Rascunho persistente do formulário");
r = await rpc(U.gestor_b, "save_supplier_draft", `null, null, 0, ${J({ trade_name: "Rascunho", cnpj: "11", pix_key: "NAO-GUARDAR", bank: "NAO", beneficiary_name: "NAO", account: "NAO" })}`);
ok("gestor salva rascunho de novo cadastro (versão 1)", r.ok && r.j.version === 1, r.msg);
const dr = (await q(`select payload::text p from public.supplier_drafts where user_id='${U.gestor_b}'`))[0].p;
ok("servidor descarta chaves de banco/Pix do rascunho", !/NAO|pix|bank|account|beneficiary/i.test(dr) && /Rascunho/.test(dr), dr);
r = await rpc(U.gestor_b, "save_supplier_draft", `null, null, 0, ${J({ trade_name: "Aba 2" })}`);
ok("segunda aba com versão velha => CONFLITO_REVISAO (sem sobrescrita silenciosa)", !r.ok && /CONFLITO_REVISAO/.test(r.msg), r.msg);
r = await rpc(U.gestor_b, "save_supplier_draft", `null, null, 1, ${J({ trade_name: "Rascunho v2" })}`);
ok("versão correta atualiza (versão 2)", r.ok && r.j.version === 2);
r = await rpc(U.gestor_b, "get_supplier_draft", `null, null`);
ok("recupera o rascunho salvo", r.ok && r.j.payload.trade_name === "Rascunho v2" && r.j.version === 2);
r = await rpc(U.owner_b, "get_supplier_draft", `null, null`);
ok("rascunho é por pessoa: outra pessoa da empresa não vê o do gestor", r.ok && r.j === null);
r = await auth(U.owner_b, "select count(*)::int n from public.supplier_drafts");
ok("RLS: leitura direta só do próprio rascunho", r.ok && r.rows[0].n === 0);
r = await rpc(U.gestor_b, "save_supplier_draft", `'${S1}', null, 0, ${J({ trade_name: "Edição" })}`);
ok("rascunho de edição de fornecedor (alvo separado do novo cadastro)", r.ok && r.j.version === 1, r.msg);
r = await rpc(U.owner_a, "save_supplier_draft", `'${S1}', null, 0, ${J({ trade_name: "x" })}`);
ok("A não cria rascunho para fornecedor da B", !r.ok && /não encontrado/.test(r.msg), r.msg);
r = await rpc(U.fin_b, "save_supplier_draft", `null, null, 0, ${J({ trade_name: "x" })}`);
ok("sem fornecedores.manage não salva rascunho", negado(r), r.msg);
await rpc(U.gestor_b, "discard_supplier_draft", `null, null`);
ok("descartar remove o rascunho", (await rpc(U.gestor_b, "get_supplier_draft", `null, null`)).j === null);

log("\n# 11. GRANT/REVOKE");
const fns = ["create_supplier(uuid,jsonb)", "update_supplier(uuid,integer,jsonb)", "set_supplier_active(uuid,boolean,integer)", "find_supplier_by_document(text,uuid)", "get_supplier_bank_details(uuid,boolean)", "set_supplier_bank_details(uuid,jsonb)", "verify_supplier_bank_details(uuid)", "register_supplier_file(uuid,uuid,text,text,text,text,bigint,text,text,boolean)", "remove_supplier_file(uuid)", "add_candidate_quote(uuid,jsonb)", "list_suppliers_financial(date,date)", "supplier_financial_summary(uuid,date,date)", "list_suppliers_export(uuid[])", "save_supplier_draft(uuid,uuid,integer,jsonb)", "get_supplier_draft(uuid,uuid)", "discard_supplier_draft(uuid,uuid)", "create_supplier_category(text)", "rename_supplier_category(uuid,text)", "set_supplier_category_active(uuid,boolean)", "ensure_default_supplier_categories()", "convert_candidate_to_supplier(uuid,uuid,jsonb)"];
const priv = await q(`select p.oid::regprocedure::text f, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u, has_function_privilege('public', p.oid, 'execute') pu from pg_proc p where p.oid = any(array[${fns.map((x) => `'public.${x}'::regprocedure`).join(",")}])`);
ok("21 RPCs existem", priv.length === 21);
ok("anon e public sem EXECUTE em todas", priv.every((x) => !x.a && !x.pu));
ok("authenticated com EXECUTE em todas", priv.every((x) => x.u));
for (const fn of ["create_supplier", "get_supplier_bank_details", "list_suppliers_financial", "supplier_financial_summary"]) {
  const args = { create_supplier: `'${cmd(9)}', '{}'::jsonb`, get_supplier_bank_details: `'${S1}', false`, list_suppliers_financial: "null, null", supplier_financial_summary: `'${S1}', null, null` }[fn];
  r = await como(null, "anon", `select public.${fn}(${args})`);
  ok(`anon chamando ${fn}: permission denied`, negado(r), r.msg);
}
const priv2 = await q(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname ~ '^supplier_(clean|validate|mask|changed_fields|create_core|sync_children|emit|tz|company_for)$' and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`);
ok("funções internas private.supplier_* sem EXECUTE para authenticated e anon", priv2.length === 0, JSON.stringify(priv2));
const tg = await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_name in ('suppliers','supplier_contacts','supplier_bank_details','supplier_files','supplier_candidate_quotes','supplier_events','supplier_drafts') and grantee in ('anon','authenticated')`);
ok("tabelas: authenticated só SELECT; anon nada", tg.filter((g) => g.grantee === "authenticated").every((g) => g.privilege_type === "SELECT") && tg.filter((g) => g.grantee === "anon").length === 0, JSON.stringify(tg.filter((g) => g.privilege_type !== "SELECT").slice(0, 4)));
ok("bucket supplier-files é privado", (await q("select public p from storage.buckets where id='supplier-files'"))[0].p === false);

log("\n# 12. Reversão");
await db.exec(REV2);
ok("reversão executa", true);
ok("colunas novas de suppliers removidas, fornecedores preservados", (await q("select count(*)::int n from information_schema.columns where table_name='suppliers' and column_name in ('revision','latitude','active','document_key')"))[0].n === 0 && (await q("select count(*)::int n from public.suppliers"))[0].n >= antesSup);
ok("tabelas novas removidas", (await q("select count(*)::int n from pg_tables where schemaname='public' and tablename in ('supplier_contacts','supplier_bank_details','supplier_files','supplier_candidate_quotes','supplier_events')"))[0].n === 0);
ok("permissões fornecedores.* removidas", (await q("select count(*)::int n from public.permissions where key like 'fornecedores.%'"))[0].n === 0);
r = await rpc(U.leitor_b, "register_supplier_candidate", `'${cmd(200)}', ${J({ trade_name: "Volta despesas" })}`);
ok("RPCs da migration anterior voltaram às versões originais (despesas.manage)", negado(r), r.msg);
r = await rpc(U.legado_b, "register_supplier_candidate", `'${cmd(201)}', ${J({ trade_name: "Volta despesas" })}`);
ok("e funcionam com despesas.manage", r.ok, r.msg);
r = await auth(U.sem_perm_b, "select count(*)::int n from public.suppliers");
ok("policy original de suppliers restaurada (membro ativo lê) — mudança de segurança desfeita", r.ok && r.rows[0].n >= 1);
await db.exec(REV2);
ok("reversão idempotente (2ª execução sem erro)", true);
await db.exec(MIG2);
ok("reaplicar o complemento depois da reversão funciona", (await q("select count(*)::int n from public.permissions where key like 'fornecedores.%'"))[0].n === 9);

await db.close();
log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
process.exit(falhas === 0 ? 0 : 1);
