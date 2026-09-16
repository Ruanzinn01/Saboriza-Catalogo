export interface CnaeOption {
  code: string;
  description: string;
}

let cache: CnaeOption[] | null = null;
let pending: Promise<CnaeOption[]> | null = null;

async function loadCnaeList(): Promise<CnaeOption[]> {
  if (cache) return cache;
  if (pending) return pending;

  pending = fetch("https://brasilapi.com.br/api/cnae/v1")
    .then((response) => (response.ok ? response.json() : []))
    .then((data: { id: number; descricao: string }[]) => {
      cache = data.map((item) => ({ code: String(item.id), description: item.descricao }));
      return cache;
    })
    .catch(() => []);

  return pending;
}

export async function searchCnae(search: string): Promise<CnaeOption[]> {
  const list = await loadCnaeList();
  const query = search.trim().toLowerCase();
  if (!query) return list.slice(0, 20);

  return list.filter((item) => item.code.includes(query) || item.description.toLowerCase().includes(query)).slice(0, 20);
}
