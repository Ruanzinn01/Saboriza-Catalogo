import { Minus, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { calculateLineTotal } from "@/lib/pricing";
import { useCartStore } from "@/store/cart-store";
import type { CartItem } from "@/types/cart";

export function CartLineItem({ item }: { item: CartItem }) {
  const increasePack = useCartStore((state) => state.increasePack);
  const decreasePack = useCartStore((state) => state.decreasePack);
  const removeItem = useCartStore((state) => state.removeItem);

  const lineTotal = calculateLineTotal(item.unitPrice, item.packQuantity, item.packs);

  return (
    <div className="flex gap-3 border-b border-ink-900/10 py-4 last:border-none">
      <img src={item.imageUrl} alt={item.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-ink-900">
            {item.name} · {item.presentation} · {item.weight}
          </p>
          <button
            onClick={() => removeItem(item.productId)}
            className="text-ink-700/40 hover:text-red-600"
            aria-label="Remover item"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <p className="text-xs text-ink-700/60">
          {item.packs} {item.packs === 1 ? "pack" : "packs"} × {item.packQuantity} un ({formatCurrency(item.unitPrice)} / unid)
        </p>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full border border-ink-900/15 px-1">
            <button
              onClick={() => decreasePack(item.productId)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-900 hover:bg-ink-900/5"
              aria-label="Diminuir packs"
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-sm font-bold">{item.packs}</span>
            <button
              onClick={() => increasePack(item.productId)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-900 hover:bg-ink-900/5"
              aria-label="Aumentar packs"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-sm font-extrabold text-forest-900">{formatCurrency(lineTotal)}</span>
        </div>
      </div>
    </div>
  );
}
