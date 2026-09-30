import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalogStore } from "@/store/catalog-store";
import { useFloorStore } from "@/store/floor-store";
import { useProductionStore } from "@/store/production-store";

function minutesSince(iso: string | null) {
  if (!iso) return 0;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

export function CentralProducaoPage() {
  const products = useCatalogStore((s) => s.products);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const executions = useFloorStore((s) => s.executions);
  const releases = useFloorStore((s) => s.releases);
  const fetchFloorAll = useFloorStore((s) => s.fetchAll);
  const subscribeRealtime = useFloorStore((s) => s.subscribeRealtime);
  const unsubscribeRealtime = useFloorStore((s) => s.unsubscribeRealtime);
  const records = useProductionStore((s) => s.records);
  const fetchRecords = useProductionStore((s) => s.fetchRecords);

  useEffect(() => {
    fetchCatalog();
    fetchFloorAll();
    fetchRecords();
    subscribeRealtime();
    return () => unsubscribeRealtime();
  }, [fetchCatalog, fetchFloorAll, fetchRecords, subscribeRealtime, unsubscribeRealtime]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const today = new Date().toDateString();
  const releasesToday = releases.filter((r) => new Date(r.createdAt).toDateString() === today);
  const inProgress = executions.filter((e) => e.status === "EM_ANDAMENTO" || e.status === "PAUSADO");
  const bottleneck = executions.filter((e) => e.status === "CONCLUIDO" && !e.productionRecordId);
  const confirmedToday = records.filter((r) => new Date(r.confirmedAt).toDateString() === today && r.status !== "reversed");

  const longRunning = inProgress
    .map((e) => ({ exec: e, minutes: minutesSince(e.startedAt) }))
    .filter((x) => x.minutes >= 60)
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Central de Gestão da Produção</h1>
        <p className="text-sm text-ink-muted">
          Consolidação em tempo real de{" "}
          <Link to="/admin/produzir" className="underline">
            liberações
          </Link>{" "}
          e{" "}
          <Link to="/admin/chao-de-fabrica" className="underline">
            Chão de Fábrica
          </Link>
          . Aqui é só leitura — nada é editado a partir desta tela.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Liberações hoje</p>
          <p className="mt-1 text-2xl font-extrabold text-forest-950">{releasesToday.length}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Em andamento</p>
          <p className="mt-1 text-2xl font-extrabold text-forest-950">{inProgress.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Aguardando confirmação</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{bottleneck.length}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Confirmado hoje</p>
          <p className="mt-1 text-2xl font-extrabold text-forest-950">{confirmedToday.length}</p>
        </div>
      </div>

      {longRunning.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-red-700">Gargalo — mais de 1h em andamento</h2>
          <div className="flex flex-col gap-1">
            {longRunning.map(({ exec, minutes }) => (
              <div key={exec.id} className="flex justify-between text-sm">
                <span>{productById.get(exec.productId)?.name}</span>
                <span className="font-semibold text-red-700">{minutes} min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Execuções em andamento</h2>
        {inProgress.length === 0 ? (
          <p className="text-sm text-ink-muted">Nada em andamento agora.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {inProgress.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-forest-950/10 py-2 text-sm">
                <span>
                  {productById.get(e.productId)?.name} · {e.routeVersionLabel}
                </span>
                <span className="text-ink-muted">
                  {e.operationalQuantity}/{e.targetQuantity} un
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Aguardando confirmação no Produziu Registra</h2>
        {bottleneck.length === 0 ? (
          <p className="text-sm text-ink-muted">Nada parado aqui.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bottleneck.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-forest-950/10 py-2 text-sm">
                <span>{productById.get(e.productId)?.name}</span>
                <span className="text-ink-muted">{e.operationalQuantity} un concluídas</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
