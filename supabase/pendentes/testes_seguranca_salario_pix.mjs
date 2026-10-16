// Testes da segurança de salário e Pix no banco RECONSTRUÍDO (PGlite) a partir da trilha de migrações.
// NÃO é homologação: sem PostgREST/Auth reais. Os privilégios, a RLS e as funções são os do Postgres, e o PostgREST
// executa as consultas com esses mesmos papéis (authenticated/anon) e claims, então "permission denied" aqui é o que a API devolve.
// Uso: PGLITE_DIR=<pasta com @electric-sql/pglite> node supabase/pendentes/testes_seguranca_salario_pix.mjs [--gerar-reversao] [--saida arquivo.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const FASE1 = read("supabase/pendentes/seguranca_salario_pix_1_aditiva.sql");
const FASE2 = read("supabase/pendentes/seguranca_salario_pix_2_restritiva.sql");
const REV1 = read("supabase/pendentes/seguranca_salario_pix_reverter_1.sql");
const STORAGE = read("supabase/pendentes/seguranca_storage_multiempresa.sql");
const STORAGE_REV = read("supabase/pendentes/seguranca_storage_multiempresa_reverter.sql");
const ASSINATURAS = read("supabase/baseline/assinaturas.sql");
const gerarReversao = process.argv.includes("--gerar-reversao");
const saida = process.argv.includes("--saida") ? process.argv[process.argv.indexOf("--saida") + 1] : null;

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const U = {
  owner_a: "00000000-0000-0000-0000-0000000000a1",
  plain_a: "00000000-0000-0000-0000-0000000000a2",
  desp_a: "00000000-0000-0000-0000-0000000000a3",
  restr_a: "00000000-0000-0000-0000-0000000000a4",
  owner_b: "00000000-0000-0000-0000-0000000000b1",
  comp_read: "00000000-0000-0000-0000-0000000000c1",
  comp_mgr: "00000000-0000-0000-0000-0000000000c2",
  vendas: "00000000-0000-0000-0000-0000000000c3",
  desp_new: "00000000-0000-0000-0000-0000000000c4",
};
const E = { a1: "eeeeeeee-0000-0000-0000-0000000000a1", a2: "eeeeeeee-0000-0000-0000-0000000000a2", b1: "eeeeeeee-0000-0000-0000-0000000000b1" };

const db = await criarBanco();
const linhas = [];
let falhas = 0;
const log = (s = "") => { linhas.push(s); console.log(s); };
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };
const q = async (sql) => (await db.query(sql)).rows;

async function como(uid, role, sql) {
  const claims = uid ? JSON.stringify({ sub: uid, role }) : "";
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false); set role ${role};`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows, afetadas: r.affectedRows };
  } catch (e) {
    return { ok: false, code: e.code, msg: e.message };
  } finally {
    await db.exec("reset role;");
  }
}
const auth = (uid, sql) => como(uid, "authenticated", sql);
const negado = (r) => !r.ok && (r.code === "42501" || /permission denied|row-level security/i.test(r.msg ?? ""));

async function snap() {
  const rows = await q(ASSINATURAS);
  const m = Object.fromEntries(rows.map((r) => [r.k, r.h]));
  const colGrants = (await q("select md5(coalesce(string_agg(table_name||':'||column_name||':'||grantee||':'||privilege_type, '|' order by table_name, column_name, grantee, privilege_type), '')) h from information_schema.column_privileges where table_schema='public' and table_name in ('employees','salary_history') and grantee in ('anon','authenticated')"))[0].h;
  const perms = (await q("select (select count(*) from public.permissions where key like 'colaboradores.remuneracao.%')::text a, (select count(*) from public.role_permissions where permission_key like 'colaboradores.remuneracao.%')::text b"))[0];
  return { grants: m.grants_tabelas, politicas: m.politicas_definicao, funcoes: m.funcoes_corpo, colGrants, permissoes: `${perms.a}/${perms.b}` };
}
const igual = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);

// ---------------------------------------------------------------------------------------------
log("# Reconstruindo o banco a partir de supabase/migrations");
const falhasReplay = await reaplicar(db, null, log);
ok("185 migrações reaplicadas sem falha", falhasReplay.length === 0);

await db.exec(`
  insert into public.companies (id, display_name, segment, slug) values ('${A}','Empresa A','INDUSTRY','empresa-a'),('${B}','Empresa B','INDUSTRY','empresa-b');
  insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(",")};
