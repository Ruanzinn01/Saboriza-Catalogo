import type { CommercialSummary, OpenTitle, PaidTitle, ReceivablesView } from "@/lib/customers-api";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function seriesLabel(key: string): string {
  const [y, m, d] = key.split("-");
  if (d) return d;
  return `${MONTHS[Number(m) - 1] ?? m}/${y.slice(2)}`;
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  count: number;
  heightPercent: number;
}

export function buildBars(series: CommercialSummary["series"]): Bar[] {
  const max = Math.max(...series.map((s) => Number(s.value)), 0);
  return series.map((s) => ({
    key: s.key,
    label: seriesLabel(s.key),
    value: Number(s.value),
    count: Number(s.count),
    heightPercent: max > 0 ? Math.round((Number(s.value) / max) * 100) : 0,
  }));
}

export type PaymentFilter = "all" | "ontime" | "late";

export function filterPaid(paid: PaidTitle[], filter: PaymentFilter): PaidTitle[] {
  if (filter === "ontime") return paid.filter((p) => p.on_time);
  if (filter === "late") return paid.filter((p) => !p.on_time);
  return paid;
}

export function paidBadge(title: Pick<PaidTitle, "days_late" | "on_time">): string {
  return title.on_time ? "Pago em dia" : `${title.days_late} ${title.days_late === 1 ? "dia" : "dias"} de atraso`;
}

export function openBadge(title: Pick<OpenTitle, "overdue" | "days_late">): string {
  return title.overdue ? `${title.days_late} ${title.days_late === 1 ? "dia" : "dias"} de atraso` : "A vencer";
}

export function methodLabel(method: string | null): string {
  if (!method) return "Título";
  const known: Record<string, string> = { BOLETO: "Boleto", PIX: "Pix", CARTAO: "Cartão", CARTÃO: "Cartão", DINHEIRO: "Dinheiro" };
  return known[method.toUpperCase()] ?? method;
}

export function titleRowLabel(title: Pick<OpenTitle | PaidTitle, "order_number" | "id">): string {
  return title.order_number ? `Pedido ${title.order_number}` : `Título ${title.id.slice(0, 8)}`;
}

export function onTimePercentLabel(summary: ReceivablesView["summary"]): string {
  return summary.on_time_percent === null ? "—" : `${summary.on_time_percent}%`;
}

export function rankLabel(rank: CommercialSummary["rank"]): string {
  if (rank.position === null) return "Sem posição no período";
  return `${rank.position}º lugar`;
}

export function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

export function addressLines(c: { address: string; address_number: string; address_complement: string; neighborhood: string; city: string; state: string; cep: string }): string[] {
  const street = [c.address, c.address_number].filter(Boolean).join(", ");
  const first = [street, c.address_complement].filter(Boolean).join(" · ");
  const second = [c.neighborhood, c.city && c.state ? `${c.city}/${c.state}` : c.city || c.state].filter(Boolean).join(" · ");
  const cep = c.cep ? `CEP ${c.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : "";
  return [first, second, cep].filter(Boolean);
}

export function customerMapUrl(c: { latitude: number | null; longitude: number | null; address: string; address_number: string; city: string; state: string }): { url: string | null; confirmed: boolean } {
  if (c.latitude !== null && c.longitude !== null) {
    return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.latitude},${c.longitude}`)}`, confirmed: true };
  }
  const query = [c.address, c.address_number, c.city, c.state, "Brasil"].filter(Boolean).join(", ");
  if (!c.city && !c.address) return { url: null, confirmed: false };
  return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, confirmed: false };
}
