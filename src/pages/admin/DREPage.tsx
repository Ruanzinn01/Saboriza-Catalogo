import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useDreStore } from "@/store/dre-store";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = (m: string) => new Date(m + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function Row({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-600" : "text-ink-900";
  return (
    <div className={`flex items-center justify-between border-b border-forest-950/5 px-4 py-2.5 last:border-none ${bold ? "font-extrabold" : ""}`}>
      <span className={bold ? "text-forest-950" : "text-ink-700/80"}>{label}</span>
      <span className={toneClass}>{brl(value)}</span>
    </div>
  );
}

export function DREPage() {
  const lines = useDreStore((s) => s.lines);
  const status = useDreStore((s) => s.status);
  const fetchAll = useDreStore((s) => s.fetchAll);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!selectedMonth && lines.length > 0) setSelectedMonth(lines[0].month);
  }, [lines, selectedMonth]);

  const current = lines.find((l) => l.month === selectedMonth) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">DRE Gerencial</h1>
        <p className="text-sm text-ink-muted">Resultado gerencial por competência, consumindo Vendas, Receitas, Despesas e Salários já confirmados.</p>
      </div>

      {status === "loading" && lines.length === 0 ? (
        <AdminState variant="loading" message="Carregando DRE..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar o DRE." />
      ) : lines.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma competência com movimento ainda." />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
            {lines.map((l) => (
              <button
                key={l.month}
                onClick={() => setSelectedMonth(l.month)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-semibold ${
                  selectedMonth === l.month ? "bg-forest-950 text-white" : "bg-forest-950/5 text-ink-700"
                }`}
              >
                {monthLabel(l.month)}
              </button>
            ))}
          </div>

          {current && (
            <div className="flex-1 overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
              <div className="flex items-center gap-2 border-b border-forest-950/10 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                <AlertTriangle size={14} />
                CMV/CPV e encargos financeiros ainda não são calculados (motor de custo pendente) — resultado abaixo considera essas linhas como zero.
              </div>
              <Row label="Receita Bruta" value={current.grossRevenue} />
              <Row label="Outras Receitas" value={current.otherRevenue} />
              <Row label="(-) Deduções e Descontos" value={-current.deductions} tone="negative" />
              <Row label="= Receita Líquida" value={current.netRevenue} bold />
              <Row label="(-) CMV/CPV" value={-current.cmvCpv} tone="negative" />
              <Row label="= Lucro Bruto" value={current.grossProfit} bold />
              <Row label="(-) Despesas Operacionais" value={-current.operatingExpenses} tone="negative" />
              <Row label="(-) Encargos Financeiros" value={-current.financialCharges} tone="negative" />
              <Row
                label="= Resultado Operacional Gerencial"
                value={current.managerialOperatingResult}
                bold
                tone={current.managerialOperatingResult >= 0 ? "positive" : "negative"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
