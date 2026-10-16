// Confere se os hashes normalizados de MANIFESTO_HISTORICO.json continuam válidos com quebras de linha LF e CRLF.
// Somente leitura. Uso: node supabase/baseline/verificar-eol-manifesto.mjs   (sai com código 1 se algo fora do esperado divergir)
// O hash ignora comentários "--", espaços, quebras de linha e ponto e vírgula, então LF/CRLF não o alteram.
// A única divergência conhecida e registrada no manifesto é a migração marcada "repositorio_diferente_do_aplicado".
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifesto = JSON.parse(fs.readFileSync(path.join(repo, "supabase/baseline/MANIFESTO_HISTORICO.json"), "utf8"));
const dir = path.join(repo, "supabase/migrations");
const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
const norm = (s) => s.replace(/--[^\n]*/g, "").replace(/[\s;]+/g, "").toLowerCase();
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const r = { total: manifesto.migracoes.length, ok_como_esta: 0, ok_lf: 0, ok_crlf: 0, ausentes: [], divergentes: [], conhecidas: [] };
for (const m of manifesto.migracoes) {
  const f = arquivos.find((x) => x.startsWith(m.version));
  if (!f) { r.ausentes.push(m.version); continue; }
  const bruto = fs.readFileSync(path.join(dir, f), "utf8");
  const lf = bruto.replace(/\r\n/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  const [a, b, c] = [bruto, lf, crlf].map((t) => md5(norm(t)) === m.md5_normalizado);
  r.ok_como_esta += a; r.ok_lf += b; r.ok_crlf += c;
  if (!(a && b && c)) (m.origem === "repositorio_diferente_do_aplicado" ? r.conhecidas : r.divergentes).push(m.version);
}
console.log(JSON.stringify(r));
process.exit(r.ausentes.length === 0 && r.divergentes.length === 0 ? 0 : 1);
