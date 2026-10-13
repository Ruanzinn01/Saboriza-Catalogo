import type { InventoryFilter, InventoryItem, InventorySession, InventoryState } from "@/types/inventory";

export const FILTER_OPTIONS: { key: InventoryFilter; label: string }[] = [
  { key: "pendentes", label: "Pendentes" },
  { key: "todos", label: "Todos" },
  { key: "contados", label: "Contados" },
  { key: "divergencias", label: "Divergências" },
  { key: "recontagem", label: "Recontagem" },
];

export const GROUP_TITLES: Record<1 | 2, string> = {
  1: "Produtos fabricados e de revenda",
  2: "Matérias-primas, embalagens e insumos",
};

export const STATE_META: Record<InventoryState, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "bg-ink-900/10 text-ink-700" },
  COUNTED: { label: "Contado", className: "bg-forest-950/10 text-forest-950" },
  DIVERGENCE: { label: "Divergência", className: "bg-red-100 text-red-700" },
  RECOUNT: { label: "Recontagem", className: "bg-amber-100 text-amber-800" },
};

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matchesFilter(item: InventoryItem, filter: InventoryFilter): boolean {
  switch (filter) {
    case "todos":
      return true;
    case "pendentes":
      return item.state === "PENDING";
    case "contados":
      return item.state === "COUNTED" || item.state === "DIVERGENCE";
    case "divergencias":
      return item.state === "DIVERGENCE";
    case "recontagem":
      return item.state === "RECOUNT";
  }
}

export function matchesQuery(item: InventoryItem, query: string): boolean {
  const term = normalizeText(query.trim());
  if (term === "") return true;
  return normalizeText(`${item.name} ${item.presentation} ${item.sku}`).includes(term);
}

export function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatCompetence(value: string): string {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

export function sessionLabel(session: InventorySession): string {
  const kind = session.modality === "SCHEDULED" ? "Programado" : "Extraordinário";
  return `${formatCompetence(session.competence)} · ${session.unitName} · ${kind}`;
}

export function sessionStatusLabel(status: InventorySession["status"]): string {
  switch (status) {
    case "SCHEDULED":
      return "Programado";
    case "OPEN":
      return "Em andamento";
    case "CLOSED":
      return "Encerrado";
    case "CLOSED_INCOMPLETE":
      return "Encerrado incompleto";
  }
}

export function formatQuantity(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