`);
async function criarPapel(uid, empresa, chave, perms) {
  const role = crypto.randomUUID();
  const mem = crypto.randomUUID();
  await db.exec(`
    insert into public.roles (id, company_id, key, name) values ('${role}','${empresa}','${chave}','${chave}');
    insert into public.role_permissions (company_id, role_id, permission_key) select '${empresa}','${role}', key from public.permissions where key = any(array[${perms.map((p) => `'${p}'`).join(",")}]::text[]);
    insert into public.memberships (id, company_id, user_id, status) values ('${mem}','${empresa}','${uid}','ACTIVE');
    insert into public.membership_roles (company_id, membership_id, role_id) values ('${empresa}','${mem}','${role}');`);
}
// em produção os Proprietários têm 47 das 48 permissões: não têm separa_confere.operar (quem a tem é operador restrito)
const todas = (await q("select key from public.permissions where key <> 'separa_confere.operar'")).map((r) => r.key);
await criarPapel(U.owner_a, A, "proprietario_a", todas);
await criarPapel(U.owner_b, B, "proprietario_b", todas);
await criarPapel(U.plain_a, A, "membro_comum", ["despesas.read", "tarefas.read", "estoque.movimentar"]);
await criarPapel(U.desp_a, A, "despesas_antigo", ["despesas.manage", "despesas.read"]);
await criarPapel(U.restr_a, A, "operador_restrito", ["separa_confere.operar"]);
await db.exec(`
  insert into public.employees (id, company_id, code, name, status, admission_date, salary_base, pix_key, cpf, timesheet_enabled) values
   ('${E.a1}','${A}','A1','Colaborador A1','ATIVO','2026-01-05',5000,'a1@pix.com','11111111111',true),
   ('${E.a2}','${A}','A2','Colaborador A2','ATIVO','2026-01-05',3000,null,'22222222222',true),
   ('${E.b1}','${B}','B1','Colaborador B1','ATIVO','2026-01-05',7000,'b1@pix.com','33333333333',true);
  insert into public.salary_history (company_id, employee_id, salary_base, effective_date) values ('${A}','${E.a1}',5000,'2026-01-01'),('${A}','${E.a2}',3000,'2026-01-01'),('${B}','${E.b1}',7000,'2026-01-01');
  insert into storage.buckets (id, name) values ('employee-documents','employee-documents'),('delivery-receipts','delivery-receipts'),('delivery-signatures','delivery-signatures') on conflict (id) do nothing;
