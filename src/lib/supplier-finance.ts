export type SupplierPeriod = "month" | "three" | "six" | "year" | "all";

export const PERIOD_LABELS: Record<SupplierPeriod, string> = {
  month: "Este mês",
  three: "Últimos 3 meses",
  six: "Últimos 6 meses",
  year: "Últimos 12 meses",
  all: "Histórico completo",
};

const MONTHS_BACK: Record<Exclude<SupplierPeriod, "all">, number> = { month: 1, three: 3, six: 6, year: 12 };

// Data de hoje (YYYY-MM-DD) no fuso da empresa, independente do fuso do navegador.
export function todayInZone(timeZone = "America/Sao_Paulo", now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone }).format(now);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Meses incluindo o atual parcial (regra do pacote): 3 meses = dia 1 de dois meses atrás até hoje. "Histórico completo" = sem limite.
export function periodRange(period: SupplierPeriod, asOf: string): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null };
  const ref = new Date(`${asOf}T12:00:00Z`);
  ref.setUTCDate(1);
  ref.setUTCMonth(ref.getUTCMonth() - MONTHS_BACK[period] + 1);
  return { from: iso(ref), to: asOf };
}

export function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBr(isoDate: string | null | undefined): string {
  if (!isoDate) return "Não informado";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function agoLabel(isoDate: string | null | undefined, asOf: string): string {
  if (!isoDate) return "Sem registro";
  const days = daysBetween(isoDate, asOf);
  if (days <= 0) return "Hoje";
  return `Há ${days} dia${days === 1 ? "" : "s"}`;
}

export interface FinanceRow {
  supplier_id: string;
  purchased_cents: number;
  purchase_count: number;
  last_purchase_on: string | null;
  paid_cents: number;
  open_cents: number;
  overdue_cents: number;
  due_today_cents: number;
  overdue_count: number;
  rank: number | null;
}

export type FinanceFilter = "all" | "overdue" | "open" | "clear";

export function matchesFinanceFilter(row: FinanceRow | undefined, filter: FinanceFilter): boolean {
  if (filter === "all") return true;
  // Sem a fonte financeira não dá para afirmar "sem saldo": o filtro não exclui nada nesse caso.
  if (!row) return true;
  if (filter === "overdue") return row.overdue_cents > 0;
  if (filter === "open") return row.open_cents > 0;
  return row.open_cents === 0;
}

export function financeChip(row: FinanceRow | undefined): { label: string; tone: "red" | "neutral" | "none" } {
  if (!row) return { label: "Indisponível", tone: "none" };
  if (row.overdue_cents > 0) return { label: "Vencidos", tone: "red" };
  if (row.open_cents > 0) return { label: "A vencer", tone: "neutral" };
  return { label: "Sem saldo", tone: "none" };
}

// Participação no total filtrado (denominador = soma de TODOS os fornecedores do filtro, não só dos exibidos).
export function concentration<T extends { id: string; cents: number }>(items: T[], limit = 4): (T & { percent: number })[] {
  const total = items.reduce((sum, item) => sum + item.cents, 0);
  return [...items]
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((item) => ({ ...item, percent: total > 0 ? (item.cents / total) * 100 : 0 }));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export interface FinancialSummary {
  as_of: string;
  purchase_date_basis: string;
  purchased: {
    total_cents: number;
    count: number;
    avg_cents: number | null;
    all_time_cents: number;
    rank: number | null;
    ranked_suppliers: number;
    last_purchase_on: string | null;
  };
  paid: { period_cents: number; all_time_cents: number; last_payment_on: string | null; last_payment_cents: number | null };
  open: {
    total_cents: number;
    overdue_cents: number;
    due_today_cents: number;
    count: number;
    titles: {
      expense_id: string;
      launch_id: string;
      document_ref: string | null;
      installment_number: number | null;
      installment_count: number | null;
      due_date: string;
      balance_cents: number;
      status: string;
      scheduled_payment_on: string | null;
      payment_method: string | null;
      overdue_days: number | null;
    }[];
  };
  punctuality: { settled: number; on_time: number; late: number; pct: number | null };
  terms: { contracted_avg_days: number | null; effective_avg_days: number | null };
  monthly: { month: string; purchased_cents: number; paid_cents: number }[];
  purchases: { launch_id: string; day: string; document_ref: string | null; state: string; total_cents: number; counted: boolean }[];
  items: {
    name: string;
    unit: string;
    quantity: number;
    value_cents: number;
    last_unit_price_cents: number;
    last_day: string;
    history: { day: string; unit_price: number }[];
  }[];
  by_kind?: Record<string, number>;
  unavailable: string[];
}

export function purchaseStateLabel(state: string): string {
  return state === "ABERTO" ? "Confirmada" : state === "RASCUNHO" ? "Rascunho" : state;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1] ?? m}/${y.slice(2)}`;
}
