import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/currency";
import { ITEM_TYPE_LABEL, SITUATION_LABEL, SITUATION_TONE, summarizePosition } from "@/lib/estoque";
import { normalizeText } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { useEstoqueStore } from "@/store/estoque-store";
import type { StockItemType, StockPositionItem, StockSituation } from "@/types/estoque";

const selectCls = "min-h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

function detailPath(item: StockPositionItem): string {
  return item.itemType === "PRODUCT" ? `/admin/estoque/${item.itemId}` : `/admin/materias-primas/${item.itemId}`;
}

export function EstoqueGestaoGeral() {
  const position = useEstoqueStore((state) => state.position);
  const status = useEstoqueStore((state) => state.positionStatus);
  const fetchPosition = useEstoqueStore((state) => state.fetchPosition);

  const [typeFilter, setTypeFilter] = useState<StockItemType | "ALL">("ALL");
  const [situationFilter, setSituationFilter] = useState<StockSituation | "ALL">("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void fetchPosition();
  }, [fetchPosition]);

  const filtered = useMemo(() => {
    const term = normalizeText(query.trim());
    return position.filter(
      (item) =>
        (typeFilter === "ALL" || item.itemType === typeFilter) &&
        (situationFilter === "ALL" || item.situation === situationFilter) &&
        (term === "" || normalizeText(`${item.name} ${item.sku} ${item.category}`).includes(term))
    );
  }, [position, typeFilter, situationFilter, query]);

  const summary = useMemo(() => summarizePosition(filtered), [filtered]);

  if (status === "loading" || status === "idle") return <AdminState variant="loading" message="Carregando posição do estoque..." />;
  if (status === "error") return <AdminState variant="error" message="Não foi possível carregar o estoque." onRetry={() => void fetchPosition()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Itens" value={formatNumber(summary.total)} hint="Produtos e matérias-primas" />
        <StatCard
          label="Valor a custo"
          value={formatCurrency(summary.valueAtCost)}
          hint={summary.itemsWithoutCost > 0 ? `${summary.itemsWithoutCost} itens com saldo e sem custo cadastrado` : "Custo médio ponderado"}
        />
        <StatCard label="Zerados" value={summary.zeroed} tone={summary.zeroed > 0 ? "danger" : "default"} />
        <StatCard label="Abaixo do mínimo" value={summary.low} tone={summary.low > 0 ? "warning" : "default"} />
        <StatCard label="Reservado" value={formatNumber(summary.reservedUnits)} hint="Pedidos confirmados, ainda não separados" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, SKU ou categoria"
            aria-label="Buscar item de estoque"
            className="min-h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={selectCls} aria-label="Tipo de item">
          <option value="ALL">Todos os tipos</option>
          <option value="PRODUCT">Produtos</option>
          <option value="RAW_MATERIAL">Matérias-primas</option>
        </select>
        <select
          value={situationFilter}
          onChange={(e) => setSituationFilter(e.target.value as typeof situationFilter)}
          className={selectCls}
          aria-label="Situação"
        >
          <option value="ALL">Todas as situações</option>
          {(Object.keys(SITUATION_LABEL) as StockSituation[]).map((key) => (
            <option key={key} value={key}>
              {SITUATION_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <AdminState variant="empty" message="Nenhum item encontrado." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Físico</th>
                  <th className="px-4 py-3 text-right">Reservado</th>
                  <th className="px-4 py-3 text-right">Disponível</th>
                  <th className="px-4 py-3 text-right">Mínimo</th>
                  <th className="px-4 py-3 text-right">Valor a custo</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={`${item.itemType}-${item.itemId}`} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                    <td className="px-4 py-3">
                      <Link to={detailPath(item)} className="font-semibold text-ink-900 hover:underline">
                        {item.name}
                      </Link>
                      <p className="font-mono text-[11px] text-ink-muted">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">{ITEM_TYPE_LABEL[item.itemType]}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(item.physical)} {item.baseUnit}</td>
                    <td className="px-4 py-3 text-right text-ink-700/70">{item.reserved > 0 ? formatNumber(item.reserved) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(item.available)}</td>
                    <td className="px-4 py-3 text-right text-ink-700/70">{item.minStock > 0 ? formatNumber(item.minStock) : "—"}</td>
                    <td className="px-4 py-3 text-right text-ink-700/70">
                      {item.stockValue === null ? <span title="Produto sem custo cadastrado">Sem custo</span> : formatCurrency(item.stockValue)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={SITUATION_TONE[item.situation]}>{SITUATION_LABEL[item.situation]}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((item) => (
              <Link
                key={`${item.itemType}-${item.itemId}`}
                to={detailPath(item)}
                className="flex flex-col gap-2 rounded-2xl border border-forest-950/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-forest-950">{item.name}</p>
                    <p className="font-mono text-xs text-ink-muted">
                      {item.sku} · {ITEM_TYPE_LABEL[item.itemType]}
                    </p>
                  </div>
                  <StatusBadge tone={SITUATION_TONE[item.situation]} className="shrink-0">
                    {SITUATION_LABEL[item.situation]}
                  </StatusBadge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-ink-muted">
                  <span>
                    Físico
                    <strong className="block text-sm text-ink-900">
                      {formatNumber(item.physical)} {item.baseUnit}
                    </strong>
                  </span>
                  <span>
                    Reservado
                    <strong className="block text-sm text-ink-900">{formatNumber(item.reserved)}</strong>
                  </span>
                  <span>
                    Disponível
                    <strong className="block text-sm text-ink-900">{formatNumber(item.available)}</strong>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
      <p className="text-xs text-ink-muted">
        Disponível = físico − reservado. Valor a custo usa o custo médio ponderado; produtos acabados ainda não têm custo cadastrado e aparecem como "Sem custo".
      </p>
    </div>
  );
}
