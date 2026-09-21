import { cn } from "@/lib/cn";

interface StockRangeGaugeProps {
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit?: string;
}

const fmt = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function StockRangeGauge({ currentStock, minStock, maxStock, unit = "un" }: StockRangeGaugeProps) {
  if (minStock <= 0 && maxStock <= 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-900/20 bg-white/60 p-4 text-center text-xs text-ink-muted">
        Informe o estoque mínimo e o máximo para ver a faixa ideal do produto.
      </div>
    );
  }

  const top = Math.max(maxStock, minStock, currentStock, 1);
  const scale = maxStock > 0 ? Math.max(maxStock * 1.25, currentStock * 1.05) : Math.max(top * 1.25, 1);
  const pct = (value: number) => Math.min(100, Math.max(0, (value / scale) * 100));

  const lowEnd = pct(minStock);
  const okEnd = maxStock > 0 ? pct(maxStock) : 100;
  const marker = pct(currentStock);
  const state = currentStock <= 0 ? "out" : currentStock <= minStock ? "low" : maxStock > 0 && currentStock > maxStock ? "over" : "ok";
  const stateLabel = { out: "Sem estoque", low: "Abaixo do mínimo", over: "Acima do máximo", ok: "Dentro da faixa" }[state];

  return (
    <figure
      className="flex flex-col gap-2 rounded-2xl border border-forest-950/10 bg-white p-4"
      aria-label={`Faixa de estoque: mínimo ${fmt(minStock)}, máximo ${maxStock > 0 ? fmt(maxStock) : "não definido"}, atual ${fmt(currentStock)} ${unit}`}
    >
      <figcaption className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink-900">Faixa de estoque</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-semibold",
            state === "ok" && "bg-forest-700/10 text-forest-800",
            state === "low" && "bg-amber-500/15 text-amber-800",
            state === "out" && "bg-red-500/10 text-red-700",
            state === "over" && "bg-blue-500/10 text-blue-700"
          )}
        >
          {stateLabel}
        </span>
      </figcaption>

      <div className="relative mt-4 h-4 overflow-visible rounded-full bg-ink-900/10" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-amber-400/70" style={{ width: `${lowEnd}%` }} />
        <div className="absolute inset-y-0 bg-forest-600/70" style={{ left: `${lowEnd}%`, width: `${Math.max(0, okEnd - lowEnd)}%` }} />
        {maxStock > 0 && <div className="absolute inset-y-0 right-0 rounded-r-full bg-blue-400/60" style={{ left: `${okEnd}%` }} />}
        <div className="absolute -top-2 bottom-[-8px] w-0.5 bg-ink-900" style={{ left: `calc(${marker}% - 1px)` }} />
        <span
          className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold text-cream-50"
          style={{ left: `${Math.min(92, Math.max(8, marker))}%` }}
        >
          Atual: {fmt(currentStock)}
        </span>
      </div>

      <div className="relative mt-1 h-4 text-[11px] text-ink-muted" aria-hidden>
        <span className="absolute left-0">0</span>
        {minStock > 0 && (
          <span className="absolute -translate-x-1/2" style={{ left: `${Math.min(90, Math.max(10, lowEnd))}%` }}>
            Mín: {fmt(minStock)}
          </span>
        )}
        {maxStock > 0 && (
          <span className="absolute -translate-x-1/2" style={{ left: `${Math.min(92, Math.max(38, okEnd))}%` }}>
            Máx: {fmt(maxStock)}
          </span>
        )}
      </div>

      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-700">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Repor
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-forest-600" /> Ideal
        </li>
        {maxStock > 0 && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Excesso
          </li>
        )}
      </ul>
    </figure>
  );
}
