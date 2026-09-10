import { Boxes, Droplets, Flame, Leaf, Package, ShoppingBasket, Soup, Warehouse, type LucideIcon } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  combos: Boxes,
  temperos: ShoppingBasket,
  ervas: Leaf,
  molhos: Droplets,
  "sal-churrasco": Flame,
  naturais: Soup,
  "food-service": Warehouse,
  "linha-maior": Package,
};

export function getCategoryIcon(categorySlug: string): LucideIcon {
  return categoryIcons[categorySlug] ?? Package;
}
