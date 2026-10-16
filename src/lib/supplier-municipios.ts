import { listIbgeCitiesByState } from "@/lib/ibge";

export interface Municipality {
  name: string;
  code: string;
}

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Municípios do catálogo oficial do projeto (tabela ibge_cities, a mesma de Configurações), filtrados pela UF e pelo texto digitado.
export async function searchMunicipalities(uf: string, text: string): Promise<Municipality[]> {
  if (!/^[A-Z]{2}$/.test(uf)) return [];
  const cities = await listIbgeCitiesByState(uf, text);
  return cities.map((city) => ({ name: city.name, code: city.code })).filter((city) => /^\d{7}$/.test(city.code));
}

// Compara sem acento e sem caixa: "salvador" encontra "Salvador". Só considera igualdade exata do nome.
export function findMunicipality(list: Municipality[], name: string): Municipality | null {
  const key = fold(name);
  if (!key) return null;
  return list.find((item) => fold(item.name) === key) ?? null;
}
