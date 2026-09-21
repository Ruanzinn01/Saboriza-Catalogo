import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useCatalogStore } from "@/store/catalog-store";
import { AdminState } from "@/components/admin/AdminState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/currency";
import { getSupplierDisplayName } from "@/lib/supplier-display";

export function SupplierDetailPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const status = useSuppliersStore((state) => state.status);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const deleteSupplier = useSuppliersStore((state) => state.deleteSupplier);
  const products = useCatalogStore((state) => state.products);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  useEffect(() => {
    if (suppliers.length === 0) fetchSuppliers();
    if (products.length === 0) fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supplier = suppliers.find((item) => item.id === supplierId);
  const supplierProducts = useMemo(
    () => products.filter((product) => product.supplierId === supplierId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [products, supplierId]
  );

  const summary = useMemo(
    () => ({
      count: supplierProducts.length,
      activeCount: supplierProducts.filter((product) => product.active).length,
    }),
    [supplierProducts]
  );

  async function handleDelete() {
    if (!supplier) return;
    const result = await deleteSupplier(supplier.id);
    if (result.blocked) {
      setDeleteBlocked(true);
      return;
    }
    if (result.ok) navigate("/admin/fornecedores");
  }

  if (status === "loading" && !supplier) {
    return <AdminState variant="loading" message="Carregando fornecedor..." />;
  }

  if (!supplier) {
    return <AdminState variant="empty" message="Fornecedor não encontrado." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/fornecedores" className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para Fornecedores
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">{getSupplierDisplayName(supplier)}</h1>
          <p className="text-sm text-ink-muted">{supplier.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/fornecedores/${supplier.id}/editar`}>
            <Button variant="outline">
              <Pencil size={16} /> Editar
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={16} /> Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Produtos vinculados</p>
          <p className="text-xl font-extrabold text-forest-950">{summary.count}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Produtos ativos</p>
          <p className="text-xl font-extrabold text-forest-950">{summary.activeCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Dados do fornecedor</p>
          <p className="text-sm text-ink-700/70">Telefone: <span className="font-semibold text-ink-900">{supplier.phone}</span></p>
          <p className="text-sm text-ink-700/70">E-mail: <span className="font-semibold text-ink-900">{supplier.email || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">Nome fantasia: <span className="font-semibold text-ink-900">{supplier.tradeName || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">CNPJ: <span className="font-semibold text-ink-900">{supplier.cnpj || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">Inscrição estadual: <span className="font-semibold text-ink-900">{supplier.ie || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">
            Endereço: <span className="font-semibold text-ink-900">{supplier.address || "-----"}</span>
          </p>
          <p className="text-sm text-ink-700/70">
            {supplier.neighborhood || "-----"} · {supplier.city || "-----"}/{supplier.state || "--"} · {supplier.cep || "-----"}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Produtos vinculados</p>
          {supplierProducts.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhum produto vinculado a este fornecedor ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-forest-950/5">
              {supplierProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/admin/produtos/${product.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-left hover:bg-forest-950/5"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{product.name}</p>
                    <p className="text-xs text-ink-muted">{product.presentation} · {product.weight}</p>
                  </div>
                  <span className="text-sm font-bold text-ink-900">{formatCurrency(product.unitPrice)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {deleteBlocked ? (
        <ConfirmDialog
          open
          onClose={() => setDeleteBlocked(false)}
          title="Não é possível excluir este fornecedor"
          description="Este fornecedor possui produtos vinculados e não pode ser excluído."
          cancelLabel="Fechar"
        />
      ) : (
        <ConfirmDialog
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title="Excluir fornecedor?"
          description={
            <>
              <strong className="text-ink-900">{supplier.name}</strong> será removido do cadastro. Essa ação não pode ser desfeita.
            </>
          }
          confirmLabel="Excluir"
          destructive
          onConfirm={() => {
            setConfirmingDelete(false);
            void handleDelete();
          }}
        />
      )}
    </div>
  );
}
