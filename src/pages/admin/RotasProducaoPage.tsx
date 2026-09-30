import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { useProductionRoutesStore } from "@/store/production-routes-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

export function RotasProducaoPage() {
  const products = useCatalogStore((s) => s.products);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const routes = useProductionRoutesStore((s) => s.routes);
  const stages = useProductionRoutesStore((s) => s.stages);
  const fetchRoutes = useProductionRoutesStore((s) => s.fetchRoutes);
  const publishRoute = useProductionRoutesStore((s) => s.publishRoute);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [draftStages, setDraftStages] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCatalog();
    fetchRoutes();
  }, [fetchCatalog, fetchRoutes]);

  const activeRouteByProduct = useMemo(() => {
    const map = new Map<string, (typeof routes)[number]>();
    routes.filter((r) => r.status === "ATIVA").forEach((r) => map.set(r.productId, r));
    return map;
  }, [routes]);

  const stagesByRoute = useMemo(() => {
    const map = new Map<string, typeof stages>();
    stages.forEach((s) => {
      const list = map.get(s.routeId) ?? [];
      list.push(s);
      map.set(s.routeId, list);
    });
    return map;
  }, [stages]);

  const activeProducts = products.filter((p) => p.active);
  const selectedRoute = selectedProductId ? activeRouteByProduct.get(selectedProductId) : null;
  const selectedStages = selectedRoute ? (stagesByRoute.get(selectedRoute.id) ?? []) : [];

  function openProduct(productId: string) {
    setSelectedProductId(productId);
    const route = activeRouteByProduct.get(productId);
    const current = route ? (stagesByRoute.get(route.id) ?? []) : [];
    setDraftStages(current.length > 0 ? current.map((s) => s.name) : [""]);
  }

  async function handlePublish() {
    if (!selectedProductId) return;
    setSaving(true);
    const ok = await publishRoute(selectedProductId, draftStages);
    setSaving(false);
    if (ok) openProduct(selectedProductId);
  }

  if (products.length === 0) return <AdminState variant="loading" message="Carregando produtos..." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Rotas de Produção</h1>
        <p className="text-sm text-ink-muted">
          Cada rota publicada trava a versão usada por execuções já iniciadas no{" "}
          <Link to="/admin/chao-de-fabrica" className="underline">
            Chão de Fábrica
          </Link>
          . Liberar Produção exige rota ativa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Produtos</h2>
          <div className="flex flex-col gap-1">
            {activeProducts.map((p) => {
              const route = activeRouteByProduct.get(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProduct(p.id)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${selectedProductId === p.id ? "bg-forest-950/5 font-semibold" : "hover:bg-forest-950/5"}`}
                >
                  <span>{p.name}</span>
                  {route ? (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">v{route.version}</span>
                  ) : (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">sem rota</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          {!selectedProductId ? (
            <p className="text-sm text-ink-muted">Selecione um produto pra ver ou publicar a rota.</p>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-bold text-forest-950">{products.find((p) => p.id === selectedProductId)?.name}</h2>
              <p className="mb-4 text-sm text-ink-muted">
                {selectedRoute ? `Rota ativa: v${selectedRoute.version}` : "Nenhuma rota ativa ainda"} · {selectedStages.length} etapa(s)
              </p>
              <div className="flex flex-col gap-2">
                {draftStages.map((stage, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <GripVertical size={16} className="text-ink-muted" />
                    <input
                      value={stage}
                      onChange={(e) =>
                        setDraftStages((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))
                      }
                      placeholder={`Etapa ${i + 1}`}
                      className="flex-1 rounded-lg border border-forest-950/15 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setDraftStages((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={draftStages.length <= 1}
                      className="text-forest-950/40 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDraftStages((prev) => [...prev, ""])}
                  className="flex items-center gap-1 self-start rounded-lg px-2 py-1 text-sm font-semibold text-forest-700 hover:bg-forest-950/5"
                >
                  <Plus size={14} /> Adicionar etapa
                </button>
              </div>
              <Button onClick={handlePublish} disabled={saving} className="mt-4">
                {saving ? "Publicando..." : selectedRoute ? `Publicar nova versão (v${selectedRoute.version + 1})` : "Publicar rota (v1)"}
              </Button>
              {selectedRoute && (
                <p className="mt-2 text-xs text-ink-muted">
                  Publicar arquiva a v{selectedRoute.version}. Execuções já em andamento no Chão continuam vinculadas à versão antiga.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
