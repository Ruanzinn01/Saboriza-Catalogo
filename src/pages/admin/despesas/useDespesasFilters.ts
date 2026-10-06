import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ExpensePeriod } from "@/store/despesas-store";

/**
 * Estado de período/filtro da Visão Geral de Despesas, persistido em query params
 * para preservar contexto em drill-down/retorno (RFC §11, DRT §10).
 */
export function useDespesasFilters() {
  const [params, setParams] = useSearchParams();

  const period = (params.get("period") as ExpensePeriod | null) ?? "month";
  const monthRef = params.get("month") ?? new Date().toISOString().slice(0, 7);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const origin = params.get("origin") ?? "";
  const status = params.get("status") ?? "";
  const paymentMethod = params.get("payment") ?? "";
  const search = params.get("search") ?? "";

  const referenceDate = useMemo(() => {
    const [y, m] = monthRef.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1);
  }, [monthRef]);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: false });
  }

  function setPeriod(p: ExpensePeriod) {
    update({ period: p });
  }

  function moveMonth(delta: number) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + delta, 1);
    update({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, period: "month" });
  }

  function setMonth(ym: string) {
    update({ month: ym, period: "month" });
  }

  return {
    params,
    period,
    monthRef,
    referenceDate,
    from,
    to,
    origin,
    status,
    paymentMethod,
    search,
    setPeriod,
    moveMonth,
    setMonth,
    update,
  };
}
