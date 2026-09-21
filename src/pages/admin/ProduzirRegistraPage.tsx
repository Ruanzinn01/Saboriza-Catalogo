import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";
import { useProductRecipeStore } from "@/store/product-recipe-store";
import { useProductionStore } from "@/store/production-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { Button } from "@/components/ui/Button";
import { AdminState } from "@/components/admin/AdminState";
import { BarcodeScannerModal } from "@/components/admin/BarcodeScannerModal";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductSearchBar } from "@/components/admin/ProductSearchBar";
import { ProductionList } from "@/components/admin/ProductionList";
import { ProductionNeedsPanel } from "@/components/admin/ProductionNeedsPanel";
import { ProductionResultSummary, type ProductionResult } from "@/components/admin/ProductionResultSummary";
import { ProductionReviewSheet } from "@/components/admin/ProductionReviewSheet";
import { StatCard } from "@/components/admin/StatCard";
import { WeeklyProductionChart } from "@/components/admin/WeeklyProductionChart";
import { productionGreeting } from "@/lib/greeting";
import { buildProductionAlerts, type ProductionLine } from "@/lib/production-alerts";
import { buildProductionSuggestions } from "@/lib/production-suggestions";
import { buildWeeklyProduction } from "@/lib/weekly-production";

const STORAGE_KEY = "saboriza:produzir:lista";

function loadStoredLines(): ProductionLine[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ProductionLine =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ProductionLine).productId === "string" &&
        Number.isInteger((item as ProductionLine).packs) &&
        (item as ProductionLine).packs > 0
    );
  } catch {
    return [];
  }
}

