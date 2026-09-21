import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useRawMaterialEntriesStore } from "@/store/raw-material-entries-store";
import { useSuppliersStore } from "@/store/suppliers-store";
import { AdminState } from "@/components/admin/AdminState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/currency";
import { COST_BASIS_LABELS, rawMaterialStockStatus } from "@/types/raw-material";

const statusLabel: Record<ReturnType<typeof rawMaterialStockStatus>, string> = {
  ok: "Estoque OK",
  low: "Estoque baixo",
  out: "Sem estoque",
};

const entryStatusLabel: Record<string, string> = {
  draft: "Rascunho",
  confirmed: "Confirmada",
  reversed: "Estornada",
};

const entryStatusClasses: Record<string, string> = {
  draft: "bg-ink-900/10 text-ink-700",
  confirmed: "bg-forest-700/10 text-forest-800",
  reversed: "bg-red-500/10 text-red-700",
};

export function RawMaterialDetailPage() {
  const { rawMaterialId } = useParams();
  const materials = useRawMaterialsStore((state) => state.materials);
  const materialsStatus = useRawMaterialsStore((state) => state.status);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const entriesByMaterial = useRawMaterialEntriesStore((state) => state.entriesByMaterial);
  const fetchEntries = useRawMaterialEntriesStore((state) => state.fetchEntries);
  const confirmEntry = useRawMaterialEntriesStore((state) => state.confirmEntry);
  const reverseEntry = useRawMaterialEntriesStore((state) => state.reverseEntry);

  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchMaterials();
    if (suppliers.length === 0) fetchSuppliers();
    if (rawMaterialId) fetchEntries(rawMaterialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMaterialId]);

  const material = materials.find((item) => item.id === rawMaterialId);
  const entries = useMemo(() => entriesByMaterial[rawMaterialId ?? ""] ?? [], [entriesByMaterial, rawMaterialId]);

  const supplierName = useMemo(() => {
    const map = new Map(suppliers.map((supplier) => [supplier.id, supplier.tradeName || supplier.companyName]));
    return (id: string) => map.get(id) ?? "-----";
  }, [suppliers]);

  if (materialsStatus === "loading" && !material) {
    return <AdminState variant="loading" message="Carregando insumo..." />;
  }

  if (!material) {
    return <AdminState variant="empty" message="Insumo não encontrado." />;
  }

  const materialStatus = rawMaterialStockStatus(material);

  async function handleConfirm(entryId: string) {
    if (!rawMaterialId) return;
    await confirmEntry(entryId, rawMaterialId);
  }

  async function handleReverse() {
    if (!rawMaterialId || !reversing || !reason.trim()) return;
    const ok = await reverseEntry(reversing, rawMaterialId, reason.trim());
    if (ok) {
      setReversing(null);
      setReason("");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/materias-primas" className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para Matérias-primas
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">{material.name}</h1>
          <p className="font-mono text-xs text-ink-muted">{material.code}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/materias-primas/entrada?insumo=${material.id}`}>
            <Button variant="secondary">
              <Plus size={16} /> Nova entrada
            </Button>
          </Link>
          <Link to={`/admin/materias-primas/${material.id}/editar`}>
            <Button variant="outline">
              <Pencil size={16} /> Editar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Resumo</p>
          <p className="text-sm text-ink-700/70">Categoria: <span className="font-semibold text-ink-900">{material.category || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">Unidade: <span className="font-semibold text-ink-900">{material.controlUnit}</span></p>
          <p className="text-sm text-ink-700/70">
            Saldo: <span className="font-semibold text-ink-900">{material.currentStock} {material.controlUnit}</span>
          </p>
          <p className="text-sm text-ink-700/70">Mínimo: <span className="font-semibold text-ink-900">{material.minStock} {material.controlUnit}</span></p>
          <p className="text-sm text-ink-700/70">Custo médio: <span className="font-semibold text-ink-900">{formatCurrency(material.avgCost)}</span></p>
          <p className="text-sm text-ink-700/70">
            Fornecedor: <span className="font-semibold text-ink-900">{material.primarySupplierId ? supplierName(material.primarySupplierId) : "-----"}</span>
          </p>
          <span
            className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
              materialStatus === "ok" ? "bg-forest-700/10 text-forest-800" : materialStatus === "low" ? "bg-amber-500/10 text-amber-700" : "bg-red-500/10 text-red-700"
            }`}
          >
            {statusLabel[materialStatus]}
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Reposição / Compras</p>
          <p className="text-sm text-ink-700/70">
            Qtd. mínima de compra: <span className="font-semibold text-ink-900">{material.minPurchaseQty > 0 ? `${material.minPurchaseQty} ${material.controlUnit}` : "-----"}</span>
          </p>
          <p className="text-sm text-ink-700/70">
            Reposição padrão: <span className="font-semibold text-ink-900">{material.defaultReorderQty > 0 ? `${material.defaultReorderQty} ${material.controlUnit}` : "-----"}</span>
          </p>
          <p className="text-sm text-ink-700/70">
            Múltiplo de compra: <span className="font-semibold text-ink-900">{material.purchaseMultiple > 0 ? `${material.purchaseMultiple} ${material.controlUnit}` : "-----"}</span>
          </p>
          <p className="text-sm text-ink-700/70">
            Prazo médio: <span className="font-semibold text-ink-900">{material.leadTimeDays > 0 ? `${material.leadTimeDays} dias` : "-----"}</span>
          </p>
          <p className="text-sm text-ink-700/70">
            Base de custo: <span className="font-semibold text-ink-900">{COST_BASIS_LABELS[material.costBasis]}</span>
            {material.costBasis === "manual" && <span className="font-semibold text-ink-900"> ({formatCurrency(material.manualCost)})</span>}
          </p>
        </div>
        </div>

        <div className="rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Histórico de entradas</p>
          {entries.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma entrada registrada ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-forest-950/5">
              {entries.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entryStatusClasses[entry.status]}`}>
                        {entryStatusLabel[entry.status]}
                      </span>
                      <span className="text-sm font-semibold text-ink-900">
                        {entry.packagesQuantity} {material.purchaseUnitLabel || "un"} · Lote {entry.batch}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {supplierName(entry.supplierId)} · Venc. {new Date(entry.expiryDate).toLocaleDateString("pt-BR")} ·{" "}
                      {new Date(entry.entryDate).toLocaleDateString("pt-BR")}
                    </p>
                    {entry.status === "confirmed" && entry.previousBalance !== null && entry.newBalance !== null && (
                      <p className="text-xs text-ink-muted">
                        Saldo {entry.previousBalance} → {entry.newBalance} {material.controlUnit}
                      </p>
                    )}
                    {entry.status === "reversed" && (
                      <p className="text-xs text-red-600">Motivo do estorno: {entry.reversalReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink-900">{formatCurrency(entry.unitPrice * entry.packagesQuantity)}</span>
                    {entry.status === "draft" && (
                      <Button size="sm" onClick={() => void handleConfirm(entry.id)}>
                        Confirmar
                      </Button>
                    )}
                    {entry.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => setReversing(entry.id)}>
                        Estornar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={reversing !== null}
        onClose={() => {
          setReversing(null);
          setReason("");
        }}
        title="Estornar entrada"
        description={
          <div className="flex flex-col gap-2">
            <p>Essa entrada não será apagada, apenas estornada. O saldo e o custo médio voltam ao estado anterior.</p>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo do estorno (obrigatório)"
              className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </div>
        }
        confirmLabel="Estornar"
        destructive
        onConfirm={reason.trim() ? () => void handleReverse() : undefined}
      />
    </div>
  );
}
