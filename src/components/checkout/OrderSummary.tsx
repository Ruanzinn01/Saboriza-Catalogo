import { calculateCartTotal, calculateLineTotal } from "@/lib/pricing";
import { calculateDiscount } from "@/lib/coupon";
import { formatCurrency } from "@/lib/currency";
import type { CartItem } from "@/types/cart";
import type { Coupon } from "@/types/coupon";

interface OrderSummaryProps {
  items: CartItem[];
  coupon?: Coupon | null;
}

export function OrderSummary({ items, coupon }: OrderSummaryProps) {
  const subtotal = calculateCartTotal(items);
  const discount = coupon ? calculateDiscount(coupon, subtotal) : 0;
  const total = subtotal - discount;

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
      <div className="mt-4 border-t border-forest-950/10 pt-4">
        {coupon && (
          <>
            <div className="flex items-center justify-between text-sm text-ink-700/70">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm font-semibold text-forest-800">
              <span>Desconto ({coupon.code})</span>
              <span>- {formatCurrency(discount)}</span>
            </div>
          </>
        )}
        <div className="mt-2 flex items-center justify-between text-base font-extrabold text-forest-950">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
