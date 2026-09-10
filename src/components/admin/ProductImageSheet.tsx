import { Sheet } from "@/components/ui/Sheet";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ProductImage } from "@/components/catalog/ProductImage";
import { useCatalogStore } from "@/store/catalog-store";

interface ProductImageSheetProps {
  productId: string | null;
  onClose: () => void;
}

export function ProductImageSheet({ productId, onClose }: ProductImageSheetProps) {
  const updateProduct = useCatalogStore((state) => state.updateProduct);
  const product = useCatalogStore((state) => state.products.find((item) => item.id === productId)) ?? null;

  return (
    <Sheet open={product !== null} onClose={onClose} title={product ? product.name : "Imagem do produto"}>
      {product && (
        <div className="flex flex-col gap-4">
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-forest-950/10">
            <ProductImage imageUrl={product.imageUrl} name={product.name} />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">
            {product.imageUrl ? "Alterar imagem" : "Adicionar imagem"}
          </p>
          <ImageUploader onUploaded={(url) => updateProduct(product.id, { imageUrl: url })} />
        </div>
      )}
    </Sheet>
  );
}
