import { Droplets, FlaskConical, Flame, Package, Package2, PackageOpen, type LucideIcon } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  "sal-churrasco": Flame,
  frascos: FlaskConical,
  potes: Package2,
  molhos: Droplets,
  saches: PackageOpen,
  "linha-maior": Package,
};

export function getCategoryIcon(categorySlug: string): LucideIcon {
  return categoryIcons[categorySlug] ?? Package;
}
