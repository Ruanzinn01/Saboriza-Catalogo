import { cn } from "@/lib/cn";
import type { ProductBadge } from "@/types/product";

const badgeConfig: Record<ProductBadge, { label: string; className: string }> = {
  "mais-pedido": { label: "Mais pedido", className: "bg-linear-to-b from-forest-600 to-forest-800 text-cream-50" },
  novidade: { label: "Novidade", className: "bg-linear-to-b from-gold-400 to-gold-600 text-forest-950" },
  destaque: { label: "Destaque", className: "bg-linear-to-b from-ink-700 to-ink-900 text-cream-50" },
};

export function ProductBadgeTag({ badge }: { badge: ProductBadge }) {
  const config = badgeConfig[badge];
  return (
    <span
      className={cn(
        "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