export function ProduzirRegistraPage() {
  const products = useCatalogStore((state) => state.products);
  const catalogStatus = useCatalogStore((state) => state.status);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const orders = useOrdersStore((state) => state.orders);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const materials = useRawMaterialsStore((state) => state.materials);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);
  const recipesByProduct = useProductRecipeStore((state) => state.linesByProduct);
  const fetchRecipesFor = useProductRecipeStore((state) => state.fetchRecipesFor);
  const records = useProductionStore((state) => state.records);
  const fetchRecords = useProductionStore((state) => state.fetchRecords);
  const registerProduction = useProductionStore((state) => state.registerProduction);
  const refreshAfterProduction = useProductionStore((state) => state.refreshAfterProduction);

  const [lines, setLines] = useState<ProductionLine[]>(loadStoredLines);
  const [failedById, setFailedById] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ProductionResult | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCatalog();
    fetchMaterials();
    fetchOrders();
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (lines.length === 0) sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // armazenamento indisponível: a lista só não sobrevive a recarga
    }
  }, [lines]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    if (catalogStatus !== "ready") return;
    setLines((prev) => {
      const kept = prev.filter((line) => productById.get(line.productId)?.active);
      return kept.length === prev.length ? prev : kept;
    });
  }, [catalogStatus, productById]);

  const missingRecipeKey = lines
    .map((line) => line.productId)
    .filter((id) => recipesByProduct[id] === undefined)
    .sort()
    .join(",");

  useEffect(() => {
    if (missingRecipeKey) void fetchRecipesFor(missingRecipeKey.split(","));
  }, [missingRecipeKey, fetchRecipesFor]);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ block: "start" });
  }, [result]);

  const validLines = useMemo(() => lines.filter((line) => productById.has(line.productId)), [lines, productById]);
  const alertsByProduct = useMemo(
    () => buildProductionAlerts(validLines, productById, recipesByProduct, materials),
    [validLines, productById, recipesByProduct, materials]
  );
  const suggestions = useMemo(() => buildProductionSuggestions(products, orders), [products, orders]);
  const queuedProductIds = useMemo(() => new Set(lines.map((line) => line.productId)), [lines]);
  const weeklyData = useMemo(() => buildWeeklyProduction(records), [records]);

  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todays = records.filter((record) => new Date(record.confirmedAt).toDateString() === today);
    return { units: todays.reduce((sum, record) => sum + record.unitsQuantity, 0), count: todays.length };
  }, [records]);

  const totalUnits = validLines.reduce((sum, line) => sum + line.packs * (productById.get(line.productId)?.packQuantity ?? 0), 0);
  const criticalCount = suggestions.filter((item) => item.tone === "out" || item.tone === "critical").length;

  function clearFailure(productId: string) {
    setFailedById((prev) => {
      if (!(productId in prev)) return prev;
      const { [productId]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function addOnePack(productId: string) {
    clearFailure(productId);
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === productId);
      if (existing) return prev.map((line) => (line.productId === productId ? { ...line, packs: line.packs + 1 } : line));
      return [...prev, { productId, packs: 1 }];
    });
  }

  function sendToList(productId: string, packs: number) {
    setLines((prev) => (prev.some((line) => line.productId === productId) ? prev : [...prev, { productId, packs }]));
  }

  function sendAllCritical() {
    setLines((prev) => {
      const queued = new Set(prev.map((line) => line.productId));
      const additions = suggestions
        .filter((item) => (item.tone === "out" || item.tone === "critical") && !queued.has(item.product.id))
        .map((item) => ({ productId: item.product.id, packs: item.suggestedPacks }));
      return [...prev, ...additions];
    });
  }

  function setPacks(productId: string, packs: number) {
    clearFailure(productId);
    const safe = Number.isFinite(packs) ? Math.max(1, Math.floor(packs)) : 1;
    setLines((prev) => prev.map((line) => (line.productId === productId ? { ...line, packs: safe } : line)));
  }

  function removeLine(productId: string) {
    clearFailure(productId);
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  }

  function clearList() {
    setLines([]);
    setFailedById({});
  }

  function handleScan(code: string) {
    const normalized = code.trim().toLowerCase();
    const product = products.find((item) => item.active && item.code.toLowerCase() === normalized);
    setScannerOpen(false);
    if (!product) {
      toast.error("Nenhum produto encontrado com esse código");
      return;
    }
    addOnePack(product.id);
    toast.success(`${product.name} adicionado à lista`);
  }

  async function handleConfirmAll() {
    if (validLines.length === 0 || saving) return;
    setSaving(true);
    const done: ProductionResult["done"] = [];
    const failed: ProductionResult["failed"] = [];

    for (const line of validLines) {
      const product = productById.get(line.productId);
      if (!product) continue;
      const { record, error } = await registerProduction(line.productId, line.packs);
      if (record) {
        done.push({ productId: product.id, name: product.name, packs: line.packs, units: record.unitsQuantity });
      } else {
        failed.push({ productId: product.id, name: product.name, error: error ?? "erro desconhecido" });
      }
    }

    if (done.length > 0) await refreshAfterProduction(done.map((item) => item.productId));

    const doneIds = new Set(done.map((item) => item.productId));
    setLines((prev) => prev.filter((line) => !doneIds.has(line.productId)));
    setFailedById(Object.fromEntries(failed.map((item) => [item.productId, item.error])));
    setResult({ done, failed });
    setReviewOpen(false);
    setSaving(false);
  }

  if (catalogStatus === "loading" && products.length === 0) {
    return <AdminState variant="loading" message="Carregando produtos..." />;
  }

  if (catalogStatus === "error" && products.length === 0) {
    return <AdminState variant="error" message="Não foi possível carregar os produtos." onRetry={fetchCatalog} />;
  }

  return (
    <div className={`flex flex-col gap-6 ${validLines.length > 0 ? "pb-28" : "pb-6"} lg:pb-6`}>
      <PageHeader
        title="Produziu, Registra"
        eyebrow="Chão de fábrica"
        description={productionGreeting()}
        actions={
          <>
            <Link to="/admin/pedidos">
              <Button variant="outline" size="sm">
                Pedidos
              </Button>
            </Link>
            <Link to="/admin/estoque">
              <Button variant="outline" size="sm">
                Estoque
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Produzido hoje" value={`${todayStats.units} un`} hint={`${todayStats.count} registro${todayStats.count === 1 ? "" : "s"}`} />
        <StatCard
          label="Precisa produzir"
          value={suggestions.length}
          tone={criticalCount > 0 ? "danger" : "default"}
          hint={criticalCount > 0 ? `${criticalCount} crítico${criticalCount > 1 ? "s" : ""} ou sem estoque` : "Nenhum crítico"}
        />
      </div>

      {result && (
        <div ref={resultRef} className="scroll-mt-4">
          <ProductionResultSummary result={result} onDismiss={() => setResult(null)} />
        </div>
      )}

      <ProductSearchBar products={products} onPick={addOnePack} onOpenScanner={() => setScannerOpen(true)} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="lg:col-start-1">
          <ProductionNeedsPanel
            products={products}
            suggestions={suggestions}
            queuedProductIds={queuedProductIds}
            onSend={sendToList}
            onSendAllCritical={sendAllCritical}
          />
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-4">
          <ProductionList
            lines={validLines}
            productById={productById}
            alertsByProduct={alertsByProduct}
            failedById={failedById}
            totalUnits={totalUnits}
            saving={saving}
            onSetPacks={setPacks}
            onRemove={removeLine}
            onClear={clearList}
            onSubmit={() => setReviewOpen(true)}
          />
        </div>

        <div className="lg:col-start-1">
          <WeeklyProductionChart data={weeklyData} />
        </div>
      </div>

      {validLines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-forest-950/10 bg-cream-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm font-semibold text-ink-700/70">
              {validLines.length} item{validLines.length > 1 ? "s" : ""} · <span className="text-lg font-extrabold text-forest-950">{totalUnits} un</span>
            </p>
            <Button size="lg" disabled={saving} onClick={() => setReviewOpen(true)}>
              <Send size={18} /> Enviar para produção
            </Button>
          </div>
        </div>
      )}

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />

      <ProductionReviewSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        lines={validLines}
        productById={productById}
        alertsByProduct={alertsByProduct}
        totalUnits={totalUnits}
        saving={saving}
        onConfirm={() => void handleConfirmAll()}
      />
    </div>
  );
}
