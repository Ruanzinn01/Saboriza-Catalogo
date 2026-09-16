// Gera o SQL de upsert da tabela public.ibge_cities a partir da API oficial do IBGE.
// Uso: node scripts/seed-ibge-cities.mjs
// O SQL gerado fica em scripts/output/ibge-cities-seed.sql — aplique via
// Supabase SQL editor ou pela tool apply_migration do MCP.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const API_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";
const OUTPUT_DIR = path.join(import.meta.dirname, "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "ibge-cities-seed.sql");

function esc(value) {
  return String(value).replace(/'/g, "''");
}

function resolveUf(municipio) {
  return municipio.microrregiao
    ? municipio.microrregiao.mesorregiao.UF
    : municipio["regiao-imediata"]["regiao-intermediaria"].UF;
}

const response = await fetch(API_URL);
if (!response.ok) throw new Error(`Falha ao buscar municípios do IBGE: HTTP ${response.status}`);

const municipios = await response.json();

const rows = municipios.map((municipio) => {
  const uf = resolveUf(municipio);
  return `('${municipio.id}', '${esc(municipio.nome)}', '${uf.sigla}', '${esc(uf.nome)}')`;
});

const sql = `insert into public.ibge_cities (city_code, city_name, state_code, state_name) values
${rows.join(",\n")}
on conflict (city_code) do update set
  city_name = excluded.city_name,
  state_code = excluded.state_code,
  state_name = excluded.state_name;
`;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, sql, "utf8");

console.log(`Gerado: ${OUTPUT_FILE} (${rows.length} municípios)`);
