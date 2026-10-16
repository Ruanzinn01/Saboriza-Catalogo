// Testes da segurança de CPF, RG e telefone no banco RECONSTRUÍDO (PGlite) a partir da trilha de migrações.
// NÃO é homologação: sem PostgREST/Auth reais. Privilégios, RLS e funções são os do Postgres; "permission denied" aqui é o que a API devolve.
// Ordem provada: trilha -> salário/Pix fase 1 e 2 (pré-requisito) -> CPF fase 1 -> CPF fase 2 -> reversões.
// Uso: PGLITE_DIR=<pasta com @electric-sql/pglite> node supabase/pendentes/testes_seguranca_cpf_rg_telefone.mjs [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const SAL1 = read("supabase/pendentes/seguranca_salario_pix_1_aditiva.sql");
const SAL2 = read("supabase/pendentes/seguranca_salario_pix_2_restritiva.sql");
const F1 = read("supabase/pendentes/seguranca_cpf_rg_telefone_1_aditiva.sql");
const F2 = read("supabase/pendentes/seguranca_cpf_rg_telefone_2_restritiva.sql");
const R1 = read("supabase/pendentes/seguranca_cpf_rg_telefone_reverter_1.sql");
const R2 = read("supabase/pendentes/seguranca_cpf_rg_telefone_reverter_2.sql");
const ASSINATURAS = read("supabase/baseline/assinaturas.sql");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = {
  owner_a: "00000000-0000-0000-0000-0000000000a1", plain_a: "00000000-0000-0000-0000-0000000000a2",
  restr_a: "00000000-0000-0000-0000-0000000000a4", owner_b: "00000000-0000-0000-0000-0000000000b1",
  doc_read: "00000000-0000-0000-0000-0000000000d1", doc_mgr: "00000000-0000-0000-0000-0000000000d2",
  rem_read: "00000000-0000-0000-0000-0000000000d3", desp_new: "00000000-0000-0000-0000-0000000000d4",
};
const E = { a1: "eeeeeeee-0000-0000-0000-0000000000a1", a2: "eeeeeeee-0000-0000-0000-0000000000a2", b1: "eeeeeeee-0000-0000-0000-0000000000b1" };
const CPF1 = "52998224725", CPF2 = "11144477735", CPF_NOVO = "39053344705"; // CPFs sintéticos com dígitos verificadores válidos

const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };

async function montar() {
  const db = await criarBanco();
  const falhasReplay = await reaplicar(db, null, log);
  const q = async (sql) => (await db.query(sql)).rows;
  async function como(uid, role, sql) {
    await db.exec(`select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, role }) : ""}', false); set role ${role};`);
    try { const r = await db.query(sql); return { ok: true, rows: r.rows, afetadas: r.affectedRows }; }
    catch (e) { return { ok: false, code: e.code, msg: e.message }; }
    finally { await db.exec("reset role;"); }
  }
  const auth = (uid, sql) => como(uid, "authenticated", sql);
  await db.exec(`
    insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a'),('${B}','Empresa B','INDUSTRY','empresa-b');
    insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(",")};`);
  async function criarPapel(uid, empresa, chave, perms) {
    const role = crypto.randomUUID(), mem = crypto.randomUUID();
    await db.exec(`
      insert into public.roles (id, company_id, key, name) values ('${role}','${empresa}','${chave}','${chave}');
      insert into public.role_permissions (company_id, role_id, permission_key) select '${empresa}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
      insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${empresa}','${uid}','ACTIVE');
      insert into public.membership_roles (company_id, membership_id, role_id) values ('${empresa}','${mem}','${role}');`);
  }
  const todas = (await q("select key from public.permissions where key <> 'separa_confere.operar'")).map((r) => r.key);
  await criarPapel(U.owner_a, A, "proprietario_a", todas);
  await criarPapel(U.owner_b, B, "proprietario_b", todas);
  await criarPapel(U.plain_a, A, "membro_comum", ["despesas.read", "tarefas.read", "estoque.movimentar"]);
  await criarPapel(U.restr_a, A, "operador_restrito", ["separa_confere.operar"]);
  await db.exec(`
    insert into public.employees (id, company_id, code, name, status, admission_date, salary_base, pix_key, cpf, rg, rg_issuer, phone, emergency_phone, timesheet_enabled) values
     ('${E.a1}','${A}','A1','Colaborador A1','ATIVO','2026-01-05',5000,'a1@pix.com','${CPF1}','1234567','SSP-BA','71999990001','71988880001',true),
     ('${E.a2}','${A}','A2','Colaborador A2','ATIVO','2026-01-05',3000,null,'${CPF2}','7654321','SSP-BA','71999990002',null,true),
     ('${E.b1}','${B}','B1','Colaborador B1','ATIVO','2026-01-05',7000,'b1@pix.com','33333333333','999','SSP-SP','11999990003',null,true);`);
  return { db, q, como, auth, criarPapel, falhasReplay };
}

