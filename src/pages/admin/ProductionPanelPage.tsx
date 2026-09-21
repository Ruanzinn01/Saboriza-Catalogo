import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { useCatalogStore } from "@/store/catalog-store";
import { useProductionStore } from "@/store/production-store";
import { useSettingsStore } from "@/store/settings-store";
import { AdminState } from "@/components/admin/AdminState";
import { WeeklyProductionChart } from "@/components/admin/WeeklyProductionChart";
import { Button } from "@/components/ui/Button";
import { buildWeeklyProduction } from "@/lib/weekly-production";
import { buildProductionReportRows, downloadProductionCsv, generateProductionPdf } from "@/lib/production-report";
import type { ProductionRecord } from "@/types/production";

type PeriodFilter = "hoje" | "semana" | "mes" | "ano" | "tudo" | "personalizado";

const periodLabels: Record<PeriodFilter, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
  tudo: "Tudo",
  personalizado: "Personalizado",
};

function isWithinPeriod(date: Date, period: PeriodFilter, customFrom: string, customTo: string) {
  const now = new Date();
  if (period === "tudo") return true;
  if (period === "hoje") return date.toDateString() === now.toDateString();
  if (period === "semana") {
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }
  if (period === "mes") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (period === "ano") return date.getFullYear() === now.getFullYear();
  if (period === "personalizado") {
    if (!customFrom && !customTo) return true;
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    const to = customTo ? new Date(`${customTo}T23:59:59`) : null;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }
  return true;
}

