import { useEffect, useMemo } from "react";
import { useDespesasStore } from "@/store/despesas-store";
import { AdminState } from "@/components/admin/AdminState";
import { DetailHeader, DetailKpis, ExpenseTable, brl } from "@/pages/admin/despesas/shared";
import { useDespesasFilters } from "@/pages/admin/despesas/useDespesasFilters";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;

export function DespesasVencimentosPage() {
  const { params } = useDespesasFilters();
  const expenses = useDespesasStore((s) => s.expenses);
  const fetchAll = useDespesasStore((s) => s.fetchAll);
  const status = useDespesasStore((s) => s.status);

  useEffect(() => {
    if (expenses.length === 0) fetchAll();
  }, [expenses.length, fetchAll]);

  const rows = useMemo(
    () => expenses.filter((e) => e.status !== "PAGO" && e.dueDate).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [expenses]
  );

  const abertoTotal = rows.filter((e) => e.status === "ABERTO").reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);
  const agendadoTotal = rows.filter((e) => e.status === "AGENDADO").reduce((s, e) => s + e.amount, 0);
  const atrasadoTotal = rows.filter((e) => e.status === "ATRASADO").reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);
  const bloqueadoTotal = rows.filter((e) => e.status === "BLOQUEADO").reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);

  if (status === "loading" && expenses.length === 0) return <AdminState variant="loading" message="Carregando vencimentos..." />;

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader crumb="Próximos vencimentos" title="Próximos vencimentos" subtitle="Lista completa em ordem de vencimento, com agendados, atrasados e bloqueados." params={params} />

      <DetailKpis items={[
        { label: "A vencer / aberto", value: brl(abertoTotal) },
        { label: "Agendado", value: brl(agendadoTotal) },
        { label: "Atrasado", value: brl(atrasadoTotal) },
        { label: "Bloqueado", value: brl(bloqueadoTotal) },
      ]} />

      <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
        <ExpenseTable rows={rows} emptyMessage="Nenhum vencimento pendente." />
      </div>
    </div>
  );
}
