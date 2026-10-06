import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useDespesasStore, type ExpenseOrigin } from "@/store/despesas-store";
import { AdminState } from "@/components/admin/AdminState";
import { DetailHeader, DetailKpis, ExpenseTable, brl } from "@/pages/admin/despesas/shared";
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

export function DespesasOrigemPage() {
  const { origin } = useParams<{ origin: string }>();
  const { params, period, referenceDate } = useDespesasFilters();
  const expenses = useDespesasStore((s) => s.expenses);
  const fetchAll = useDespesasStore((s) => s.fetchAll);
  const status = useDespesasStore((s) => s.status);
  const getByPeriod = useDespesasStore((s) => s.getByPeriod);

  useEffect(() => {
    if (expenses.length === 0) fetchAll();
  }, [expenses.length, fetchAll]);

  const rows = useMemo(
    () => getByPeriod(period, referenceDate).filter((e) => e.origin === origin),
    [getByPeriod, period, referenceDate, origin, expenses]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const total = rows.reduce((s, e) => s + e.amount, 0);
  const pago = rows.filter((e) => e.status === "PAGO").reduce((s, e) => s + e.amount, 0);
  const aPagar = total - pago;
  const label = ORIGIN_LABEL[origin as ExpenseOrigin] ?? origin ?? "";

  if (status === "loading" && expenses.length === 0) return <AdminState variant="loading" message="Carregando..." />;

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader crumb={label} title={label} subtitle={`Detalhamento por origem · ${ORIGIN_EXPLAIN[origin as ExpenseOrigin] ?? ""}`} params={params} />

      <DetailKpis items={[
        { label: "Total da origem", value: brl(total) },
        { label: "Lançamentos", value: String(rows.length) },
        { label: "Pago", value: brl(pago) },
        { label: "A pagar", value: brl(aPagar) },
      ]} />

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
        <ExpenseTable rows={rows} />
      </div>
    </div>
  );
}
