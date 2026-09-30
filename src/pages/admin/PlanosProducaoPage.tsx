import { useEffect, useMemo, useState } from "react";
import { useCatalogStore } from "@/store/catalog-store";
import { useFloorStore } from "@/store/floor-store";
import { useProductionRoutesStore } from "@/store/production-routes-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PlanosProducaoPage() {
  const products = useCatalogStore((s) => s.products);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const plans = useProductionRoutesStore((s) => s.plans);
  const fetchPlans = useProductionRoutesStore((s) => s.fetchPlans);
  const createPlan = useProductionRoutesStore((s) => s.createPlan);
  const createRelease = useFloorStore((s) => s.createRelease);
  const fetchFloorAll = useFloorStore((s) => s.fetchAll);

  const [productId, setProductId] = useState("");
  const [plannedDate, setPlannedDate] = useState(todayIso());
  const [plannedPacks, setPlannedPacks] = useState(1);
  const [saving, setSaving] = useState(false);
  const [liberatingId, setLiberatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
    fetchPlans();
  }, [fetchCatalog, fetchPlans]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const activeProducts = products.filter((p) => p.active);

  async function handleCreate() {
    if (!productId) return;
    setSaving(true);
    const ok = await createPlan(productId, plannedDate, plannedPacks);
    setSaving(false);
    if (ok) {
      setProductId("");
      setPlannedPacks(1);
    }
  }

  async function handleLiberar(planId: string, productIdForPlan: string, plannedPacksForPlan: number) {
    setLiberatingId(planId);
    const idempotencyKey = crypto.randomUUID();
    const ok = await createRelease(productIdForPlan, plannedPacksForPlan, "Plano de produção", "", null, idempotencyKey, planId);
    setLiberatingId(null);
    if (ok) {
      await fetchPlans();
      await fetchFloorAll();
    }
  }

  if (products.length === 0) return <AdminState variant="loading" message="Carregando..." />;

  const pending = plans.filter((p) => p.status === "PENDENTE");
  const resolved = plans.filter((p) => p.status !== "PENDENTE");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Planos de Produção</h1>
        <p className="text-sm text-ink-muted">Planeja quantidade por data. Liberar envia pro Chão de Fábrica — efeito de estoque = zero.</p>
      </div>

      <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Novo plano</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-bold">Produto</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold">Data</label>
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className="rounded-lg border border-forest-950/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold">Packs</label>
            <input
              type="number"
              min={1}
              value={plannedPacks}
              onChange={(e) => setPlannedPacks(Math.max(1, Number(e.target.value)))}
              className="w-24 rounded-lg border border-forest-950/15 px-3 py-2 text-sm"
            />
          </div>
          <Button onClick={handleCreate} disabled={saving || !productId}>
            {saving ? "Salvando..." : "Criar plano"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Pendentes ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum plano pendente.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between rounded-xl border border-forest-950/10 p-3">
                <div>
                  <p className="font-semibold">{productById.get(plan.productId)?.name}</p>
                  <p className="text-xs text-ink-muted">
                    {new Date(`${plan.plannedDate}T00:00:00`).toLocaleDateString("pt-BR")} · {plan.plannedPacks} pack(s)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={liberatingId === plan.id}
                  onClick={() => handleLiberar(plan.id, plan.productId, plan.plannedPacks)}
                >
                  {liberatingId === plan.id ? "Liberando..." : "Liberar"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Histórico</h2>
          <div className="flex flex-col gap-2">
            {resolved.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between border-b border-forest-950/10 py-2 text-sm">
                <span>
                  {productById.get(plan.productId)?.name} · {new Date(`${plan.plannedDate}T00:00:00`).toLocaleDateString("pt-BR")}
                </span>
                <span className={plan.status === "LIBERADO" ? "font-semibold text-emerald-700" : "text-ink-muted"}>{plan.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
