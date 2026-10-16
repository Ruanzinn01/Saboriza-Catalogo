import {
  PAGE_SIZES,
  type CustomerListFilters,
  type CustomerListItem,
  type CustomerListResult,
  type ListCategory,
  type ListFinance,
  type ListRegistration,
  type ListSort,
} from "@/lib/customers-api";

export const DEFAULT_FILTERS: CustomerListFilters = {
  search: "",
  city: "",
  uf: "",
  neighborhood: "",
  sellerId: "",
  promoterId: "",
  finance: "all",
  registration: "all",
  category: "all",
  sort: "purchase",
  page: 1,
  pageSize: 10,
};

const CATEGORIES: ListCategory[] = ["all", "active", "recent", "old", "prospect"];
const FINANCE: ListFinance[] = ["all", "debt", "clear"];
const REGISTRATION: ListRegistration[] = ["all", "active", "inactive"];
const SORTS: ListSort[] = ["purchase", "name", "debt"];

function pick<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return value !== null && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

export function parseListFilters(params: URLSearchParams): CustomerListFilters {
  const page = Number(params.get("pagina"));
  const size = Number(params.get("tamanho"));
  return {
    search: params.get("busca") ?? "",
    city: params.get("cidade") ?? "",
    uf: (params.get("uf") ?? "").toUpperCase().slice(0, 2),
    neighborhood: params.get("bairro") ?? "",
    sellerId: params.get("vendedor") ?? "",
    promoterId: params.get("promotor") ?? "",
    finance: pick(params.get("financeiro"), FINANCE, "all"),
    registration: pick(params.get("cadastro"), REGISTRATION, "all"),
    category: pick(params.get("segmento"), CATEGORIES, "all"),
    sort: pick(params.get("ordem"), SORTS, "purchase"),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_FILTERS.pageSize,
  };
}

export function serializeListFilters(filters: CustomerListFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number, fallback: string | number) => {
    if (value !== fallback && value !== "") params.set(key, String(value));
  };
  set("busca", filters.search, "");
  set("cidade", filters.city, "");
  set("uf", filters.uf, "");
  set("bairro", filters.neighborhood, "");
  set("vendedor", filters.sellerId, "");
  set("promotor", filters.promoterId, "");
  set("financeiro", filters.finance, "all");
  set("cadastro", filters.registration, "all");
  set("segmento", filters.category, "all");
  set("ordem", filters.sort, "purchase");
  set("pagina", filters.page, 1);
  set("tamanho", filters.pageSize, DEFAULT_FILTERS.pageSize);
  return params;
}

export function hasActiveFilters(filters: CustomerListFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.city !== "" ||
    filters.uf !== "" ||
    filters.neighborhood.trim() !== "" ||
    filters.sellerId !== "" ||
    filters.promoterId !== "" ||
    filters.finance !== "all" ||
    filters.registration !== "all" ||
    filters.category !== "all"
  );
}

export function clearedFilters(filters: CustomerListFilters): CustomerListFilters {
  return { ...DEFAULT_FILTERS, sort: filters.sort, pageSize: filters.pageSize };
}

export const CATEGORY_NAME: Record<Exclude<ListCategory, "all">, string> = {
  active: "Compras recentes",
  recent: "Sem comprar · recente",
  old: "Sem comprar · antigo",
  prospect: "Sem primeira compra",
};

export const CATEGORY_RULE: Record<Exclude<ListCategory, "all">, string> = {
  active: "Última compra faturada em até 30 dias.",
  recent: "Última compra faturada entre 31 e 90 dias.",
  old: "Última compra faturada há mais de 90 dias.",
  prospect: "Cadastro formal sem compra faturada. Não é prospecção.",
};

export function activeFilterTags(filters: CustomerListFilters, options: Pick<CustomerListResult["options"], "sellers" | "promoters">): string[] {
  const tags: string[] = [];
  if (filters.city) tags.push(filters.city);
  if (filters.uf) tags.push(filters.uf);
  if (filters.neighborhood.trim()) tags.push(`Bairro: ${filters.neighborhood.trim()}`);
  if (filters.sellerId) tags.push(`Vendedor: ${options.sellers.find((p) => p.id === filters.sellerId)?.name ?? "selecionado"}`);
  if (filters.promoterId) tags.push(`Promotor: ${options.promoters.find((p) => p.id === filters.promoterId)?.name ?? "selecionado"}`);
  if (filters.finance === "debt") tags.push("Com títulos vencidos");
  if (filters.finance === "clear") tags.push("Sem títulos vencidos");
  if (filters.registration === "active") tags.push("Cadastro ativo");
  if (filters.registration === "inactive") tags.push("Cadastro inativo");
  if (filters.category !== "all") tags.push(CATEGORY_NAME[filters.category]);
  return tags;
}

export function documentKind(item: Pick<CustomerListItem, "person_type" | "document">): "CPF" | "CNPJ" {
  return item.person_type === "PF" || item.document.replace(/[^A-Za-z0-9]/g, "").length === 11 ? "CPF" : "CNPJ";
}

export function formatDocument(raw: string): string {
  const value = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (value.length === 14) return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`;
  if (value.length === 11) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
  return raw;
}

export function formatCustomerNumber(n: number): string {
  return `CLI-${String(n).padStart(4, "0")}`;
}

function daysBetween(fromIso: string, todayIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${todayIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function formatAge(dateIso: string | null | undefined, todayIso: string): string {
  if (!dateIso) return "Sem registro";
  const days = daysBetween(dateIso, todayIso);
  if (days < 0) return "Sem registro";
  if (days === 0) return "Hoje";
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-----";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function pageWindow(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const sorted = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCustomersCsv(items: CustomerListItem[], financeAvailable: boolean): string {
  const header = ["Número", "Nome fantasia", "Razão social / nome", "Documento", "Cidade", "UF", "Vendedor", "Promotor", "Situação cadastral", "Última compra faturada"];
  if (financeAvailable) header.push("Saldo vencido", "Saldo em aberto");
  const lines = items.map((item) => {
    const cells: (string | number | null)[] = [
      formatCustomerNumber(item.display_number),
      item.trade_name,
      item.legal_name,
      formatDocument(item.document),
      item.city,
      item.state,
      item.seller?.name ?? "",
      item.promoter?.name ?? "",
      item.registration_status === "ATIVO" ? "Ativo" : "Inativo",
      formatDate(item.last_purchase) === "-----" ? "" : formatDate(item.last_purchase),
    ];
    if (financeAvailable) cells.push(item.overdue_balance, item.open_balance);
    return cells.map(csvCell).join(";");
  });
  return `﻿${[header.map(csvCell).join(";"), ...lines].join("\r\n")}\r\n`;
}