export function ProductionPanelPage() {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const records = useProductionStore((state) => state.records);
  const status = useProductionStore((state) => state.status);
  const fetchRecords = useProductionStore((state) => state.fetchRecords);
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);

  const [period, setPeriod] = useState<PeriodFilter>("semana");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    if (products.length === 0) fetchCatalog();
    if (!settings) fetchSettings();
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (!isWithinPeriod(new Date(record.confirmedAt), period, customFrom, customTo)) return false;
      const product = productById.get(record.productId);
      if (categoryFilter && product?.categoryId !== categoryFilter) return false;
      if (!query) return true;
      const matchesName = product?.name.toLowerCase().includes(query) ?? false;
      const matchesCode = product?.code.toLowerCase().includes(query) ?? false;
      return matchesName || matchesCode;
    });
  }, [records, period, customFrom, customTo, categoryFilter, search, productById]);

  const summary = useMemo(() => {
    const totalUnits = filtered.reduce((sum, record) => sum + record.unitsQuantity, 0);
    const distinctProducts = new Set(filtered.map((record) => record.productId)).size;
    let weightKg = 0;
    let missingWeightCount = 0;
    filtered.forEach((record) => {
      const product = productById.get(record.productId);
      if (product?.unitWeightGrams) {
        weightKg += (product.unitWeightGrams * record.unitsQuantity) / 1000;
      } else {
        missingWeightCount += 1;
      }
    });
    return { totalUnits, distinctProducts, totalRecords: filtered.length, weightKg, missingWeightCount };
  }, [filtered, productById]);

  const weeklyData = useMemo(() => buildWeeklyProduction(records), [records]);

  const dayRecords: ProductionRecord[] = useMemo(() => {
    if (!selectedDay) return [];
    return records.filter((record) => new Date(record.confirmedAt).toDateString() === selectedDay.toDateString());
  }, [records, selectedDay]);

  function handleSelectDay(date: Date) {
    setSelectedDay((prev) => (prev && prev.toDateString() === date.toDateString() ? null : date));
  }

  function activeFiltersLabel() {
    const parts: string[] = [];
    if (categoryFilter) parts.push(`categoria: ${categories.find((c) => c.id === categoryFilter)?.name ?? categoryFilter}`);
    if (search.trim()) parts.push(`busca: "${search.trim()}"`);
    return parts.length > 0 ? parts.join(" · ") : "nenhum";
  }

  function periodLabelText() {
    if (period === "personalizado") {
      if (!customFrom && !customTo) return "Personalizado (sem limite)";
      return `${customFrom || "-----"} até ${customTo || "-----"}`;
    }
    return periodLabels[period];
  }

  async function handleDownloadPdf() {
    if (!settings) {
      toast.error("Configure os dados da empresa antes de gerar o relatório");
      return;
    }
    const rows = buildProductionReportRows(filtered, productById);
    const doc = generateProductionPdf(rows, settings, periodLabelText(), activeFiltersLabel());
    doc.save(`producao-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function handlePrint() {
    if (!settings) {
      toast.error("Configure os dados da empresa antes de imprimir");
      return;
    }
    const rows = buildProductionReportRows(filtered, productById);
    const doc = generateProductionPdf(rows, settings, periodLabelText(), activeFiltersLabel());
    const url = doc.output("bloburl").toString();
    const printWindow = window.open(url, "_blank");
    printWindow?.addEventListener("load", () => printWindow.print());
  }

  function handleDownloadCsv() {
    const rows = buildProductionReportRows(filtered, productById);
    downloadProductionCsv(rows, `producao-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Produção</h1>
        <p className="text-sm text-ink-muted">Histórico do que foi produzido, sem valores financeiros.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(periodLabels) as PeriodFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              period === key ? "bg-forest-950 text-cream-50" : "bg-white text-ink-700/70 hover:bg-forest-950/5"
            }`}
          >
            {periodLabels[key]}
          </button>
        ))}
      </div>

      {period === "personalizado" && (
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-muted">De</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-10 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-muted">Até</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-10 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Total produzido</p>
          <p className="text-xl font-extrabold text-forest-950">{summary.totalUnits} un</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Peso produzido</p>
          <p className="text-xl font-extrabold text-forest-950">
            {summary.weightKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
          </p>
          {summary.missingWeightCount > 0 && (
            <p className="mt-1 text-[11px] text-ink-muted">{summary.missingWeightCount} registro(s) sem peso cadastrado</p>
          )}
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Produtos produzidos</p>
          <p className="text-xl font-extrabold text-forest-950">{summary.distinctProducts}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Registros</p>
          <p className="text-xl font-extrabold text-forest-950">{summary.totalRecords}</p>
        </div>
      </div>

      <WeeklyProductionChart data={weeklyData} selectedDate={selectedDay} onSelectDay={handleSelectDay} />

      {selectedDay && (
        <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-forest-950">
              Produção de {selectedDay.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
            </p>
            <button onClick={() => setSelectedDay(null)} className="text-xs font-semibold text-ink-muted hover:underline">
              Fechar
            </button>
          </div>
          {dayRecords.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma produção registrada nesse dia.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dayRecords.map((record) => {
                const product = productById.get(record.productId);
                return (
                  <div key={record.id} className="flex items-center gap-3 rounded-xl border border-forest-950/5 p-2">
                    {product?.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-forest-950/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{product?.name ?? "-----"}</p>
                      <p className="text-xs text-ink-muted">{product?.code ?? "-----"}</p>
                    </div>
                    <p className="text-sm font-bold text-forest-950">{record.unitsQuantity} un</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadPdf()}>
          <Download size={14} /> PDF
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void handlePrint()}>
          <Printer size={14} /> Imprimir
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadCsv}>
          <FileSpreadsheet size={14} /> Excel
        </Button>
      </div>

      {status === "loading" && records.length === 0 ? (
        <AdminState variant="loading" message="Carregando registros de produção..." />
      ) : filtered.length === 0 ? (
        <AdminState variant="empty" message="Nenhum registro de produção nesse período." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Packs</th>
                <th className="px-4 py-3">Unidades</th>
                <th className="px-4 py-3">Peso</th>
                <th className="px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => {
                const product = productById.get(record.productId);
                const weightKg = product?.unitWeightGrams ? (product.unitWeightGrams * record.unitsQuantity) / 1000 : null;
                return (
                  <tr key={record.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product?.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-forest-950/10" />
                        )}
                        <span className="font-semibold text-ink-900">{product?.name ?? "-----"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{product?.code ?? "-----"}</td>
                    <td className="px-4 py-3 text-ink-700/70">{record.packsQuantity}</td>
                    <td className="px-4 py-3 text-ink-700/70">{record.unitsQuantity}</td>
                    <td className="px-4 py-3 text-ink-700/70">
                      {weightKg !== null ? `${weightKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : "-----"}
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">{new Date(record.confirmedAt).toLocaleString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
