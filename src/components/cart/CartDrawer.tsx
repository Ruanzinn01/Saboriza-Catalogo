import { useNavigate } from "react-router-dom";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { CartLineItem } from "./CartLineItem";
import { useCartStore } from "@/store/cart-store";
import { calculateCartTotal } from "@/lib/pricing";
import { formatCurrency } from "@/lib/currency";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useCartStore((state) => state.items);
  const navigate = useNavigate();
  const total = calculateCartTotal(items);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Seu pedido"
      footer={
        items.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-base font-extrabold text-forest-950">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <Button
              size="lg"
              onClick={() => {
                onClose();
                navigate("/checkout");
              }}
            >
              Finalizar pedido
            </Button>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-ink-700/60">
          <p className="text-sm">Seu carrinho está vazio.</p>
          <p className="text-xs">Adicione produtos do catálogo para montar seu pedido.</p>
        </div>
      ) : (
        items.map((item) => <CartLineItem key={item.productId} item={item} />)
      )}
    </Sheet>
  );
}
