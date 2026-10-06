import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useVendasStore } from "@/store/vendas-store";
import { AdminState } from "@/components/admin/AdminState";
import { DetailHeader, DetailKpis, brl, withContext } from "@/pages/admin/despesas/shared";
import { useDespesasFilters } from "@/pages/admin/despesas/useDespesasFilters";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;

/** Comissões vêm da Força de Vendas e permanecem sempre separadas do salário-base (PRD §5.9 / RFC §16). */
export function DespesasComissoesPage() {
  const navigate = useNavigate();
  const { params } = useDespesasFilters();
  const commissions = useVendasStore((s) => s.commissions);
  const fetchCommissions = useVendasStore((s) => s.fetchCommissions);
  const status = useVendasStore((s) => s.status);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const totals = useMemo(() => {
    const total = commissions.reduce((s, c) => s + c.commissionAmount, 0);
    const realizadas = commissions.filter((c) => c.status === "REALIZADA").reduce((s, c) => s + c.commissionAmount, 0);
    const aguardando = total - realizadas;
    const bySeller = new Map<string, { name: string; total: number }>();
    commissions.forEach((c) => {
      const entry = bySeller.get(c.employeeId) ?? { name: c.employeeName, total: 0 };
      entry.total += c.commissionAmount;
      bySeller.set(c.employeeId, entry);
    });
    return { total, realizadas, aguardando, bySeller: [...bySeller.values()].sort((a, b) => b.total - a.total) };
  }, [commissions]);

  if (status === "loading" && commissions.length === 0) return <AdminState variant="loading" message="Carregando comissões..." />;

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        crumb="Comissões"
        title="Comissões"
        subtitle="Comissões separadas do salário-base, vindas da Força de Vendas."
        params={params}
        action={
          <button onClick={() => navigate(withContext("/admin/despesas/pessoal", params))} className="rounded-xl border px-3 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
            Ver folha salarial
          </button>
        }
      />

      <DetailKpis items={[
        { label: "Total", value: brl(totals.total) },
        { label: "Realizadas", value: brl(totals.realizadas) },
        { label: "Aguardando", value: brl(totals.aguardando) },
        { label: "Vendedores", value: String(totals.bySeller.length) },
      ]} />

      <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wide" style={{ background: "#faf8f0", color: "#777d75" }}>
              <tr>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Data prevista</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b last:border-none" style={{ borderColor: C.line }}>
                  <td className="px-4 py-3"><strong style={{ color: C.green }}>{c.employeeName}</strong></td>
                  <td className="px-4 py-3" style={{ color: "#555" }}>Pedido {c.orderNumber}</td>
                  <td className="px-4 py-3" style={{ color: "#555" }}>{c.dueDate}</td>
                  <td className="px-4 py-3" style={{ color: "#555" }}>{c.status === "REALIZADA" ? "Realizada" : "Aguardando liquidação"}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: C.green }}>{brl(c.commissionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t p-4 text-xs leading-relaxed" style={{ borderColor: C.line, background: "#edf5ee", color: "#356449" }}>
          <strong>Regra:</strong> comissão não é salário-base. Deve permanecer identificada separadamente, embora componha a visão consolidada de despesas com pessoas/comercial quando aplicável.
        </p>
      </div>
    </div>
  );
}
