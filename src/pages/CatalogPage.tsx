import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { CategoryNav } from "@/components/catalog/CategoryNav";
import { CategorySection } from "@/components/catalog/CategorySection";
import { Hero } from "@/components/catalog/Hero";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/catalog/ProductCard";
import { SearchOverlay } from "@/components/catalog/SearchOverlay";
import { FloatingOrderBar } from "@/components/catalog/FloatingOrderBar";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCatalogStore } from "@/store/catalog-store";
import { useCartStore } from "@/store/cart-store";
import type { Product } from "@/types/product";

export function CatalogPage() {
  const categories = useCatalogStore((state) =>
    state.categories.filter((category) => category.active).sort((a, b) => a.order - b.order)
  );
  const products = useCatalogStore((state) => state.products.filter((product) => product.active));
  const addPack = useCartStore((state) => state.addPack);

  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const category of categories) {
      map.set(category.id, products.filter((product) => product.categoryId === category.id));
    }
    return map;
  }, [categories, products]);

  const bestSellers = useMemo(() => products.filter((product) => product.badge === "mais-pedido"), [products]);

  const categoryIdsKey = categories.map((category) => category.id).join(",");

  useEffect(() => {
    const sections = categoryIdsKey
      .split(",")
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategoryId(entry.target.id);
          }
        }
      },
      { rootMargin: "-140px 0px -70% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categoryIdsKey]);

  function handleSelectCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    document.getElementById(categoryId)?.scrollIntoView({ behavior: "smooth" });
  }

  function handleAdd(product: Product) {
    addPack(product);
    toast.success(`${product.name} adicionado ao pedido`);
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="sticky top-0 z-40 border-b border-black/10 bg-forest-950">
        <TopBar
          onCartClick={() => setCartOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelectCategory={handleSelectCategory}
        />
        <div className="lg:hidden">
          <CategoryNav categories={categories} activeCategoryId={activeCategoryId} onSelect={handleSelectCategory} />
        </div>
      </div>

      <Hero />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {bestSellers.length > 0 && (
          <section id="destaques" className="py-8">
            <div className="mb-4">
              <h2 className="w-fit bg-linear-to-r from-forest-950 to-forest-700 bg-clip-text text-xl font-extrabold text-transparent">
                Os queridinhos da Saboriza
              </h2>
              <p className="text-sm text-ink-700/60">Os temperos que conquistam seus clientes.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bestSellers.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={handleAdd} />
              ))}
            </div>
          </section>
        )}

        {categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            products={productsByCategory.get(category.id) ?? []}
            onAdd={handleAdd}
          />
        ))}
      </main>

      <Footer categories={categories} onSelectCategory={handleSelectCategory} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onSelectCategory={handleSelectCategory} />
      <FloatingOrderBar onClick={() => setCartOpen(true)} />
    </div>
  );
}
