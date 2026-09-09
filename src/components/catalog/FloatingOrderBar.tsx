import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { calculateCartTotal, calculateItemCount } from "@/lib/pricing";
import { formatCurrency } from "@/lib/currency";

export function FloatingOrderBar({ onClick }: { onClick: () => void }) {
  const items = useCartStore((state) => state.items);
  const itemCount = calculateItemCount(items);

  if (itemCount === 0) return null;

  const total = calculateCartTotal(items);

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-linear-to-b from-forest-500 to-forest-700 px-5 py-3 text-sm font-bold text-cream-50 shadow-2xl shadow-forest-950/40 transition-all hover:from-forest-500 hover:to-forest-600 active:scale-[0.97]"
    >
      <ShoppingBag size={18} /> Ver pedido ({itemCount}) · {formatCurrency(total)}
    </button>
  );
}
