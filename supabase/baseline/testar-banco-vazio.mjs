// Prova, em PGlite, que a trilha NÃO reproduz em banco vazio sem o preparo e que reproduz com supabase/baseline/preparar-banco-vazio.sql.
// Não toca a migração 20260928152708. Uso: PGLITE_DIR=<pasta> node supabase/baseline/testar-banco-vazio.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { PGlite } = await import(pathToFileURL(`${process.env.PGLITE_DIR}/node_modules/@electric-sql/pglite/dist/index.js`).href);
const { STUBS, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const PREPARO = fs.readFileSync(path.join(repo, "supabase/baseline/preparar-banco-vazio.sql"), "utf8");
const SEM_USUARIOS = STUBS.replace(/insert into auth\.users \(id\) values [^;]*;/, "");

let falhas = 0;
const ok = (nome, cond, detalhe = "") => { if (!cond) falhas += 1; console.log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${detalhe ? "  → " + detalhe : ""}`); };
const novoBanco = async () => { const db = new PGlite(); await db.exec(SEM_USUARIOS); return db; };

ok("o stub de teste realmente não contém os dois usuários fixos", !/bdf16019/.test(SEM_USUARIOS));

let db = await novoBanco();
let r = await reaplicar(db, null, () => {});
ok("sem preparo: a trilha para na 20260928152708 (FK de memberships.user_id)", r.length === 1 && r[0].file.startsWith("20260928152708") && /memberships_user_id_fkey|foreign key/i.test(r[0].erro), r[0]?.erro);
await db.close();

db = await novoBanco();
await db.exec(PREPARO);
await db.exec(PREPARO);
ok("preparo é idempotente (2 execuções, 2 usuários)", (await db.query("select count(*)::int n from auth.users")).rows[0].n === 2);
r = await reaplicar(db, null, console.log);
ok("com preparo: os 186 arquivos da trilha reaplicam sem falha", r.length === 0);
const m = (await db.query("select count(*)::int n from public.memberships where status='ACTIVE' and user_id in ('bdf16019-e1cb-4a1f-b920-86cf7e23452d','ffafba32-7378-4aa9-8860-66c918b87dca')")).rows[0].n;
ok("as duas memberships do seed existem e apontam para os placeholders", m === 2, `${m}`);
const cat = (await db.query("select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE')::int t, (select count(*) from pg_policies where schemaname='public')::int p")).rows[0];
ok("catálogo igual ao replay padrão (129 tabelas, 330 políticas)", cat.t === 129 && cat.p === 330, JSON.stringify(cat));
const email = (await db.query("select email from auth.users order by email limit 1")).rows[0].email;
ok("placeholders sem e-mail real", /@invalid$/.test(email), email);
await db.close();

console.log(`\nResultado: ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
