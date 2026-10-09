import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useDespesasStore, type ExpenseOrigin, type ExpenseStatus } from "@/store/despesas-store";
import { AdminState } from "@/components/admin/AdminState";
import { DetailHeader, ExpenseTable, STATUS_LABEL, brl } from "@/pages/admin/despesas/shared";
import { useDespesasFilters } from "@/pages/admin/despesas/useDespesasFilters";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;

const ORIGIN_LABEL: Record<ExpenseOrigin, string> = {
  stock: "Insumos e Mercadorias",
  asset: "Bens e Investimentos",
  expense: "Serviços e Outras Despesas",
  salary: "Gestão Salarial",
  commission: "Força de Vendas / Comissões",
  partner: "Sócios e Retiradas",
};

const ORIGIN_EXPLAIN: Record<ExpenseOrigin, string> = {
  stock: "Compras de insumos e mercadorias. Entra no estoque somente após recebimento confirmado.",
  asset: "Nasce em Despesas e credita o saldo em formação da categoria patrimonial — não cria ativo individual automaticamente.",
  expense: "Despesas operacionais, serviços e outros compromissos classificados fora das demais origens.",
  salary: "Obrigação salarial resolvida pela vigência vigente em Colaboradores. Vale reduz saldo, não duplica a despesa.",
  commission: "Comissões reconhecidas pela Força de Vendas, sempre separadas do salário-base.",
  partner: "Aportes e retiradas de sócios, distintos de fornecedor/compra.",
};

const STATUS_OPTIONS: ExpenseStatus[] = ["ABERTO", "AGENDADO", "PAGO", "ATRASADO", "BLOQUEADO"];

export function DespesasOrigemPage() {
  const { origin } = useParams<{ origin: string }>();
  const { params, period, referenceDate, status: statusFilter, search, update } = useDespesasFilters();
  const subcategory = params.get("subcategory") ?? "";
  const expenses = useDespesasStore((s) => s.expenses);
  const fetchAll = useDespesasStore((s) => s.fetchAll);
  const loadStatus = useDespesasStore((s) => s.status);
  const getByPeriod = useDespesasStore((s) => s.getByPeriod);

  useEffect(() => {
    if (expenses.length === 0) fetchAll();
  }, [expenses.length, fetchAll]);

  // Escopo fixo da origem + período (BUG 02: já por vencimento) — base dos KPIs e das opções de
  // subcategoria, sem considerar busca/status/subcategoria (mesmo padrão da tela principal).
  const rows = useMemo(
    () => getByPeriod(period, referenceDate).filter((e) => e.origin === origin),
    [getByPeriod, period, referenceDate, origin, expenses]
  );

  // Subcategorias reais desta origem — vêm dos próprios lançamentos, nunca uma lista fixa (BUG 03 §4).
  const subcategoryOptions = useMemo(
    () => [...new Set(rows.map((e) => e.subcategory).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (subcategory) list = list.filter((e) => e.subcategory === subcategory);
    if (statusFilter) list = list.filter((e) => e.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.subcategory?.toLowerCase().includes(q) ?? false) ||
          (e.partyName?.toLowerCase().includes(q) ?? false) ||
          (e.documentRef?.toLowerCase().includes(q) ?? false) ||
          (e.installmentNumber ? `${e.installmentNumber}`.padStart(2, "0").includes(q) : false)
      );
    }
    return list;
  }, [rows, subcategory, statusFilter, search]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  // KPIs sempre sobre o escopo da origem (rows), nunca sobre `filtered` — clicar neles É o que
  // define o filtro de status, não o contrário (BUG 03 §7.1/§7.5).
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const pago = rows.reduce((s, e) => s + (e.paidAmount ?? 0), 0);
  const aPagarRows = rows.filter((e) => e.status === "ABERTO" || e.status === "ATRASADO" || e.status === "BLOQUEADO");
  const aPagar = aPagarRows.reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);
  const label = ORIGIN_LABEL[origin as ExpenseOrigin] ?? origin ?? "";

  const kpiCards: { label: string; value: string; statusKey: string | null }[] = [
    { label: "Total da origem", value: brl(total), statusKey: null },
    { label: "Lançamentos", value: String(rows.length), statusKey: null },
    { label: "Pago", value: brl(pago), statusKey: "PAGO" },
    { label: "A pagar", value: brl(aPagar), statusKey: "ABERTO" },
  ];

  if (loadStatus === "loading" && expenses.length === 0) return <AdminState variant="loading" message="Carregando..." />;

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader crumb={label} title={label} subtitle={`Detalhamento por origem · ${ORIGIN_EXPLAIN[origin as ExpenseOrigin] ?? ""}`} params={params} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => update({ status: kpi.statusKey })}
            className="rounded-[14px] border bg-white p-[15px] text-left transition hover:-translate-y-0.5"
            style={{ borderColor: kpi.statusKey && statusFilter === kpi.statusKey ? "#cfe1d2" : C.line, background: kpi.statusKey && statusFilter === kpi.statusKey ? "#f4f9f2" : "#fff" }}
          >
            <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{kpi.label}</span>
            <strong className="mt-[7px] block text-xl" style={{ color: C.green }}>{kpi.value}</strong>
          </button>
        ))}
      </div>

      {(origin === "asset" || origin === "stock") && (
        <p className="rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: "#edf5ee", color: "#356449" }}>
          {origin === "asset"
            ? "Conexão com Patrimônio: estes valores alimentam o saldo em formação por categoria. O bem individual só nasce no Patrimônio quando for apropriado, abatendo esse saldo sem duplicar a compra."
            : "Conexão com Estoque: compras de insumos e mercadorias reaproveitam os produtos/cadastros da antiga tela Matéria-Prima e não entram novamente como custo indireto."}
        </p>
      )}

      <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
        <div className="border-b p-4" style={{ borderColor: C.line }}>
          <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Categorias desta origem</h2>
          <p className="text-[11px]" style={{ color: C.muted }}>Distribuição interna</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2">
          {byCategory.map(([cat, value]) => (
            <div key={cat} className="rounded-xl border p-3.5" style={{ borderColor: C.line }}>
              <span className="text-[11px]" style={{ color: C.muted }}>{cat}</span>
              <strong className="mt-1 block" style={{ color: C.green }}>{brl(value)}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
        <div className="border-b p-4" style={{ borderColor: C.line }}>
          <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Lançamentos desta origem</h2>
          <p className="text-[11px]" style={{ color: C.muted }}>Pesquise por despesa, fornecedor, colaborador, sócio, documento ou parcela.</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 p-4 pb-2.5 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide" style={{ color: "#7a8179" }}>Busca geral</label>
            <input
              value={search}
              onChange={(e) => update({ search: e.target.value || null })}
              placeholder="Ex.: aluguel, fornecedor, NF 2431..."
              className="h-11 w-full rounded-[10px] border px-3 text-sm"
              style={{ borderColor: "#d9ded7" }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide" style={{ color: "#7a8179" }}>Subcategoria</label>
            <select value={subcategory} onChange={(e) => update({ subcategory: e.target.value || null })} className="h-11 w-full rounded-[10px] border px-3 text-sm" style={{ borderColor: "#d9ded7" }}>
              <option value="">Todas as subcategorias</option>
              {subcategoryOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide" style={{ color: "#7a8179" }}>Status</label>
            <select value={statusFilter} onChange={(e) => update({ status: e.target.value || null })} className="h-11 w-full rounded-[10px] border px-3 text-sm" style={{ borderColor: "#d9ded7" }}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <ExpenseTable rows={filtered} />
      </div>
    </div>
  );
}
