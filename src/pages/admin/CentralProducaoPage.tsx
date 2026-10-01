import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalogStore } from "@/store/catalog-store";
import { useFloorStore } from "@/store/floor-store";
import { useProductionStore } from "@/store/production-store";
import { useProductionV3Store } from "@/store/production-v3-store";
import { useProductionRoutesStore } from "@/store/production-routes-store";

function minutesSince(iso: string | null) {
  if (!iso) return 0;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

type Period = "Hoje" | "Semana" | "Mês" | "3 Meses" | "6 Meses" | "12 Meses";
const PERIOD_DAYS: Record<Period, number> = { Hoje: 1, Semana: 7, Mês: 30, "3 Meses": 90, "6 Meses": 180, "12 Meses": 365 };

function VisaoGeralTab() {
  const products = useCatalogStore((s) => s.products);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const records = useProductionStore((s) => s.records);
  const fetchRecords = useProductionStore((s) => s.fetchRecords);
  const urgentDemands = useProductionV3Store((s) => s.urgentDemands);
  const fetchUrgentDemands = useProductionV3Store((s) => s.fetchUrgentDemands);
  const plans = useProductionRoutesStore((s) => s.plans);
  const fetchPlans = useProductionRoutesStore((s) => s.fetchPlans);
  const [period, setPeriod] = useState<Period>("Semana");

  useEffect(() => {
    fetchCatalog();
    fetchRecords();
    fetchUrgentDemands();
    fetchPlans();
  }, [fetchCatalog, fetchRecords, fetchUrgentDemands, fetchPlans]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const { periodRecords, kpis, byProduct, planVsRealized, alerts } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    const periodRecords = records.filter((r) => r.status !== "reversed" && new Date(r.confirmedAt) >= cutoff);

    const totalUnits = periodRecords.reduce((s, r) => s + r.unitsQuantity, 0);
    const daysWithProduction = new Set(periodRecords.map((r) => new Date(r.confirmedAt).toDateString())).size;
    const distinctProducts = new Set(periodRecords.map((r) => r.productId)).size;
    const avgDaily = daysWithProduction > 0 ? totalUnits / daysWithProduction : 0;

    const byProductMap = new Map<string, number>();
    periodRecords.forEach((r) => byProductMap.set(r.productId, (byProductMap.get(r.productId) ?? 0) + r.unitsQuantity));
    const byProduct = [...byProductMap.entries()].map(([id, qty]) => ({ product: productById.get(id), qty })).sort((a, b) => b.qty - a.qty).slice(0, 8);

    const periodPlans = plans.filter((p) => new Date(p.plannedDate) >= cutoff);
    const planVsRealized = periodPlans.map((p) => {
      const realized = records
        .filter((r) => r.status !== "reversed" && r.productId === p.productId && new Date(r.confirmedAt).toDateString() === new Date(p.plannedDate).toDateString())
        .reduce((s, r) => s + r.unitsQuantity, 0);
      const product = productById.get(p.productId);
      const plannedUnits = p.plannedPacks * (product?.packQuantity ?? 1);
      return { plan: p, product, plannedUnits, realized, atingido: plannedUnits > 0 ? realized >= plannedUnits : false };
    });

    const activeUrgents = urgentDemands.filter((u) => u.status === "ATIVO");
    const zeroedProducts = products.filter((p) => p.active && p.currentStock <= 0);
    const belowMin = products.filter((p) => p.active && p.currentStock > 0 && p.currentStock < p.minStock);
    const plansNotMet = planVsRealized.filter((p) => !p.atingido && new Date(p.plan.plannedDate) < new Date());

    const alerts = [
      ...zeroedProducts.map((p) => ({ label: `${p.name} — estoque zerado`, severity: "bad" as const })),
      ...belowMin.map((p) => ({ label: `${p.name} — abaixo do mínimo`, severity: "warn" as const })),
      ...plansNotMet.map((p) => ({ label: `${p.product?.name ?? "Item"} — planejado não atingido em ${new Date(p.plan.plannedDate).toLocaleDateString("pt-BR")}`, severity: "warn" as const })),
    ];

    return {
      periodRecords,
      kpis: { totalUnits, avgDaily, daysWithProduction, distinctProducts, activeUrgentsCount: activeUrgents.length },
      byProduct,
      planVsRealized,
      alerts,
    };
  }, [records, products, plans, urgentDemands, period, productById]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${period === p ? "bg-forest-950 text-cream-50" : "bg-forest-950/5 text-ink-700/70 hover:bg-forest-950/10"}`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Produzido no período</p><p className="mt-1 text-2xl font-extrabold text-forest-950">{kpis.totalUnits.toLocaleString("pt-BR")}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Média diária</p><p className="mt-1 text-2xl font-extrabold text-forest-950">{Math.round(kpis.avgDaily).toLocaleString("pt-BR")}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Dias com produção</p><p className="mt-1 text-2xl font-extrabold text-forest-950">{kpis.daysWithProduction}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Produtos diferentes</p><p className="mt-1 text-2xl font-extrabold text-forest-950">{kpis.distinctProducts}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Urgentes ativos</p><p className="mt-1 text-2xl font-extrabold text-forest-950">{kpis.activeUrgentsCount}</p></div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Atenções</h2>
          <div className="flex flex-col gap-1">
            {alerts.map((a, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-sm font-semibold ${a.severity === "bad" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                {a.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Mais produzidos no período</h2>
          {byProduct.length === 0 ? (
            <p className="text-sm text-ink-muted">Sem produção no período.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {byProduct.map(({ product, qty }) => (
                <div key={product?.id ?? qty} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{product?.name ?? "-----"}</span>
                  <span className="font-semibold text-ink-900">{qty.toLocaleString("pt-BR")} un</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Planejado × Realizado</h2>
          {planVsRealized.length === 0 ? (
            <p className="text-sm text-ink-muted">Sem planos no período.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {planVsRealized.map(({ plan, product, plannedUnits, realized, atingido }) => (
                <div key={plan.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{product?.name ?? "-----"} · {new Date(plan.plannedDate).toLocaleDateString("pt-BR")}</span>
                  <span className={`font-semibold ${atingido ? "text-emerald-700" : "text-ink-900"}`}>{realized}/{plannedUnits} un</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TempoRealTab() {
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

export function CentralProducaoPage() {
  const [tab, setTab] = useState<"visao" | "tempo-real">("visao");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Central de Gestão da Produção</h1>
        <p className="text-sm text-ink-muted">
          Leitura das fontes oficiais de{" "}
          <Link to="/admin/produzir" className="underline">
            Produziu Registra
          </Link>{" "}
          e{" "}
          <Link to="/admin/chao-de-fabrica" className="underline">
            Chão de Fábrica
          </Link>
          . Aqui é só leitura — nada é editado a partir desta tela.
        </p>
      </div>

      <div className="flex gap-2 rounded-xl bg-forest-950/5 p-1 w-fit">
        {[
          ["visao", "Visão Geral"],
          ["tempo-real", "Tempo Real"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value as "visao" | "tempo-real")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "visao" ? <VisaoGeralTab /> : <TempoRealTab />}
    </div>
  );
}