const { db, q, como, auth, criarPapel, falhasReplay } = await montar();
const negado = (r) => !r.ok && (r.code === "42501" || /permission denied|row-level security/i.test(r.msg ?? ""));
const COLS = ["cpf", "rg", "rg_issuer", "phone", "emergency_phone"];

async function snap() {
  const m = Object.fromEntries((await q(ASSINATURAS)).map((r) => [r.k, r.h]));
  const colGrants = (await q("select md5(coalesce(string_agg(column_name||':'||grantee||':'||privilege_type, '|' order by column_name, grantee, privilege_type), '')) h from information_schema.column_privileges where table_schema='public' and table_name='employees' and grantee in ('anon','authenticated')"))[0].h;
  const perms = (await q("select (select count(*) from public.permissions where key like 'colaboradores.documentos.%')::text a, (select count(*) from public.role_permissions where permission_key like 'colaboradores.documentos.%')::text b"))[0];
  return { grants: m.grants_tabelas, politicas: m.politicas_definicao, funcoes: m.funcoes_corpo, colGrants, permissoes: `${perms.a}/${perms.b}` };
}
const diff = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);

log("# Reconstruindo o banco a partir de supabase/migrations");
ok("trilha reaplicada sem falha", falhasReplay.length === 0);

log("\n# 1. ESTADO ATUAL (equivalente a produção): o que um membro SEM papel de RH consegue hoje");
let r = await auth(U.plain_a, `select cpf, rg, phone from public.employees where company_id = '${A}'`);
ok("membro comum LÊ CPF, RG e telefone de todos os colaboradores da empresa", r.ok && r.rows.length === 2 && r.rows[0].cpf, `${r.rows?.length} linhas`);
r = await auth(U.plain_a, `update public.employees set cpf = '${CPF_NOVO}', phone = '1' where id = '${E.a2}'`);
ok("membro comum ALTERA CPF e telefone direto na tabela", r.ok && r.afetadas === 1);
await db.exec(`update public.employees set cpf = '${CPF2}', phone = '71999990002' where id = '${E.a2}'`);

// pré-requisito: salário/Pix 1 e 2
await db.exec(SAL1);
await db.exec(SAL2);
const aposSalario = await snap();

log("\n# 2. FASE 1 (aditiva): não pode mudar comportamento existente");
await db.exec(F1);
const aposF1 = await snap();
const mudou = diff(aposSalario, aposF1).filter((k) => k !== "permissoes" && k !== "funcoes");
ok("nenhum grant, política ou grant de coluna existente mudou", mudou.length === 0, mudou.join(", "));
r = await auth(U.plain_a, `select cpf, rg, phone from public.employees where company_id = '${A}'`);
ok("o membro comum continua lendo como antes (fase 1 não restringe)", r.ok && r.rows.length === 2);

const cont = async (chaves) => (await q(`select count(*)::int n from public.role_permissions rp join public.roles ro on ro.id=rp.role_id where ro.key in (${chaves.map((c) => `'${c}'`).join(",")}) and rp.permission_key like 'colaboradores.documentos.%'`))[0].n;
ok("Proprietários (47 permissões, incluem despesas.manage) receberam as 2 permissões; membro comum e operador restrito, nenhuma",
  (await cont(["proprietario_a", "proprietario_b"])) === 4 && (await cont(["membro_comum", "operador_restrito"])) === 0);

