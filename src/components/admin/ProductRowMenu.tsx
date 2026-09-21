import { useNavigate } from "react-router-dom";
import { ExternalLink, Eye, EyeOff, Trash2, Warehouse } from "lucide-react";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";
import type { Product } from "@/types/product";

export interface ProductRowActions {
  onEditImage: (productId: string) => void;
  onDuplicate: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductRowMenu({ product, actions }: { product: Product; actions: Pick<ProductRowActions, "onToggleActive" | "onDelete"> }) {
  const navigate = useNavigate();
  return (
    <RowActionsMenu
      items={[
        {
          label: product.active ? "Desativar" : "Ativar",
          icon: product.active ? <EyeOff size={16} /> : <Eye size={16} />,
          onClick: () => actions.onToggleActive(product),
        },
        { label: "Ver estoque", icon: <Warehouse size={16} />, onClick: () => navigate(`/admin/estoque/${product.id}`) },
        {
          label: "Ver no catálogo",
          icon: <ExternalLink size={16} />,
          onClick: () => window.open(`/#product-${product.id}`, "_blank", "noopener"),
        },
        { label: "Excluir permanentemente", icon: <Trash2 size={16} />, destructive: true, onClick: () => actions.onDelete(product) },
      ]}
    />
  );
}
