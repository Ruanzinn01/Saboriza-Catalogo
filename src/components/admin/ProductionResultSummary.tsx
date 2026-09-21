import { AlertCircle, CheckCircle2, X } from "lucide-react";

export interface ProductionResult {
  done: { productId: string; name: string; packs: number; units: number }[];
  failed: { productId: string; name: string; error: string }[];
}

interface ProductionResultSummaryProps {
  result: ProductionResult;
  onDismiss: () => void;
}

export function ProductionResultSummary({ result, onDismiss }: ProductionResultSummaryProps) {
  const totalUnits = result.done.reduce((sum, item) => sum + item.units, 0);
  const hasFailures = result.failed.length > 0;

  return (
    <section
      role={hasFailures ? "alert" : "status"}
      aria-label="Resumo do registro de produção"
      className={`rounded-3xl border p-5 ${hasFailures ? "border-amber-500/40 bg-amber-500/5" : "border-forest-700/30 bg-forest-700/5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasFailures ? <AlertCircle size={20} className="text-amber-700" /> : <CheckCircle2 size={20} className="text-forest-700" />}
          <p className="text-sm font-bold text-forest-950">
            {result.done.length > 0
              ? `${totalUnits} un registradas em ${result.done.length} produto${result.done.length > 1 ? "s" : ""}`
              : "Nada foi registrado"}
            {hasFailures && ` · ${result.failed.length} com erro`}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar resumo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-900/60 hover:bg-ink-900/5"
        >
          <X size={18} />
        </button>
      </div>

      {result.done.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-900">
          {result.done.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="shrink-0 font-semibold">
                {item.packs} pack{item.packs > 1 ? "s" : ""} · {item.units} un
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasFailures && (
        <div className="mt-3 flex flex-col gap-1.5">
          {result.failed.map((item) => (
            <p key={item.productId} className="text-xs font-semibold text-red-700">
              {item.name}: {item.error}. Continua na lista para tentar de novo.
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
