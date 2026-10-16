import { supabase } from "@/lib/supabase";
import type { CreditBlocker, CreditSnapshot } from "@/store/faturar-store";

export type CreditOverviewResult =
  | { state: "ready"; overview: CreditSnapshot }
  | { state: "unavailable" };

export async function fetchCreditOverview(customerId: string): Promise<CreditOverviewResult> {
  const { data, error } = await supabase.rpc("oris360_credit_overview", { p_customer_id: customerId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return { state: "unavailable" };
  return { state: "ready", overview: data as unknown as CreditSnapshot };
}

export async function setCustomerCreditLimit(
  customerId: string,
  newLimit: number,
  reason: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("oris360_set_credit_limit", {
    p_customer_id: customerId,
    p_new_limit: newLimit,
    p_reason: reason,
  });
  return { error: error ? error.message : null };
}

export interface CreditUsage {
  usedPercent: number | null;
  barPercent: number;
  excess: number;
}

export function getCreditUsage(overview: Pick<CreditSnapshot, "credit_limit" | "current_exposure" | "current_excess">): CreditUsage {
  const excess = overview.current_excess ?? Math.max(0, overview.current_exposure - overview.credit_limit);
  if (!(overview.credit_limit > 0)) return { usedPercent: null, barPercent: 0, excess };
  const usedPercent = Math.round((overview.current_exposure / overview.credit_limit) * 100);
  return { usedPercent, barPercent: Math.min(100, Math.max(0, usedPercent)), excess };
}

export const CREDIT_BLOCKER_LABEL: Record<CreditBlocker, string> = {
  OVERDUE: "Títulos vencidos",
  OVER_LIMIT: "Limite excedido",
};

export function parseCreditLimitInput(raw: string): number | null {
  const trimmed = raw.trim();
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
