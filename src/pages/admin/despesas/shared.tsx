import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Expense, ExpenseStatus } from "@/store/despesas-store";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const STATUS_TONE: Record<ExpenseStatus, string> = {
  ABERTO: "bg-ink-900/5 text-ink-700",
  AGENDADO: "bg-blue-50 text-blue-700",
  PAGO: "bg-emerald-50 text-emerald-700",
  ATRASADO: "bg-red-50 text-red-700",
  BLOQUEADO: "bg-amber-50 text-amber-800",
};

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  ABERTO: "Em aberto",
  AGENDADO: "Agendado",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  BLOQUEADO: "Bloqueado",
};

/** Preserva o contexto atual (period/origin/status/search) ao navegar para um destino, conforme RFC §11/§12. */
export function withContext(path: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Tabela com LINHA INTEIRA clicável (DRT §1/§2). Botões internos devem usar
 * stopPropagation para não disparar a navegação da linha. Abre o detalhe como modal
 * (ExpenseDetailModal), preservando o contexto de filtros atual na URL.
 */
export function ExpenseTable({ rows, emptyMessage }: { rows: Expense[]; emptyMessage?: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  if (rows.length === 0) {
    return <p className="p-6 text-center text-sm text-ink-muted">{emptyMessage ?? "Nenhum lançamento encontrado."}</p>;
  }

  function openDetail(id: string) {
    navigate(withContext(`/admin/despesas/${id}`, params));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3">Despesa / origem</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Vencimento</th>
            <th className="px-4 py-3">Forma</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr
              key={e.id}
              onClick={() => openDetail(e.id)}
              className="cursor-pointer border-b border-forest-950/5 last:border-none hover:bg-forest-950/5"
              tabIndex={0}
              role="button"
              aria-label={`Abrir detalhe de ${e.description}`}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") openDetail(e.id);
              }}
            >
              <td className="px-4 py-3">
                <p className="font-semibold text-ink-900">{e.description}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {[e.partyName, e.documentRef].filter(Boolean).join(" · ") || (e.sourceModule ? `Origem: ${e.sourceModule}` : "Lançamento direto")}
                </p>
              </td>
              <td className="px-4 py-3 text-ink-700/70">{e.category}</td>
              <td className="px-4 py-3 text-ink-700/70">{e.dueDate ?? "-----"}</td>
              <td className="px-4 py-3 text-ink-700/70">{e.pattern === "fixed" ? "Fixa" : e.pattern === "variable" ? "Variável" : "Eventual"}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-ink-900">{brl(e.amount)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openDetail(e.id);
                  }}
                  className="text-xs font-semibold text-forest-800 hover:underline"
                >
                  Abrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BackToOverview({ params }: { params: URLSearchParams }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(withContext("/admin/despesas", params))}
      className="inline-flex items-center gap-1 rounded-[10px] border px-3 py-1.5 text-sm font-bold"
      style={{ borderColor: "#d8dfd7", color: C.green }}
    >
      ← Visão Geral
    </button>
  );
}

/** Equivalente ao `pageHeader()` do HTML V2: breadcrumb + voltar + título + subtítulo + ação. */
export function DetailHeader({
  crumb,
  title,
  subtitle,
  params,
  action,
}: {
  crumb: string;
  title: string;
  subtitle: string;
  params: URLSearchParams;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="mb-1 flex flex-col gap-3">
      <div className="text-xs" style={{ color: C.muted }}>Início › Despesas › {crumb}</div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackToOverview params={params} />
          <h1 className="mt-3 text-[28px] font-extrabold tracking-tight" style={{ color: C.green }}>{title}</h1>
          <p className="text-sm" style={{ color: C.muted }}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={() => navigate(withContext("/admin/despesas/nova", params))}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: C.accent }}
          >
            ＋ Nova despesa
          </button>
        </div>
      </div>
    </div>
  );
}

/** Equivalente a `.detail-kpis`: grid de 4 cards no topo de cada tela de aprofundamento. */
export function DetailKpis({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-[14px] border bg-white p-[15px]" style={{ borderColor: C.line }}>
          <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{it.label}</span>
          <strong className="mt-[7px] block text-xl" style={{ color: C.green }}>{it.value}</strong>
        </div>
      ))}
    </div>
  );
}
