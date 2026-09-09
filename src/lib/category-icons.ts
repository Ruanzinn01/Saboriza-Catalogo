import { Boxes, Droplets, FlaskConical, Flame, Package, Package2, type LucideIcon } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  "sal-churrasco": Flame,
  frascos: FlaskConical,
  potes: Package2,
  molhos: Droplets,
  saches: Package,
  "linha-maior": Boxes,
};

export function getCategoryIcon(categoryId: string): LucideIcon {
  return categoryIcons[categoryId] ?? Package;
}
