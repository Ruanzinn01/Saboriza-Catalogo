import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatQuantity } from "@/lib/inventory";
import { useInventoryStore } from "@/store/inventory-store";
import type { InventoryResultRow } from "@/types/inventory";

interface InventoryResultsProps {
  sessionId: string;
  refreshKey: number;
}

export function InventoryResults({ sessionId, refreshKey }: InventoryResultsProps) {
  const fetchResults = useInventoryStore((state) => state.fetchResults);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<InventoryResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetchResults(sessionId).then((result) => {
      setRows(result.data);
      setError(result.error);
    });
  }, [open, sessionId, refreshKey, fetchResults]);

  const divergent = rows.filter((row) => row.difference !== 0);

  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-forest-950/10 bg-white p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-11 text-left text-sm font-bold text-forest-950">
        {open ? "Ocultar resultados" : "Ver resultados da sessão"}
      </button>
      {open && error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      {open && !error && (
        <>
          <p className="text-xs text-ink-muted">
            {rows.length} contagens · {divergent.length} com divergência. Ajuste de saldo é tratado pelo Estoque; contar não altera o saldo.
          </p>
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={`${row.sessionItemId}-${row.round}`} className="flex flex-col gap-0.5 rounded-xl bg-ink-900/[0.03] p-3 text-xs">
                <span className="text-sm font-bold text-ink-900">
                  {row.name} <span className="font-mono text-[11px] text-ink-muted">{row.sku}</span>
                </span>
                <span className="text-ink-muted">
                  Rodada {row.round} · contado {formatQuantity(row.baseQuantity)} · saldo fotografado {formatQuantity(row.expectedBalance)} ·{" "}
                  <span className={cn("font-bold", row.difference === 0 ? "text-forest-950" : "text-red-700")}>
                    diferença {row.difference > 0 ? "+" : ""}
                    {formatQuantity(row.difference)}
                  </span>
                </span>
                <span className="text-ink-muted">
                  {row.countedByName} · {formatDateTime(row.countedAt)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
