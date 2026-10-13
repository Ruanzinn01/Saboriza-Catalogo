import { useEffect, useMemo, useState } from "react";
import { AdminState } from "@/components/admin/AdminState";
import { cn } from "@/lib/cn";
import { ITEM_TYPE_LABEL, MOVEMENT_LABEL } from "@/lib/estoque";
import { formatDateTime } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { LEDGER_PAGE_SIZE, useEstoqueStore } from "@/store/estoque-store";
import type { LedgerMovementType, StockItemType } from "@/types/estoque";

const selectCls = "min-h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

export function EstoqueMovimentacoes() {
  const ledger = useEstoqueStore((state) => state.ledger);
  const status = useEstoqueStore((state) => state.ledgerStatus);
  const truncated = useEstoqueStore((state) => state.ledgerTruncated);
  const fetchLedger = useEstoqueStore((state) => state.fetchLedger);
  const position = useEstoqueStore((state) => state.position);
  const fetchPosition = useEstoqueStore((state) => state.fetchPosition);

  const [typeFilter, setTypeFilter] = useState<StockItemType | "ALL">("ALL");
  const [movementFilter, setMovementFilter] = useState<LedgerMovementType | "ALL">("ALL");

  useEffect(() => {
    void fetchLedger({
      itemType: typeFilter === "ALL" ? undefined : typeFilter,
      movementTypes: movementFilter === "ALL" ? undefined : [movementFilter],
    });
  }, [fetchLedger, typeFilter, movementFilter]);

  useEffect(() => {
    if (position.length === 0) void fetchPosition();
  }, [position.length, fetchPosition]);

  const namesById = useMemo(() => new Map(position.map((item) => [item.itemId, item])), [position]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={selectCls} aria-label="Tipo de item">
          <option value="ALL">Todos os tipos</option>
          <option value="PRODUCT">Produtos</option>
          <option value="RAW_MATERIAL">Matérias-primas</option>
        </select>
        <select
          value={movementFilter}
          onChange={(e) => setMovementFilter(e.target.value as typeof movementFilter)}
          className={selectCls}
          aria-label="Tipo de movimento"
        >
          <option value="ALL">Todos os movimentos</option>
          {(Object.keys(MOVEMENT_LABEL) as LedgerMovementType[]).map((key) => (
            <option key={key} value={key}>
              {MOVEMENT_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {status === "loading" && ledger.length === 0 ? (
        <AdminState variant="loading" message="Carregando movimentações..." />
      ) : status === "error" ? (
        <AdminState
          variant="error"
          message="Não foi possível carregar as movimentações."
          onRetry={() => void fetchLedger({ itemType: typeFilter === "ALL" ? undefined : typeFilter })}
        />
      ) : ledger.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma movimentação encontrada." />
      ) : (
        <div className="flex flex-col gap-2">
          {ledger.map((row) => {
            const item = namesById.get(row.itemId);
            const positive = row.quantity > 0;
            return (
              <div key={row.ledgerId} className="flex flex-col gap-1 rounded-2xl border border-forest-950/10 bg-white p-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{item?.name ?? "Item removido do cadastro"}</p>
                  <p className="text-xs text-ink-muted">
                    {MOVEMENT_LABEL[row.movementType]} · {ITEM_TYPE_LABEL[row.itemType]} · {formatDateTime(row.occurredAt)}
                  </p>
                  {row.note && <p className="truncate text-xs text-ink-muted">{row.note}</p>}
                </div>
                <div className="flex items-center gap-4 sm:justify-end">
                  <span className={cn("text-sm font-extrabold", positive ? "text-forest-800" : "text-red-700")}>
                    {positive ? "+" : ""}
                    {formatNumber(row.quantity)} {item?.baseUnit ?? ""}
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {row.previousBalance === null || row.newBalance === null
                      ? "saldo n/d"
                      : `${formatNumber(row.previousBalance)} → ${formatNumber(row.newBalance)}`}
                  </span>
                </div>
              </div>
            );
          })}
          {truncated && <p className="text-xs text-ink-muted">Mostrando os {LEDGER_PAGE_SIZE} movimentos mais recentes. Use os filtros para refinar.</p>}
        </div>
      )}
      <p className="text-xs text-ink-muted">
        O razão reúne, sem duplicar, as entradas de compra, saídas de pedido, produção, estornos e ajustes. Estornos de produção e de compra sem saldo anterior/posterior mostram "saldo n/d".
      </p>
    </div>
  );
}
