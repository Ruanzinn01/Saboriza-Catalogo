import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";

interface CartState {
  items: CartItem[];
  addPack: (product: Product) => void;
  increasePack: (productId: string) => void;
  decreasePack: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addPack: (product) =>
        set((state) => {
          const existing = state.items.find((item) => item.productId === product.id);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.productId === product.id ? { ...item, packs: item.packs + 1 } : item
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                name: product.name,
                presentation: product.presentation,
                weight: product.weight,
                imageUrl: product.imageUrl,
                unitPrice: product.unitPrice,
                packQuantity: product.packQuantity,
                packs: 1,
              },
            ],
          };
        }),
      increasePack: (productId) =>
        set((state) => ({
          items: state.items.map((item) => (item.productId === productId ? { ...item, packs: item.packs + 1 } : item)),
        })),
      decreasePack: (productId) =>
        set((state) => ({
          items: state.items
            .map((item) => (item.productId === productId ? { ...item, packs: item.packs - 1 } : item))
            .filter((item) => item.packs > 0),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      clearCart: () => set({ items: [] }),
    }),
    { name: "saboriza-cart" }
  )
);
