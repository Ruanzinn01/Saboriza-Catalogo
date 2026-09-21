import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useProductRecipeStore } from "@/store/product-recipe-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ProductRecipeEditorProps {
  productId: string;
}

export function ProductRecipeEditor({ productId }: ProductRecipeEditorProps) {
  const linesByProduct = useProductRecipeStore((state) => state.linesByProduct);
  const fetchRecipe = useProductRecipeStore((state) => state.fetchRecipe);
  const addLine = useProductRecipeStore((state) => state.addLine);
  const updateLine = useProductRecipeStore((state) => state.updateLine);
  const removeLine = useProductRecipeStore((state) => state.removeLine);
  const materials = useRawMaterialsStore((state) => state.materials);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);

  const [newMaterialId, setNewMaterialId] = useState("");
  const [newQuantity, setNewQuantity] = useState(0);

  useEffect(() => {
    fetchRecipe(productId);
    if (materials.length === 0) fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const lines = linesByProduct[productId] ?? [];
  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const availableMaterials = useMemo(
    () => materials.filter((material) => !lines.some((line) => line.rawMaterialId === material.id)),
    [materials, lines]
  );

  async function handleAdd() {
    if (!newMaterialId || newQuantity <= 0) return;
    const ok = await addLine(productId, newMaterialId, newQuantity);
    if (ok) {
      setNewMaterialId("");
      setNewQuantity(0);
    }
  }

  return (
    <div id="ficha-tecnica" className="flex scroll-mt-4 flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Ficha técnica</p>
      <p className="text-xs text-ink-muted">Quanto de cada insumo é consumido por 1 unidade deste produto.</p>

      {lines.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum componente definido ainda.</p>
      ) : (
        <div className="flex flex-col divide-y divide-forest-950/5">
          {lines.map((line) => {
            const material = materialById.get(line.rawMaterialId);
            return (
              <div key={line.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{material?.name ?? "-----"}</p>
                  <p className="font-mono text-xs text-ink-muted">{material?.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0.0001}
                    step="any"
                    value={line.quantityPerUnit}
                    onChange={(e) => void updateLine(line.id, productId, Number(e.target.value))}
                    className="h-9 w-24 rounded-lg border border-ink-900/15 bg-white px-2 text-right text-sm text-ink-900 outline-none focus:border-forest-700"
                  />
                  <span className="w-10 text-xs text-ink-muted">{material?.controlUnit}</span>
                  <button
                    type="button"
                    onClick={() => void removeLine(line.id, productId)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Insumo</span>
          <select
            value={newMaterialId}
            onChange={(e) => setNewMaterialId(e.target.value)}
            className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          >
            <option value="">Selecione...</option>
            {availableMaterials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} ({material.controlUnit})
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Qtd. por unidade"
          type="number"
          min={0.0001}
          step="any"
          value={newQuantity}
          onChange={(e) => setNewQuantity(Number(e.target.value))}
          className="w-32"
        />
        <Button type="button" variant="outline" onClick={() => void handleAdd()}>
          <Plus size={16} /> Adicionar
        </Button>
      </div>
    </div>
  );
}
