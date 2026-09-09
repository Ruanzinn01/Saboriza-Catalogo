import { ProductCard } from "./ProductCard";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";

interface CategorySectionProps {
  category: Category;
  products: Product[];
  onAdd: (product: Product) => void;
}

export function CategorySection({ category, products, onAdd }: CategorySectionProps) {
  if (products.length === 0) return null;

  return (
    <section id={category.id} className="scroll-mt-32 py-8">
      <div className="mb-4">
        <h2 className="w-fit bg-linear-to-r from-forest-950 to-forest-700 bg-clip-text text-xl font-extrabold text-transparent">
          {category.name}
        </h2>
        {category.tagline && <p className="text-sm text-ink-700/60">{category.tagline}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}