await criarPapel(U.doc_read, A, "docs_leitura", ["colaboradores.documentos.read"]);
await criarPapel(U.doc_mgr, A, "docs_gestao", ["colaboradores.documentos.manage"]);
await criarPapel(U.rem_read, A, "rh_remuneracao_leitura", ["colaboradores.remuneracao.read"]);
await criarPapel(U.desp_new, A, "despesas_novo", ["despesas.read"]);

r = await auth(U.plain_a, `select * from public.get_employee_personal_data('${E.a1}')`);
ok("leitura por RPC: nega o membro comum", !r.ok && /Sem permissão/.test(r.msg), r.msg);
r = await auth(U.restr_a, `select * from public.get_employee_personal_data('${E.a1}')`);
ok("leitura por RPC: nega o operador restrito", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.desp_new, `select * from public.get_employee_personal_data('${E.a1}')`);
ok("leitura por RPC: nega quem só tem despesas.read", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.owner_a, `select * from public.get_employee_personal_data('${E.a1}')`);
ok("leitura por RPC: atende o Proprietário", r.ok && r.rows[0].cpf === CPF1 && r.rows[0].phone === "71999990001" && r.rows[0].rg === "1234567");
r = await auth(U.owner_a, `select * from public.get_employee_personal_data('${E.b1}')`);
ok("leitura por RPC: não cruza empresas", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.doc_read, `select * from public.get_employee_personal_data('${E.a1}')`);
ok("papel só de leitura de documentos lê", r.ok);
r = await auth(U.rem_read, `select * from public.get_employee_personal_data('${E.a1}')`);
ok("papel de RH-remuneração criado DEPOIS da aplicação não herda a leitura de documentos", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.doc_read, `select public.set_employee_personal_data('${E.a1}', '{"phone":"71900000000"}'::jsonb)`);
ok("papel só de leitura NÃO altera", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.plain_a, `select count(*)::int n from public.list_employee_personal_data()`);
ok("lista em lote nega o membro comum", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.doc_read, `select count(*)::int n from public.list_employee_personal_data()`);
ok("lista em lote devolve só a empresa do usuário", r.ok && r.rows[0].n === 2, `${r.rows?.[0]?.n}`);