`);
const ORDER_A = crypto.randomUUID();
await db.exec(`insert into public.orders (id, company_id, customer_name, phone) values ('${ORDER_A}','${A}','Cliente','11999999999');
  insert into storage.objects (bucket_id, name) values ('employee-documents','${E.a1}/contrato.pdf'),('delivery-receipts','${ORDER_A}/ER-1.pdf'),('delivery-signatures','${ORDER_A}/ER-1.png');`);

const pristino = await snap();

// =============================================================================================
log("\n# 1. ESTADO ATUAL (equivalente a produção): o que um membro SEM papel de RH consegue hoje");
let r = await auth(U.plain_a, "select salary_base, pix_key from public.employees where company_id = '" + A + "'");
ok("membro comum LÊ salário e Pix de todos os colaboradores da empresa", r.ok && r.rows.length === 2, `${r.rows?.length} linhas`);
r = await auth(U.plain_a, `update public.employees set salary_base = 1 where id = '${E.a2}'`);
ok("membro comum ALTERA salário direto na tabela", r.ok && r.afetadas === 1);
r = await auth(U.plain_a, `update public.employees set pix_key = 'desvio@pix.com' where id = '${E.a1}'`);
ok("membro comum ALTERA a chave Pix direto na tabela", r.ok && r.afetadas === 1);
r = await auth(U.plain_a, `insert into public.salary_history (company_id, employee_id, salary_base, effective_date) values ('${A}','${E.a2}', 1, '2026-02-01')`);
ok("membro comum GRAVA histórico salarial direto na tabela", r.ok);
r = await auth(U.plain_a, "select count(*)::int n from public.salary_history");
ok("membro comum LÊ o histórico salarial", r.ok && r.rows[0].n >= 2, `${r.rows?.[0]?.n} linhas`);
r = await auth(U.plain_a, `select public.resolve_salary_base('${E.a1}', '2026-03-01') v`);
ok("membro comum consulta salário vigente pela RPC resolve_salary_base", r.ok && Number(r.rows[0].v) === 5000);
r = await auth(U.plain_a, `select public.update_employee_salary('${E.a2}', 4321, '2026-03-01')`);
ok("membro comum altera salário pela RPC update_employee_salary", r.ok);
r = await auth(U.plain_a, `delete from public.employees where id = '${E.a2}'`);
ok("membro comum EXCLUI colaborador (e o histórico salarial em cascata) pela API", r.ok && r.afetadas === 1);
r = await auth(U.plain_a, `select count(*)::int n from public.employees where company_id = '${B}'`);
ok("controle: isolamento entre empresas na tabela employees funciona", r.ok && r.rows[0].n === 0);
r = await auth(U.restr_a, `select count(*)::int n from public.employees`);
ok("controle: operador restrito não enxerga employees (política restritiva)", r.ok && r.rows[0].n === 0);
r = await como(null, "anon", "select count(*)::int n from public.salary_history");
const anonGrant = (await q("select has_table_privilege('anon','public.salary_history','SELECT') g"))[0].g;
ok("anon tem privilégio de tabela em salary_history (a RLS é a única barreira)", anonGrant === true, `a leitura anon é barrada antes da RLS: ${r.ok ? r.rows[0].n + " linha(s)" : r.msg}`);
r = await auth(U.owner_b, "select name from storage.objects where bucket_id = 'employee-documents'");
ok("storage: usuário da EMPRESA B lista documentos de colaborador da EMPRESA A", r.ok && r.rows.length === 1);
r = await auth(U.owner_b, "select name from storage.objects where bucket_id = 'delivery-receipts'");
ok("storage: usuário da EMPRESA B lista comprovantes de entrega da EMPRESA A", r.ok && r.rows.length === 1);

await db.exec(`insert into public.employees (id, company_id, code, name, status, admission_date, salary_base, cpf, timesheet_enabled) values ('${E.a2}','${A}','A2','Colaborador A2','ATIVO','2026-01-05',3000,'22222222222',true) on conflict do nothing;
  update public.employees set salary_base = 5000, pix_key = 'a1@pix.com' where id = '${E.a1}';`);
const estadoAntesFase1 = await snap();

// =============================================================================================
log("\n# 2. FASE 1 (aditiva): não pode mudar comportamento existente");
await db.exec(FASE1);
const aposFase1 = await snap();
ok("nenhum grant, política ou corpo de função existente mudou", igual(estadoAntesFase1, aposFase1).filter((k) => k !== "permissoes" && k !== "funcoes").length === 0,
  igual(estadoAntesFase1, aposFase1).join(", "));
r = await auth(U.plain_a, `select salary_base from public.employees where id = '${E.a1}'`);
ok("o membro comum continua lendo como antes (fase 1 não restringe)", r.ok);
const permOwner = (await q(`select count(*)::int n from public.role_permissions rp join public.roles ro on ro.id=rp.role_id where ro.key in ('proprietario_a','proprietario_b','despesas_antigo') and rp.permission_key like 'colaboradores.remuneracao.%'`))[0].n;
const permPlain = (await q(`select count(*)::int n from public.role_permissions rp join public.roles ro on ro.id=rp.role_id where ro.key in ('membro_comum','operador_restrito') and rp.permission_key like 'colaboradores.remuneracao.%'`))[0].n;
ok("papéis com despesas.manage receberam as 2 permissões novas; membro comum e operador restrito, nenhuma", permOwner === 6 && permPlain === 0, `${permOwner}/6 e ${permPlain}`);

await criarPapel(U.comp_read, A, "rh_leitura", ["colaboradores.remuneracao.read"]);
await criarPapel(U.comp_mgr, A, "rh_gestao", ["colaboradores.remuneracao.manage"]);
await criarPapel(U.vendas, A, "vendas_gestor", ["vendas.manage", "vendas.read"]);
await criarPapel(U.desp_new, A, "despesas_novo", ["despesas.manage", "despesas.read"]);

r = await auth(U.plain_a, `select * from public.get_employee_compensation('${E.a1}')`);
ok("RPC de leitura nega o membro comum", !r.ok && /Sem permissão/.test(r.msg), r.msg);
r = await auth(U.restr_a, `select * from public.get_employee_compensation('${E.a1}')`);
ok("RPC de leitura nega o operador restrito", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.owner_a, `select * from public.get_employee_compensation('${E.a1}')`);
ok("RPC de leitura atende o Proprietário", r.ok && Number(r.rows[0].salary_base) === 5000);
r = await auth(U.owner_a, `select * from public.get_employee_compensation('${E.b1}')`);
ok("RPC de leitura não cruza empresas (Proprietário A pedindo colaborador de B)", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.comp_read, `select * from public.get_employee_compensation('${E.a1}')`);
ok("papel de RH-leitura lê a remuneração", r.ok);
r = await auth(U.comp_read, `select public.set_employee_compensation('${E.a1}', '{"pix_key":"novo@pix.com"}'::jsonb)`);
ok("papel de RH-leitura NÃO altera", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.comp_mgr, `select public.set_employee_compensation('${E.a1}', '{"salary_base": 5600}'::jsonb)`);
ok("alteração de salário sem motivo é recusada", !r.ok && /MOTIVO_OBRIGATORIO/.test(r.msg));
r = await auth(U.comp_mgr, `select public.set_employee_compensation('${E.a1}', '{"salary_base": 5600, "salary_effective_date": "2026-05-01"}'::jsonb, 'Dissídio coletivo 2026')`);
ok("papel de RH-gestão altera salário com motivo", r.ok);
const hist = (await q(`select count(*)::int n from public.salary_history where employee_id='${E.a1}' and salary_base=5600`))[0].n;
const cur = (await q(`select salary_base::text s from public.employees where id='${E.a1}'`))[0].s;
ok("a alteração gerou histórico versionado e atualizou o valor vigente", hist === 1 && Number(cur) === 5600);
r = await auth(U.comp_mgr, `select public.set_employee_compensation('${E.a1}', '{"pix_key":"chave.secreta@pix.com"}'::jsonb)`);
const aud = (await q(`select payload::text p from public.audit_events where event_type='employee.compensation_changed' order by recorded_at desc limit 5`)).map((x) => x.p).join("\n");
ok("Pix alterado e auditado SEM gravar a chave inteira (máscara + impressão digital)", r.ok && aud.includes("***.com") && aud.includes("impressao") && !aud.includes("chave.secreta") && !aud.includes("a1@pix"), r.ok ? "auditoria: " + aud.replace(/\s+/g, " ").slice(0, 700) : r.msg);
ok("auditoria de salário traz antes/depois e o motivo", /Dissídio coletivo 2026/.test(aud) && /"before"/.test(aud));
r = await auth(U.comp_mgr, `select public.set_employee_compensation('${E.a1}', '{"nome":"x"}'::jsonb)`);
ok("campo fora da lista de remuneração é recusado", !r.ok && /não permitido/.test(r.msg));
r = await auth(U.vendas, `select public.set_employee_commission_rate('${E.a1}', 4.5)`);
ok("gestor de vendas altera comissão", r.ok);
r = await auth(U.vendas, `select * from public.get_employee_compensation('${E.a1}')`);
ok("gestor de vendas NÃO lê salário", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.vendas, "select count(*)::int n from public.list_commission_rates()");
ok("gestor de vendas lê só as comissões", r.ok && r.rows[0].n === 2);
r = await auth(U.desp_new, "select count(*)::int n from public.list_employee_compensation()");
ok("gestor de despesas (novo, sem RH) lista a remuneração para gerar a folha", r.ok && r.rows[0].n === 2);
r = await auth(U.desp_new, `select public.set_employee_compensation('${E.a1}', '{"pix_key":"x"}'::jsonb)`);
ok("gestor de despesas NÃO altera remuneração", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.plain_a, "select count(*)::int n from public.list_employee_compensation()");
ok("lista em lote nega o membro comum", !r.ok && /Sem permissão/.test(r.msg));

const snapAntesFase2 = await snap();
let reversaoGerada = null;
if (gerarReversao) {
  const funcs = ["public.resolve_salary_base(uuid, date)", "public.update_employee_salary(uuid, numeric, date)", "public.oris360_resolver_banco_horas(uuid, integer, text)"];
  let sql = "-- REVERSÃO DA FASE 2. GERADA pelo teste a partir do estado anterior à fase 2 (corpos, políticas e grants literais).\n-- Mantém a Fase 1. Verificada por hash: depois de aplicar, grants/políticas/funções ficam IGUAIS ao estado anterior.\n\n";
  for (const f of funcs) sql += (await q(`select pg_get_functiondef('${f}'::regprocedure) d`))[0].d.trim() + ";\n\n";
  sql += "drop policy if exists salary_history_select on public.salary_history;\ndrop policy if exists salary_history_insert on public.salary_history;\ndrop policy if exists employees_delete on public.employees;\n";
  for (const p of await q("select tablename, policyname, cmd, roles::text roles, qual, with_check from pg_policies where schemaname='public' and ((tablename='salary_history' and policyname in ('salary_history_select','salary_history_insert')) or (tablename='employees' and policyname='employees_delete')) order by tablename, policyname")) {
    const papeis = p.roles.replace(/[{}]/g, "");
    sql += `create policy ${p.policyname} on public.${p.tablename} for ${p.cmd.toLowerCase()} to ${papeis}${p.qual ? ` using (${p.qual})` : ""}${p.with_check ? ` with check (${p.with_check})` : ""};\n`;
  }
  for (const t of ["salary_history", "employees"]) {
    sql += `\nrevoke all on public.${t} from authenticated, anon;\n`;
    for (const g of ["authenticated", "anon"]) {
      const privs = (await q(`select string_agg(distinct privilege_type, ', ' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and table_name='${t}' and grantee='${g}'`))[0].p;
      if (privs) sql += `grant ${privs.toLowerCase()} on public.${t} to ${g};\n`;
    }
  }
  reversaoGerada = sql;
}

// =============================================================================================
log("\n# 3. FASE 2 (restritiva): proteção pela API e pelos caminhos de escrita");
await db.exec(FASE2);
r = await auth(U.plain_a, "select salary_base from public.employees");
ok("leitura de salario_base pela API: NEGADA ao membro comum", negado(r), r.msg);
r = await auth(U.plain_a, "select pix_key from public.employees");
ok("leitura de pix_key pela API: NEGADA ao membro comum", negado(r), r.msg);
for (const col of ["salary_additions", "salary_benefits", "salary_effective_date", "monthly_divisor", "timesheet_overtime_percent", "commission_rate_percent"]) {
  r = await auth(U.plain_a, `select ${col} from public.employees`);
  ok(`leitura de ${col}: NEGADA`, negado(r));
}
r = await auth(U.plain_a, "select * from public.employees");
ok("select * (o que o front antigo faz) agora FALHA — o front novo precisa listar as colunas", negado(r), r.msg);
r = await auth(U.plain_a, "select id, code, name, cpf, role, department, status, timesheet_enabled, timesheet_expected_start from public.employees");
ok("colunas não sensíveis continuam legíveis", r.ok && r.rows.length === 2);
r = await auth(U.owner_a, "select salary_base from public.employees");
ok("nem o Proprietário lê salário direto na tabela (só pela RPC auditável)", negado(r));
r = await auth(U.owner_a, `select * from public.get_employee_compensation('${E.a1}')`);
ok("o Proprietário lê pela RPC", r.ok && Number(r.rows[0].salary_base) === 5600);
r = await auth(U.plain_a, `update public.employees set salary_base = 1 where id = '${E.a1}'`);
ok("escrita de salário direto na tabela: NEGADA ao membro comum", negado(r), r.msg);
r = await auth(U.owner_a, `update public.employees set salary_base = 1 where id = '${E.a1}'`);
ok("escrita de salário direto na tabela: NEGADA até ao Proprietário (só pela RPC)", negado(r));
r = await auth(U.plain_a, `update public.employees set pix_key = 'x' where id = '${E.a1}'`);
ok("escrita de Pix direto na tabela: NEGADA", negado(r));
r = await auth(U.plain_a, `update public.employees set commission_rate_percent = 90 where id = '${E.a1}'`);
ok("escrita de comissão direto na tabela: NEGADA", negado(r));
r = await auth(U.plain_a, `update public.employees set name = 'Colaborador A1 (editado)', role = 'Encarregado' where id = '${E.a1}'`);
ok("edição de dados não sensíveis continua permitida", r.ok && r.afetadas === 1);
r = await auth(U.plain_a, `insert into public.employees (company_id, code, name, salary_base) values ('${A}','A9','Novo com salário', 9999)`);
ok("INSERT informando salário: NEGADO", negado(r), r.msg);
r = await auth(U.plain_a, `insert into public.employees (company_id, code, name, pix_key) values ('${A}','A9','Novo com pix', 'x')`);
ok("INSERT informando Pix: NEGADO", negado(r));
r = await auth(U.plain_a, `insert into public.employees (company_id, code, name) values ('${A}','A8','Novo sem dados sensíveis')`);
ok("INSERT sem colunas sensíveis continua permitido", r.ok);
r = await auth(U.plain_a, `insert into public.employees (company_id, code, name) values ('${B}','A7','Outra empresa')`);
ok("INSERT em outra empresa continua barrado pela RLS", !r.ok);
r = await auth(U.plain_a, "select count(*)::int n from public.salary_history");
ok("histórico salarial: membro comum não lê nada", r.ok && r.rows[0].n === 0);
r = await auth(U.plain_a, `insert into public.salary_history (company_id, employee_id, salary_base, effective_date) values ('${A}','${E.a1}',1,'2026-09-01')`);
ok("histórico salarial: INSERT direto NEGADO", negado(r));
r = await auth(U.owner_a, `update public.salary_history set salary_base = 1 where employee_id = '${E.a1}'`);
ok("histórico salarial: UPDATE direto NEGADO (até ao Proprietário)", negado(r));
r = await auth(U.owner_a, `delete from public.salary_history where employee_id = '${E.a1}'`);
ok("histórico salarial: DELETE direto NEGADO", negado(r));
r = await auth(U.comp_read, "select count(*)::int n from public.salary_history");
ok("histórico salarial: papel de RH-leitura lê só a própria empresa", r.ok && r.rows[0].n >= 2);
r = await auth(U.owner_b, `select count(*)::int n from public.salary_history where company_id = '${A}'`);
ok("histórico salarial: usuário da empresa B não lê o da empresa A", r.ok && r.rows[0].n === 0);
r = await auth(U.plain_a, `select public.resolve_salary_base('${E.a1}', '2026-06-01')`);
ok("RPC resolve_salary_base: NEGADA ao membro comum", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.desp_new, `select public.resolve_salary_base('${E.a1}', '2026-06-01') v`);
ok("RPC resolve_salary_base: gestor de despesas continua atendido", r.ok && Number(r.rows[0].v) === 5600);
r = await auth(U.plain_a, `select public.update_employee_salary('${E.a1}', 1, '2026-07-01')`);
ok("RPC update_employee_salary: NEGADA ao membro comum", !r.ok && /Sem permissão/.test(r.msg));
r = await auth(U.comp_mgr, `select public.update_employee_salary('${E.a1}', 5800, '2026-08-01')`);
ok("RPC update_employee_salary: papel de RH-gestão continua atendido (e agora audita)", r.ok);
r = await auth(U.desp_new, `select public.generate_salary_obligation('${E.a1}', '2026-06-01', '2026-07-05') id`);
ok("folha: gestor de despesas ainda gera a obrigação (usa o salário sem ler a coluna)", r.ok && !!r.rows[0].id, r.msg);
r = await auth(U.plain_a, `delete from public.employees where id = '${E.a2}'`);
ok("exclusão de colaborador pela API: NEGADA", negado(r), r.msg);
r = await auth(U.owner_a, `delete from public.employees where id = '${E.a2}'`);
ok("exclusão de colaborador pela API: NEGADA até ao Proprietário", negado(r));
r = await como(null, "anon", "select count(*) from public.salary_history");
ok("anon: sem privilégio algum em salary_history", negado(r), r.msg);
r = await como(null, "anon", "select name from public.employees");
ok("anon: sem privilégio em employees", negado(r));
r = await auth(U.restr_a, "select id, name from public.employees");
ok("operador restrito continua sem ver employees", r.ok && r.rows.length === 0);
r = await como(U.owner_a, "service_role", "select salary_base, pix_key from public.employees where code = 'A1'");
ok("service_role (funções de borda) continua lendo — fora do alcance da API pública", r.ok && r.rows.length === 1);
await db.exec(`insert into public.time_bank_entries (employee_id, competencia, type, minutes) values ('${E.a1}','2026-09-01','CREDITO_EXTRA',120)`);
r = await auth(U.owner_a, `select public.oris360_resolver_banco_horas('${E.a1}', 60, 'PAGO') id`);
ok("pagamento de horas extras segue funcionando (função agora DEFINER, com a checagem de permissão mantida)", r.ok && !!r.rows[0].id, r.msg);
r = await auth(U.plain_a, `select public.oris360_resolver_banco_horas('${E.a1}', 10, 'PAGO')`);
ok("pagamento de horas extras segue negado a quem não tem apuração", !r.ok && /sem permissao/.test(r.msg));
r = await auth(U.plain_a, `update public.employees set status = 'INATIVO', employment_end_date = '2026-09-30' where id = '${E.a1}'`);
const periodos = (await q(`select count(*)::int n from public.employee_employments where employee_id='${E.a1}' and end_date is not null`))[0].n;
ok("gatilhos do vínculo continuam funcionando (desligar fecha o período)", r.ok && periodos === 1);
const semAcesso = (await q(`select string_agg(column_name, ',' order by column_name) c from information_schema.columns c where table_schema='public' and table_name='employees' and not has_column_privilege('authenticated','public.employees', column_name, 'SELECT')`))[0].c;
ok("trava de regressão: as ÚNICAS colunas sem leitura para authenticated são as 8 sensíveis", semAcesso === "commission_rate_percent,monthly_divisor,pix_key,salary_additions,salary_base,salary_benefits,salary_effective_date,timesheet_overtime_percent", semAcesso);

// =============================================================================================
log("\n# 4. REVERSÃO");
if (reversaoGerada) {
  await db.exec(reversaoGerada);
  const aposReversao2 = await snap();
  const dif2 = igual(snapAntesFase2, aposReversao2);
  ok("reverter a fase 2 devolve grants, políticas, corpos de função e grants de coluna IDÊNTICOS (hash)", dif2.length === 0, dif2.join(", "));
  r = await auth(U.plain_a, `select salary_base from public.employees where id = '${E.a1}'`);
  ok("após a reversão da fase 2 o comportamento antigo volta (membro comum lê)", r.ok);
  fs.writeFileSync(path.join(repo, "supabase/pendentes/seguranca_salario_pix_reverter_2.sql"), reversaoGerada);
  await db.exec(REV1);
  const aposReversao1 = await snap();
  const dif1 = igual(estadoAntesFase1, aposReversao1).filter((k) => k !== "funcoes");
  ok("reverter também a fase 1 devolve grants/políticas ao estado pristino; permissões novas removidas", dif1.length === 0 && aposReversao1.permissoes === "0/0", dif1.join(", ") + " " + aposReversao1.permissoes);
} else {
  log("(reversão não executada: rode com --gerar-reversao)");
}

// =============================================================================================
log("\n# 5. STORAGE com escopo de empresa (patch separado)");
await db.exec(STORAGE);
log("diagnóstico owner_a: " + JSON.stringify([(await auth(U.owner_a, `select count(*)::int n from public.employees where id::text = '${E.a1}'`)).rows, (await auth(U.owner_a, "select private.is_restricted_operator('" + A + "') v")).rows, (await auth(U.owner_a, "select name from storage.objects where bucket_id = 'employee-documents'")), (await q("select count(*)::int n from storage.objects where bucket_id='employee-documents'"))]));
r = await auth(U.owner_b, "select name from storage.objects where bucket_id in ('employee-documents','delivery-receipts','delivery-signatures')");
ok("empresa B não lista mais nenhum arquivo da empresa A", r.ok && r.rows.length === 0);
r = await auth(U.owner_a, "select name from storage.objects where bucket_id in ('employee-documents','delivery-receipts','delivery-signatures')");
ok("empresa A continua vendo os próprios arquivos", r.ok && r.rows.length === 3, r.ok ? r.rows.length + " arquivo(s)" : r.msg);
r = await auth(U.restr_a, "select name from storage.objects where bucket_id = 'employee-documents'");
ok("operador restrito não lê documento de colaborador", r.ok && r.rows.length === 0);
r = await auth(U.restr_a, "select name from storage.objects where bucket_id in ('delivery-receipts','delivery-signatures')");
ok("operador restrito (Entrega Registra) continua lendo comprovantes da própria empresa", r.ok && r.rows.length === 2);
r = await auth(U.restr_a, `insert into storage.objects (bucket_id, name) values ('delivery-receipts', '${ORDER_A}/ER-2.pdf')`);
ok("operador restrito continua gravando comprovante da própria empresa", r.ok);
r = await auth(U.owner_b, `insert into storage.objects (bucket_id, name) values ('delivery-receipts', '${ORDER_A}/ER-9.pdf')`);
ok("empresa B não grava comprovante em pedido da empresa A", negado(r), r.msg);
r = await auth(U.owner_b, `insert into storage.objects (bucket_id, name) values ('employee-documents', '${E.a1}/falso.pdf')`);
ok("empresa B não grava documento em colaborador da empresa A", negado(r));
r = await auth(U.owner_a, `insert into storage.objects (bucket_id, name) values ('employee-documents', '${E.a1}/novo.pdf')`);
ok("empresa A grava documento do próprio colaborador", r.ok, r.ok ? "" : r.msg);
await db.exec(STORAGE_REV);
r = await auth(U.owner_b, "select count(*)::int n from storage.objects where bucket_id = 'employee-documents'");
ok("reverter o storage restaura a política antiga (exposição volta; prova de reversão)", r.ok && r.rows[0].n >= 1);

log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
if (saida) fs.writeFileSync(saida, linhas.join("\n") + "\n");
await db.close();
process.exit(falhas === 0 ? 0 : 1);
