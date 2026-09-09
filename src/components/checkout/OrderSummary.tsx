import { calculateCartTotal, calculateLineTotal } from "@/lib/pricing";
import { formatCurrency } from "@/lib/currency";
import type { CartItem } from "@/types/cart";

export function OrderSummary({ items }: { items: CartItem[] }) {
  const total = calculateCartTotal(items);

  return (
    <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
      <h2 className="mb-4 text-lg font-extrabold text-forest-950">Seu pedido</h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.productId} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <p className="font-bold text-ink-900">
                {item.name} · {item.presentation} · {item.weight}
              </p>
              <p className="text-xs text-ink-700/60">
                {item.packs} {item.packs === 1 ? "pack" : "packs"} × {item.packQuantity} un
              </p>
            </div>
            <span className="shrink-0 font-bold text-forest-900">
              {formatCurrency(calculateLineTotal(item.unitPrice, item.packQuantity, item.packs))}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-forest-950/10 pt-4 text-base font-extrabold text-forest-950">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