r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{"cpf":"123.456.789-00"}'::jsonb)`);
ok("CPF inválido é recusado", !r.ok && /CPF_INVALIDO/.test(r.msg), r.msg);
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{"cpf":"${CPF2}"}'::jsonb)`);
ok("CPF de outro colaborador da mesma empresa é recusado (duplicidade)", !r.ok && /CPF_DUPLICADO/.test(r.msg), r.msg);
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{"phone":"123"}'::jsonb)`);
ok("telefone curto demais é recusado", !r.ok && /TELEFONE_INVALIDO/.test(r.msg));
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{"salary_base": 1}'::jsonb)`);
ok("campo fora da lista (salário) é recusado por esta função", !r.ok && /não permitido/.test(r.msg));
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{}'::jsonb)`);
ok("alteração vazia é recusada", !r.ok && /Informe/.test(r.msg));
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.b1}', '{"phone":"71900000000"}'::jsonb)`);
ok("papel da empresa A não altera colaborador da empresa B", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{"cpf":"${CPF_NOVO.slice(0, 3)}.${CPF_NOVO.slice(3, 6)}.${CPF_NOVO.slice(6, 9)}-${CPF_NOVO.slice(9)}","phone":" 71 98888-7777 ","rg":"9988776"}'::jsonb, 'Correção de cadastro')`);
const lido = (await q(`select cpf, phone, rg from public.employees where id='${E.a1}'`))[0];
ok("gestão de documentos altera; CPF vem normalizado só com dígitos e telefone aparado", r.ok && lido.cpf === CPF_NOVO && lido.phone === "71 98888-7777" && lido.rg === "9988776", JSON.stringify(lido));
const aud = (await q(`select payload::text p from public.audit_events where event_type='employee.personal_data_changed' order by recorded_at desc limit 5`)).map((x) => x.p).join("\n");
ok("auditoria: só máscara + impressão curta, nunca o valor inteiro", /impressao/.test(aud) && !aud.includes(CPF_NOVO) && !aud.includes(CPF1) && !aud.includes("71 98888-7777") && !aud.includes("9988776") && !aud.includes("1234567"), aud.slice(0, 160));
ok("auditoria registra campos alterados e motivo", /"fields"/.test(aud) && /Correção de cadastro/.test(aud));
const antes = (await q("select count(*)::int n from public.audit_events where event_type='employee.personal_data_changed'"))[0].n;
await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{"phone":"71 98888-7777"}'::jsonb)`);
ok("regravar o mesmo valor não gera auditoria nova", (await q("select count(*)::int n from public.audit_events where event_type='employee.personal_data_changed'"))[0].n === antes);
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('${E.a1}', '{"emergency_phone":""}'::jsonb)`);
ok("valor vazio limpa o campo (null)", r.ok && (await q(`select emergency_phone from public.employees where id='${E.a1}'`))[0].emergency_phone === null);
await db.exec(`update public.employees set cpf='${CPF1}', phone='71999990001', rg='1234567', emergency_phone='71988880001' where id='${E.a1}'`);

const antesF2 = await snap();

log("\n# 3. FASE 2 (restritiva)");
await db.exec(F2);
for (const col of COLS) {
  r = await auth(U.plain_a, `select ${col} from public.employees`);
  ok(`leitura de ${col}: NEGADA ao membro comum`, negado(r), r.msg);
}
r = await auth(U.owner_a, "select cpf from public.employees");
ok("nem o Proprietário lê CPF direto na tabela (só pela RPC)", negado(r));
r = await auth(U.plain_a, "select * from public.employees");
ok("select * (front antigo) agora FALHA — o front novo precisa listar colunas", negado(r));
r = await auth(U.plain_a, "select id, code, name, email, role, department, status, birth_date, city, timesheet_enabled from public.employees");
ok("colunas não sensíveis continuam legíveis", r.ok && r.rows.length === 2);
r = await auth(U.plain_a, `select 1 from public.employees where cpf = '${CPF1}'`);
ok("filtrar por CPF na API (inferência por where) também é NEGADO", negado(r), r.msg);
r = await auth(U.plain_a, `update public.employees set cpf = '${CPF_NOVO}' where id = '${E.a2}'`);
ok("escrita de CPF direto: NEGADA", negado(r));
r = await auth(U.owner_a, `update public.employees set phone = '1' where id = '${E.a2}'`);
ok("escrita de telefone direto: NEGADA até ao Proprietário", negado(r));
r = await auth(U.plain_a, `update public.employees set name = 'Colaborador A2 (editado)', role = 'Encarregado' where id = '${E.a2}'`);
ok("edição de dados não sensíveis continua permitida", r.ok && r.afetadas === 1);
r = await auth(U.plain_a, `insert into public.employees (company_id, code, name, cpf) values ('${A}','A9','Com CPF','${CPF_NOVO}')`);
ok("INSERT informando CPF: NEGADO", negado(r));
r = await auth(U.plain_a, `insert into public.employees (company_id, code, name, phone) values ('${A}','A9','Com tel','71900000000')`);
ok("INSERT informando telefone: NEGADO", negado(r));
r = await auth(U.owner_a, `insert into public.employees (id, company_id, code, name) values ('eeeeeeee-0000-0000-0000-0000000000a9','${A}','A8','Novo sem documentos') returning id`);
ok("INSERT sem colunas sensíveis continua permitido", r.ok);
r = await auth(U.doc_mgr, `select public.set_employee_personal_data('eeeeeeee-0000-0000-0000-0000000000a9', '{"cpf":"${CPF_NOVO}","phone":"71977776666"}'::jsonb)`);
ok("fluxo de cadastro em dois passos: INSERT sem documentos + gravação pela função", r.ok);
r = await auth(U.owner_a, "select cpf from public.list_employee_personal_data() where cpf is not null");
ok("a função continua lendo todos os campos após a fase 2", r.ok && r.rows.length === 3, `${r.rows?.length}`);
r = await como(null, "anon", "select cpf from public.employees");
ok("anon: sem privilégio", negado(r));
r = await auth(U.restr_a, "select id from public.employees");
ok("operador restrito continua sem ver employees", r.ok && r.rows.length === 0);
r = await como(U.owner_a, "service_role", `select cpf, phone, rg from public.employees where code = 'A1'`);
ok("service_role (funções de borda) continua lendo", r.ok && r.rows.length === 1 && r.rows[0].cpf === CPF1);
r = await auth(U.owner_a, `select salary_base from public.employees`);
ok("regressão: salário segue negado na tabela (fase 2 de salário intacta)", negado(r));
r = await auth(U.owner_a, `select * from public.get_employee_compensation('${E.a1}')`);
ok("regressão: RPC de remuneração segue atendendo", r.ok && Number(r.rows[0].salary_base) === 5000);
r = await auth(U.owner_a, `select public.oris360_emitir_espelho('${E.a1}', '2026-09-01'::date)`);
ok("regressão: Espelho de ponto (DEFINER, usa CPF mascarado) não quebra por permissão de coluna", r.ok || !/permission denied/i.test(r.msg ?? ""), r.ok ? "ok" : r.msg);
const semAcesso = (await q(`select string_agg(column_name, ',' order by column_name) c from information_schema.columns c where table_schema='public' and table_name='employees' and not has_column_privilege('authenticated','public.employees',column_name,'SELECT')`))[0].c;
ok("trava de regressão: as ÚNICAS colunas sem leitura para authenticated são as 8 de salário/Pix + as 5 de documentos/telefone",
  semAcesso === "commission_rate_percent,cpf,emergency_phone,monthly_divisor,phone,pix_key,rg,rg_issuer,salary_additions,salary_base,salary_benefits,salary_effective_date,timesheet_overtime_percent", semAcesso);

log("\n# 4. REVERSÃO");
await db.exec(R2);
const aposR2 = await snap();
const d2 = diff(antesF2, aposR2);
ok("reverter a fase 2 devolve grants, políticas, funções e grants de coluna IDÊNTICOS (hash)", d2.length === 0, d2.join(", "));
r = await auth(U.plain_a, `select cpf, phone from public.employees where company_id = '${A}'`);
ok("após a reversão da fase 2 o comportamento antigo volta (membro comum lê CPF)", r.ok);
await db.exec(R1);
const aposR1 = await snap();
const d1 = diff(aposSalario, aposR1).filter((k) => k !== "funcoes");
ok("reverter também a fase 1 volta ao estado anterior; permissões novas removidas", d1.length === 0 && aposR1.permissoes === "0/0", d1.join(", ") + " " + aposR1.permissoes);
ok("reversão da fase 1 devolve o catálogo de funções ao hash anterior", aposR1.funcoes === aposSalario.funcoes);
const sobrou = (await q("select count(*)::int n from pg_proc where proname in ('get_employee_personal_data','list_employee_personal_data','set_employee_personal_data','can_read_personal_data')"))[0].n;
ok("nenhuma função de CPF sobrou", sobrou === 0);
await db.close();

log("\n# 5. GUARDA DE PRÉ-REQUISITO (banco sem a fase 2 de salário)");
const b2 = await montar();
await b2.db.exec(F1);
r = await b2.auth(U.owner_a, "select 1");
let erro = null;
try { await b2.db.exec(F2); } catch (e) { erro = e.message; }
ok("fase 2 de CPF se recusa a rodar sem a fase 2 de salário (evita revoke sem efeito)", /PRE_REQUISITO.*seguranca_salario_pix_2/.test(erro ?? ""), erro);
const aindaLe = await b2.auth(U.plain_a, `select cpf from public.employees where company_id='${A}'`);
ok("e nada mudou: o comportamento antigo segue intacto", aindaLe.ok);
await b2.db.close();

log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
process.exit(falhas === 0 ? 0 : 1);
