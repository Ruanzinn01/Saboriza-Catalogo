import { cn } from "@/lib/cn";
import { getCategoryIcon } from "@/lib/category-icons";
import type { Category } from "@/types/category";

interface CategoryNavProps {
  categories: Category[];
  activeCategoryId: string;
  onSelect: (categoryId: string) => void;
}

export function CategoryNav({ categories, activeCategoryId, onSelect }: CategoryNavProps) {
  return (
    <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((category) => {
        const Icon = getCategoryIcon(category.id);
        const isActive = activeCategoryId === category.id;
        return (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              isActive
                ? "bg-linear-to-b from-gold-400 to-gold-600 text-forest-950 shadow-sm shadow-gold-600/25"
                : "bg-cream-50/10 text-cream-100/80 hover:bg-cream-50/20"
            )}
          >
            <Icon size={15} />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
