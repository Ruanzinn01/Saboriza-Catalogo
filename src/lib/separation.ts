import type { AgingLevel } from "@/types/separation";

export const AGING_COLORS: Record<AgingLevel, string> = {
  normal: "bg-ink-900/10 text-ink-700",
  atencao: "bg-amber-400/20 text-amber-800",
  "laranja-claro": "bg-orange-300/30 text-orange-800",
  "laranja-forte": "bg-orange-500/25 text-orange-900",
  vermelho: "bg-red-500/15 text-red-700",
  critico: "bg-ink-900 text-cream-50",
};

export function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function agingLevel(days: number): AgingLevel {
  if (days <= 2) return "normal";
  if (days === 3) return "atencao";
  if (days === 4) return "laranja-claro";
  if (days === 5) return "laranja-forte";
  if (days <= 9) return "vermelho";
  return "critico";
}

export function formatDaysLabel(days: number): string {
  if (days === 0) return "Hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

export function packsLabel(packs: number, packQuantity: number): string {
  return `${packs} ${packs === 1 ? "pack" : "packs"} × ${packQuantity} un`;
}

export function durationLabel(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "-----";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffMinutes = Math.max(0, Math.round((end - start) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}
