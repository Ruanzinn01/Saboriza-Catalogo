import { Link } from "react-router-dom";
import { Search, Settings, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { calculateItemCount } from "@/lib/pricing";
import { cn } from "@/lib/cn";
import { getCategoryIcon } from "@/lib/category-icons";
import { BrandEmblem } from "./BrandEmblem";
import type { Category } from "@/types/category";

interface TopBarProps {
  onCartClick?: () => void;
  onSearchClick?: () => void;
  showCart?: boolean;
  dark?: boolean;
  centerLogo?: boolean;
  categories?: Category[];
  activeCategoryId?: string;
  onSelectCategory?: (categoryId: string) => void;
}

export function TopBar({
  onCartClick,
  onSearchClick,
  showCart = true,
  dark = true,
  centerLogo = false,
  categories,
  activeCategoryId,
  onSelectCategory,
}: TopBarProps) {
  const itemCount = useCartStore((state) => calculateItemCount(state.items));

  return (
    <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
      <Link
        to="/"
        className={cn(
          "flex shrink-0 items-center leading-none",
          centerLogo && "absolute left-1/2 -translate-x-1/2"
        )}
      >
        <BrandEmblem size="sm" />
      </Link>

      <div className="ml-auto flex items-center gap-4">
        {categories && categories.length > 0 && (
          <nav className="hidden min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => {
              const Icon = getCategoryIcon(category.id);
              const isActive = activeCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => onSelectCategory?.(category.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    isActive
                      ? "bg-linear-to-b from-gold-400 to-gold-600 text-forest-950 shadow-sm shadow-gold-600/25"
                      : dark
                        ? "text-cream-100/70 hover:bg-cream-50/10 hover:text-cream-50"
                        : "text-forest-900/70 hover:bg-forest-950/5 hover:text-forest-950"
                  )}
                >
                  <Icon size={13} />
                  {category.name}
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className={
                dark
                  ? "flex h-11 w-11 items-center justify-center rounded-full text-cream-50/60 transition-colors hover:bg-cream-50/10 hover:text-cream-50"
                  : "flex h-11 w-11 items-center justify-center rounded-full text-forest-950/50 transition-colors hover:bg-forest-950/5"
              }
              aria-label="Buscar produtos"
            >
              <Search size={20} />
            </button>
          )}
          <Link
            to="/admin/login"
            className={
              dark
                ? "flex h-11 w-11 items-center justify-center rounded-full text-cream-50/60 transition-colors hover:bg-cream-50/10 hover:text-cream-50"
                : "flex h-11 w-11 items-center justify-center rounded-full text-forest-950/50 transition-colors hover:bg-forest-950/5"
            }
            aria-label="Acesso administrativo"
          >
            <Settings size={20} />
          </Link>
          {showCart && (
            <button
              onClick={onCartClick}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-b from-gold-400 to-gold-600 text-forest-950 shadow-sm shadow-gold-600/25 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-95"
              aria-label="Abrir carrinho"
            >
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-forest-900 px-1 text-[11px] font-bold text-cream-50">
                  {itemCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
