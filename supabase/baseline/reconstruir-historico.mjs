// Reconstrói supabase/migrations/<versão>_<nome>.sql a partir do histórico REAL do banco
// (supabase_migrations.schema_migrations), conferindo o hash normalizado de cada migração.
//
// Uso (somente leitura no banco; o resultado da consulta é salvo em arquivo pela ferramenta que a executou):
//   node supabase/baseline/reconstruir-historico.mjs <arquivo-json-da-consulta> [--escrever]
//
// Consulta usada (uma linha por migração; o hash ignora comentários, espaços e ponto e vírgula):
//   select version, name,
//          md5(lower(regexp_replace(regexp_replace(array_to_string(statements,''), '--[^\n]*', '', 'g'), '[\s;]+', '', 'g'))) md5,
//          array_length(statements,1) n_statements,
//          (select string_agg(case when right(btrim(s),1)=';' then btrim(s) else btrim(s)||';' end, E'\n' order by ord)
//             from unnest(statements) with ordinality u(s,ord)) body
//   from supabase_migrations.schema_migrations order by version;
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(repo, "supabase/migrations");
const input = process.argv[2];
const write = process.argv.includes("--escrever");
if (!input) throw new Error("informe o arquivo salvo com o resultado da consulta");

const norm = (s) => s.replace(/--[^\n]*/g, "").replace(/[\s;]+/g, "").toLowerCase();
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const outer = JSON.parse(fs.readFileSync(input, "utf8"));
const text = typeof outer === "string" ? outer : outer.result;
const match = text.match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data-/);
if (!match) throw new Error("formato inesperado do resultado");
const rows = JSON.parse(match[1]);

const existing = new Map(
  fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).map((f) => [f.slice(0, 14), f])
);

const manifest = [];
let escritos = 0;
let divergentes = 0;
for (const row of rows) {
  const file = `${row.version}_${row.name}.sql`;
  const bodyHash = md5(norm(row.body));
  const ok = bodyHash === row.md5;
  const inRepo = existing.get(row.version);
  let origem;
  let fileHash = null;
  if (inRepo) {
    fileHash = md5(norm(fs.readFileSync(path.join(migrationsDir, inRepo), "utf8")));
    origem = fileHash === row.md5 ? "repositorio_identico" : "repositorio_diferente_do_aplicado";
    if (fileHash !== row.md5) divergentes += 1;
  } else {
    origem = "reconstruida_do_banco";
    if (write) {
      if (!ok) throw new Error(`hash divergente ao reconstruir ${file}`);
      const header = `-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).\n-- versão ${row.version} · md5 normalizado ${row.md5} · ${row.n_statements} instrução(ões)\n-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.\n`;
      fs.writeFileSync(path.join(migrationsDir, file), `${header}${row.body}\n`);
      escritos += 1;
    }
  }
  manifest.push({ version: row.version, name: row.name, md5_normalizado: row.md5, bytes: Buffer.byteLength(row.body), instrucoes: row.n_statements, origem, integridade_do_export: ok });
}

fs.writeFileSync(
  path.join(repo, "supabase/baseline/MANIFESTO_HISTORICO.json"),
  JSON.stringify({ gerado_em: "2026-10-15", fonte: "supabase_migrations.schema_migrations do projeto saboriza", total: manifest.length, migracoes: manifest }, null, 2)
);
console.log(JSON.stringify({ total: rows.length, escritos, divergentes_do_repositorio: divergentes, export_integro: manifest.every((m) => m.integridade_do_export) }));
