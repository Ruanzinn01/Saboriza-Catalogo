import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, ChevronDown, Download, FileSpreadsheet, Printer, Search } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useStockInsightsStore } from "@/store/stock-insights-store";
import { useSettingsStore } from "@/store/settings-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { AdminState } from "@/components/admin/AdminState";
import { StatCard } from "@/components/admin/StatCard";
import { StockHealthDonut } from "@/components/admin/StockHealthDonut";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCompactCurrency, formatCurrency } from "@/lib/currency";
import {
  buildDivergenceReport,
  buildExpiryRisk,
  buildMonthlyValueEvolution,
  buildNextExpiryByMaterial,
  buildStockItems,
  buildTurnoverReport,
  buildValueComposition,
  healthLevel,
  situationLabel,
  situationTone,
  stockValue,
  type HealthLevel,
} from "@/lib/stock-insights";
import { buildStockReportRows, downloadStockCsv, generateStockPdf } from "@/lib/stock-report";
import { toast } from "sonner";

const HEALTH_LEVELS: HealthLevel[] = ["green", "yellow", "red"];
const MOVEMENT_FILTER_VALUES: MovementFilterValue[] = ["30", "60", "90", "older", "never"];

const SECTION_LINKS = [
  { id: "saude", label: "Saúde" },
  { id: "valor", label: "Valor" },
  { id: "evolucao", label: "Evolução" },
  { id: "giro", label: "Giro" },
  { id: "validade", label: "Validade" },
  { id: "inventario", label: "Inventário" },
  { id: "tabela", label: "Tabela" },
];

const chipClasses = (active: boolean) =>
  `min-h-11 rounded-full px-3 text-xs font-semibold transition-colors sm:min-h-9 ${
    active ? "bg-forest-950 text-cream-50" : "bg-white text-ink-700/70 hover:bg-forest-950/5"
  }`;

type TurnoverPeriod = "30" | "60" | "90";
type MonthsBackOption = 3 | 6 | 12 | 24 | "all" | "custom";
const MONTHS_BACK_OPTIONS: { value: MonthsBackOption; label: string }[] = [
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
  { value: 24, label: "24 meses" },
  { value: "all", label: "Histórico completo" },
  { value: "custom", label: "Personalizado" },
];

type MovementFilterValue = "30" | "60" | "90" | "older" | "never";
type MovementFilter = "" | MovementFilterValue;
const MOVEMENT_FILTER_LABELS: Record<MovementFilterValue, string> = {
  "30": "movimentados nos últimos 30 dias",
  "60": "movimentados nos últimos 60 dias",
  "90": "movimentados nos últimos 90 dias",
  older: "sem movimento há mais de 90 dias",
  never: "nunca movimentados",
};

function formatDateTime(value: string | null) {
  if (!value) return "Sem movimentação";
  return new Date(value).toLocaleDateString("pt-BR");
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function matchesMovementFilter(filter: MovementFilter, daysSinceLastMovement: number | null | undefined) {
  if (!filter) return true;
  if (filter === "never") return daysSinceLastMovement === null || daysSinceLastMovement === undefined;
  if (daysSinceLastMovement === null || daysSinceLastMovement === undefined) return false;
  if (filter === "older") return daysSinceLastMovement > 90;
  return daysSinceLastMovement <= Number(filter);
}

function monthsSince(reference: Date, earliest: Date): number {
  const months = (reference.getFullYear() - earliest.getFullYear()) * 12 + (reference.getMonth() - earliest.getMonth());
  return Math.max(months + 1, 1);
}

export function StockInsightsPanel() {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const catalogStatus = useCatalogStore((state) => state.status);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const materials = useRawMaterialsStore((state) => state.materials);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);
  const { movements, entries, consumptions, status, fetchInsights } = useStockInsightsStore();
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);
  const userId = useAdminAuthStore((state) => state.session?.user.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("busca") ?? "";
  const groupFilter = searchParams.get("grupo") ?? "";
  const categoryFilter = searchParams.get("categoria") ?? "";
  const expiryRiskOnly = searchParams.get("risco") === "1";
  const healthParam = searchParams.get("saude");
  const selectedHealth = HEALTH_LEVELS.find((level) => level === healthParam) ?? null;
  const movementParam = searchParams.get("mov");
  const movementFilter: MovementFilter = MOVEMENT_FILTER_VALUES.find((value) => value === movementParam) ?? "";

  function updateParam(key: string, value: string | null) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }

  function clearTableFilters() {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        ["saude", "grupo", "categoria", "mov", "risco"].forEach((key) => next.delete(key));
        return next;
      },
      { replace: true }
    );
  }

  const [customStart, setCustomStart] = useState(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customEnd, setCustomEnd] = useState(currentMonthValue);
  const [turnoverPeriod, setTurnoverPeriod] = useState<TurnoverPeriod>("30");
  const [expandedTurnoverId, setExpandedTurnoverId] = useState<string | null>(null);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30);
  const [monthsBack, setMonthsBack] = useState<MonthsBackOption>(6);
  const [evolutionGroupFilter, setEvolutionGroupFilter] = useState("");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  function loadAll() {
    fetchCatalog();
    fetchMaterials();
    fetchInsights();
  }

  useEffect(() => {
    if (!settings) fetchSettings();
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => buildStockItems(products, materials, categories), [products, materials, categories]);
  const groups = useMemo(() => [...new Set(items.map((item) => item.groupLabel))].sort(), [items]);
  const categoryLabels = useMemo(() => [...new Set(items.map((item) => item.categoryLabel))].sort(), [items]);

  const healthCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    items.forEach((item) => counts[healthLevel(item)]++);
    return counts;
  }, [items]);

  const valueComposition = useMemo(() => buildValueComposition(items), [items]);

  const earliestMovementDate = useMemo(() => {
    const dates = [...movements.map((m) => m.createdAt), ...entries.map((e) => e.entryDate)];
    if (dates.length === 0) return null;
    return dates.reduce((min, date) => (new Date(date) < new Date(min) ? date : min));
  }, [movements, entries]);

  const customRangeValid = customStart !== "" && customEnd !== "" && customStart <= customEnd;

  const evolutionRange = useMemo(() => {
    if (monthsBack === "custom") {
      if (!customRangeValid) return { months: 6, reference: new Date() };
      const start = parseMonthValue(customStart);
      const end = parseMonthValue(customEnd);
      return { months: monthsSince(end, start), reference: end };
    }
    if (monthsBack === "all") {
      return { months: earliestMovementDate ? monthsSince(new Date(), new Date(earliestMovementDate)) : 6, reference: new Date() };
    }
    return { months: monthsBack, reference: new Date() };
  }, [monthsBack, customRangeValid, customStart, customEnd, earliestMovementDate]);

  const evolutionItems = useMemo(
    () => (evolutionGroupFilter ? items.filter((item) => item.groupLabel === evolutionGroupFilter) : items),
    [items, evolutionGroupFilter]
  );

  const monthlyEvolution = useMemo(
    () => buildMonthlyValueEvolution(evolutionItems, movements, entries, consumptions, evolutionRange.months, evolutionRange.reference),
    [evolutionItems, movements, entries, consumptions, evolutionRange]
  );
  const maxMonthly = Math.max(...monthlyEvolution.map((point) => point.totalValue), 1);
  const selectedMonth = selectedMonthIndex !== null ? monthlyEvolution[selectedMonthIndex] ?? null : null;

  const expiryRisk = useMemo(() => buildExpiryRisk(entries, materials, expiryWarningDays), [entries, materials, expiryWarningDays]);
  const nextExpiryByMaterial = useMemo(() => buildNextExpiryByMaterial(expiryRisk), [expiryRisk]);
  const riskMaterialIds = useMemo(
    () => new Set(expiryRisk.filter((row) => row.riskLevel !== "ok").map((row) => row.materialId)),
    [expiryRisk]
  );

  const turnoverPeriodDays = Number(turnoverPeriod);
  const turnover = useMemo(() => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - turnoverPeriodDays * 24 * 60 * 60 * 1000);
    return buildTurnoverReport(items, movements, entries, consumptions, periodStart, now);
  }, [items, movements, entries, consumptions, turnoverPeriodDays]);

  const stalled = useMemo(
    () =>
      turnover
        .filter((row) => row.daysSinceLastMovement === null || row.daysSinceLastMovement >= turnoverPeriodDays)
        .sort((a, b) => (b.daysSinceLastMovement ?? 9999) - (a.daysSinceLastMovement ?? 9999)),
    [turnover, turnoverPeriodDays]
  );
  const topTurnover = useMemo(
    () => [...turnover].sort((a, b) => b.entriesInPeriod + b.exitsInPeriod - (a.entriesInPeriod + a.exitsInPeriod)).slice(0, 5),
    [turnover]
  );

  const divergences = useMemo(() => buildDivergenceReport(movements), [movements]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const lastMovementByItem = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of turnover) map.set(row.item.id, row.lastMovementAt);
    return map;
  }, [turnover]);

  const daysSinceByItem = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const row of turnover) map.set(row.item.id, row.daysSinceLastMovement);
    return map;
  }, [turnover]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedHealth && healthLevel(item) !== selectedHealth) return false;
      if (groupFilter && item.groupLabel !== groupFilter) return false;
      if (categoryFilter && item.categoryLabel !== categoryFilter) return false;
      if (expiryRiskOnly && !riskMaterialIds.has(item.id)) return false;
      if (!matchesMovementFilter(movementFilter, daysSinceByItem.get(item.id))) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query);
    });
  }, [items, selectedHealth, groupFilter, categoryFilter, expiryRiskOnly, movementFilter, daysSinceByItem, riskMaterialIds, search]);

  const filteredTotalValue = useMemo(() => filteredItems.reduce((sum, item) => sum + stockValue(item), 0), [filteredItems]);

  const filtersLabel = useMemo(() => {
    const parts: string[] = [];
    if (search.trim()) parts.push(`busca "${search.trim()}"`);
    if (selectedHealth) parts.push(`saúde ${selectedHealth === "green" ? "verde" : selectedHealth === "yellow" ? "amarela" : "vermelha"}`);
    if (groupFilter) parts.push(`grupo ${groupFilter}`);
    if (categoryFilter) parts.push(`categoria ${categoryFilter}`);
    if (expiryRiskOnly) parts.push(`com risco de validade (alerta ${expiryWarningDays} dias)`);
    if (movementFilter) parts.push(MOVEMENT_FILTER_LABELS[movementFilter]);
    return parts.length > 0 ? parts.join("; ") : "nenhum (todos os itens ativos)";
  }, [search, selectedHealth, groupFilter, categoryFilter, expiryRiskOnly, expiryWarningDays, movementFilter]);

  const hasActiveFilters = Boolean(selectedHealth || groupFilter || categoryFilter || expiryRiskOnly || movementFilter);

  async function handlePdf() {
    if (!settings) {
      toast.error("Configure os dados da empresa antes de gerar o relatório");
      return;
    }
    const rows = buildStockReportRows(filteredItems, nextExpiryByMaterial, lastMovementByItem);
    const doc = generateStockPdf(rows, settings, filtersLabel);
    doc.save(`estoque-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function handlePrint() {
    if (!settings) {
      toast.error("Configure os dados da empresa antes de imprimir");
      return;
    }
    const rows = buildStockReportRows(filteredItems, nextExpiryByMaterial, lastMovementByItem);
    const doc = generateStockPdf(rows, settings, filtersLabel);
    const url = doc.output("bloburl").toString();
    const printWindow = window.open(url, "_blank");
    printWindow?.addEventListener("load", () => printWindow.print());
  }

  function handleCsv() {
    const rows = buildStockReportRows(filteredItems, nextExpiryByMaterial, lastMovementByItem);
    downloadStockCsv(rows, `estoque-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const outOfStockCount = items.filter((item) => item.currentStock <= 0).length;
  const expiryAtRisk = expiryRisk.filter((row) => row.riskLevel !== "ok");
  const expiryAtRiskValue = expiryAtRisk.reduce((sum, row) => sum + row.value, 0);

  if (status === "error" || catalogStatus === "error") {
    return <AdminState variant="error" message="Não foi possível carregar os indicadores de estoque." onRetry={loadAll} />;
  }

  if ((catalogStatus === "loading" && products.length === 0) || (status === "loading" && movements.length === 0 && entries.length === 0)) {
    return <AdminState variant="loading" message="Carregando indicadores de estoque..." />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Valor em estoque" value={formatCurrency(valueComposition.total)} hint={`${items.length} itens ativos`} />
        <StatCard
          label="Itens críticos"
          value={healthCounts.red}
          tone={healthCounts.red > 0 ? "danger" : "default"}
          hint="No mínimo ou abaixo dele"
        />
        <StatCard
          label="Sem estoque"
          value={outOfStockCount}
          tone={outOfStockCount > 0 ? "danger" : "default"}
          hint="Saldo zerado"
        />
        <StatCard
          label="Validade em risco"
          value={expiryAtRisk.length}
          tone={expiryAtRisk.length > 0 ? "warning" : "default"}
          hint={`${formatCurrency(expiryAtRiskValue)} em lotes vencidos ou a vencer`}
        />
      </div>

      <nav
        aria-label="Seções dos indicadores"
        className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-cream-100/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {SECTION_LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(link.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white px-4 text-xs font-semibold text-ink-700 hover:bg-forest-950/5 sm:min-h-9"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <section id="saude" className="flex scroll-mt-16 flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Saúde do estoque</p>
        <StockHealthDonut
          green={healthCounts.green}
          yellow={healthCounts.yellow}
          red={healthCounts.red}
          outOfStock={outOfStockCount}
          selected={selectedHealth}
          onSelect={(level) => updateParam("saude", selectedHealth === level ? null : level)}
        />
        {selectedHealth && (
          <p className="text-xs text-ink-muted">
            Tabela filtrada pela cor selecionada.{" "}
            <a
              href="#tabela"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById("tabela")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="font-semibold text-forest-700 underline"
            >
              Ver lista
            </a>
          </p>
        )}
      </section>

      <section id="valor" className="flex scroll-mt-16 flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Valor do estoque</p>
        <p className="text-[11px] text-ink-muted">Produtos acabados a preço de venda — custo de produção chega na Fase 5.</p>
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Grupo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">% do total</th>
              </tr>
            </thead>
            <tbody>
              {valueComposition.rows.map((row) => (
                <tr key={row.groupLabel} className="border-b border-forest-950/5 last:border-none">
                  <td className="px-4 py-3 font-semibold text-ink-900">{row.groupLabel}</td>
                  <td className="px-4 py-3 text-ink-700/70">{formatCurrency(row.value)}</td>
                  <td className="px-4 py-3 text-ink-700/70">
                    {valueComposition.total > 0 ? `${((row.value / valueComposition.total) * 100).toFixed(1)}%` : "0%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="evolucao" className="flex scroll-mt-16 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Evolução do valor</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={evolutionGroupFilter}
              onChange={(e) => setEvolutionGroupFilter(e.target.value)}
              className="h-11 rounded-full border border-ink-900/15 bg-white px-3 text-xs sm:h-9 font-semibold text-ink-700/70 outline-none focus:border-forest-700"
            >
              <option value="">Todos os grupos</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            {MONTHS_BACK_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setMonthsBack(option.value);
                  setSelectedMonthIndex(null);
                }}
                aria-pressed={monthsBack === option.value}
                className={chipClasses(monthsBack === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {monthsBack === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            De
            <input
              type="month"
              value={customStart}
              max={customEnd || currentMonthValue()}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setSelectedMonthIndex(null);
              }}
              className="h-11 rounded-lg border border-ink-900/15 bg-white px-2 text-xs sm:h-9 outline-none focus:border-forest-700"
            />
            até
            <input
              type="month"
              value={customEnd}
              min={customStart || undefined}
              max={currentMonthValue()}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setSelectedMonthIndex(null);
              }}
              className="h-11 rounded-lg border border-ink-900/15 bg-white px-2 text-xs sm:h-9 outline-none focus:border-forest-700"
            />
            {!customRangeValid && <span className="font-semibold text-red-600">Informe um intervalo válido (início até o fim).</span>}
          </div>
        )}
        <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
          <div className="flex h-44 items-end gap-1 sm:gap-2">
            {monthlyEvolution.map((point, index) => {
              const heightPct = maxMonthly > 0 ? Math.max((point.totalValue / maxMonthly) * 100, point.totalValue > 0 ? 4 : 0) : 0;
              const isCurrent = index === monthlyEvolution.length - 1;
              const isSelected = selectedMonthIndex === index;
              return (
                <button
                  key={point.label + index}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${point.label}: ${formatCurrency(point.totalValue)}`}
                  onClick={() => setSelectedMonthIndex((prev) => (prev === index ? null : index))}
                  className="group relative flex min-h-11 min-w-0 flex-1 flex-col items-center gap-1"
                >
                  {monthlyEvolution.length <= 12 && (
                    <span className="max-w-full truncate text-[10px] font-semibold text-ink-700">{formatCompactCurrency(point.totalValue)}</span>
                  )}
                  <div className="flex h-28 w-full items-end justify-center">
                    <div
                      className={`w-6 max-w-[24px] rounded-t-[4px] transition-colors ${
                        isSelected ? "bg-forest-700" : isCurrent ? "bg-gold-600" : "bg-gold-500/70"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold uppercase text-ink-muted">{point.label}</span>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg bg-forest-950 px-2.5 py-1.5 text-xs text-cream-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {formatCurrency(point.totalValue)}
                    {point.quantityUnit && ` · ${point.totalQuantity} ${point.quantityUnit}`}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedMonth && (
            <div className="mt-4 rounded-2xl border border-forest-950/10 bg-cream-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                Detalhamento de {selectedMonth.label}
              </p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(selectedMonth.byGroup)
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-ink-900">{label}</span>
                      <span className="font-semibold text-ink-700/70">{formatCurrency(value)}</span>
                    </div>
                  ))}
                <div className="mt-1 flex items-center justify-between border-t border-forest-950/10 pt-2 text-sm">
                  <span className="font-bold text-ink-900">Total</span>
                  <span className="font-bold text-forest-950">
                    {formatCurrency(selectedMonth.totalValue)}
                    {selectedMonth.quantityUnit && ` · ${selectedMonth.totalQuantity} ${selectedMonth.quantityUnit}`}
                  </span>
                </div>
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] text-ink-muted">
            Reconstruído a partir do histórico de movimentações com o custo/preço atual — não reflete o custo vigente em cada mês.
          </p>
        </div>
      </section>

      <section id="giro" className="flex scroll-mt-16 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Giro e movimentação</p>
          <div className="flex gap-2">
            {(["30", "60", "90"] as TurnoverPeriod[]).map((key) => (
              <button
                key={key}
                onClick={() => setTurnoverPeriod(key)}
                aria-pressed={turnoverPeriod === key}
                className={chipClasses(turnoverPeriod === key)}
              >
                {key} dias
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
            <p className="mb-3 text-sm font-bold text-forest-950">Maior giro no período</p>
            {topTurnover.length === 0 ? (
              <p className="text-sm text-ink-muted">Sem movimentação no período.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {topTurnover.map((row) => (
                  <div key={row.item.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedTurnoverId((prev) => (prev === row.item.id ? null : row.item.id))}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm hover:bg-forest-950/5"
                    >
                      <span className="flex items-center gap-1 truncate text-ink-900">
                        <ChevronDown
                          size={14}
                          className={`shrink-0 transition-transform ${expandedTurnoverId === row.item.id ? "rotate-180" : ""}`}
                        />
                        <span className="truncate">{row.item.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-forest-800">
                        +{row.entriesInPeriod} / -{row.exitsInPeriod} {row.item.controlUnit}
                      </span>
                    </button>
                    {expandedTurnoverId === row.item.id && (
                      <div className="ml-5 mb-1 rounded-lg bg-forest-950/5 px-3 py-2 text-xs text-ink-700/70">
                        Saldo atual: <strong className="text-ink-900">{row.item.currentStock} {row.item.controlUnit}</strong>
                        {" · "}Última movimentação: <strong className="text-ink-900">{formatDateTime(row.lastMovementAt)}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-forest-950">
              <AlertTriangle size={14} className="text-amber-600" /> Parados há {turnoverPeriodDays}+ dias
            </p>
            {stalled.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum item parado.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {stalled.slice(0, 8).map((row) => (
                  <div key={row.item.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedTurnoverId((prev) => (prev === row.item.id ? null : row.item.id))}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm hover:bg-forest-950/5"
                    >
                      <span className="flex items-center gap-1 truncate text-ink-900">
                        <ChevronDown
                          size={14}
                          className={`shrink-0 transition-transform ${expandedTurnoverId === row.item.id ? "rotate-180" : ""}`}
                        />
                        <span className="truncate">{row.item.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-amber-700">
                        {row.daysSinceLastMovement === null ? "sem movimento" : `${row.daysSinceLastMovement} dias`}
                      </span>
                    </button>
                    {expandedTurnoverId === row.item.id && (
                      <div className="ml-5 mb-1 rounded-lg bg-forest-950/5 px-3 py-2 text-xs text-ink-700/70">
                        Saldo atual: <strong className="text-ink-900">{row.item.currentStock} {row.item.controlUnit}</strong>
                        {" · "}Entradas no período: <strong className="text-ink-900">{row.entriesInPeriod}</strong>
                        {" · "}Saídas no período: <strong className="text-ink-900">{row.exitsInPeriod}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="validade" className="flex scroll-mt-16 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Validade e risco</p>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Alertar com
            <input
              type="number"
              min="0"
              value={expiryWarningDays}
              onChange={(e) => setExpiryWarningDays(Number(e.target.value))}
              className="h-11 w-16 rounded-lg border border-ink-900/15 px-2 text-center text-xs sm:h-9 outline-none focus:border-forest-700"
            />
            dias de antecedência
          </label>
        </div>
        {expiryRisk.length === 0 ? (
          <AdminState variant="empty" message="Nenhum lote de matéria-prima com validade registrada." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Insumo</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3">Dias restantes</th>
                  <th className="px-4 py-3">Quantidade recebida</th>
                  <th className="px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {expiryRisk.map((row) => (
                  <tr key={`${row.materialId}-${row.batch}`} className="border-b border-forest-950/5 last:border-none">
                    <td className="px-4 py-3 font-semibold text-ink-900">{row.materialName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{row.batch}</td>
                    <td className="px-4 py-3 text-ink-700/70">{new Date(`${row.expiryDate}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.riskLevel === "expired" ? "bg-red-500/10 text-red-700" : row.riskLevel === "warning" ? "bg-amber-500/10 text-amber-700" : "bg-forest-700/10 text-forest-800"
                        }`}
                      >
                        {row.riskLevel === "expired" ? "Vencido" : `${row.daysRemaining} dias`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">{row.quantity}</td>
                    <td className="px-4 py-3 text-ink-700/70">{formatCurrency(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-ink-muted">
          Quantidade recebida no lote — o sistema ainda não rastreia o saldo remanescente por lote específico, só o saldo total do insumo.
        </p>
      </section>

      <section id="inventario" className="flex scroll-mt-16 flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Inventário e divergências</p>
        {divergences.length === 0 ? (
          <AdminState variant="empty" message="Nenhuma divergência registrada — todos os ajustes bateram com a contagem física." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Sistema</th>
                  <th className="px-4 py-3">Contado</th>
                  <th className="px-4 py-3">Diferença</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {divergences.map((row) => (
                  <tr key={row.productId + row.createdAt} className="border-b border-forest-950/5 last:border-none">
                    <td className="px-4 py-3 font-semibold text-ink-900">{productById.get(row.productId)?.name ?? "-----"}</td>
                    <td className="px-4 py-3 text-ink-700/70">{new Date(row.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-ink-700/70">{row.previousBalance}</td>
                    <td className="px-4 py-3 text-ink-700/70">{row.newBalance}</td>
                    <td className={`px-4 py-3 font-semibold ${row.difference < 0 ? "text-red-600" : "text-forest-700"}`}>
                      {row.difference > 0 ? "+" : ""}
                      {row.difference}
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">
                      {row.responsibleId ? (row.responsibleId === userId ? "Você" : "Sistema") : "-----"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{row.observation || "-----"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-ink-muted">Matéria-prima ainda não tem função de ajuste (Fase 1) — só produto acabado aparece aqui.</p>
      </section>

      <section id="tabela" className="flex scroll-mt-16 flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Tabela geral e relatórios</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={search}
              onChange={(e) => updateParam("busca", e.target.value || null)}
              placeholder="Buscar por nome ou código..."
              className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </div>
          <select
            value={groupFilter}
            onChange={(e) => updateParam("grupo", e.target.value || null)}
            className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          >
            <option value="">Todos os grupos</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => updateParam("categoria", e.target.value || null)}
            className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          >
            <option value="">Todas as categorias</option>
            {categoryLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={movementFilter}
            onChange={(e) => updateParam("mov", e.target.value || null)}
            className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          >
            <option value="">Qualquer movimentação</option>
            <option value="30">Movimentados em 30 dias</option>
            <option value="60">Movimentados em 60 dias</option>
            <option value="90">Movimentados em 90 dias</option>
            <option value="older">Sem movimento há +90 dias</option>
            <option value="never">Nunca movimentados</option>
          </select>
          <button
            type="button"
            onClick={() => updateParam("risco", expiryRiskOnly ? null : "1")}
            className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold transition-colors ${
              expiryRiskOnly ? "border-amber-600 bg-amber-500/10 text-amber-700" : "border-ink-900/15 bg-white text-ink-700/70"
            }`}
          >
            Com risco de validade
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearTableFilters}
              className="min-h-11 text-xs font-semibold text-ink-muted hover:underline"
            >
              Limpar filtros
            </button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void handlePdf()}>
            <Download size={14} /> PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
            <Printer size={14} /> Imprimir
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleCsv}>
            <FileSpreadsheet size={14} /> Excel
          </Button>
        </div>

        <p className="text-xs text-ink-muted">
          <strong className="text-ink-900">{filteredItems.length}</strong> de {items.length} item(ns) · valor total{" "}
          <strong className="text-ink-900">{formatCurrency(filteredTotalValue)}</strong>
          {hasActiveFilters || search.trim() ? <> · visão filtrada: {filtersLabel}</> : null}
        </p>

        {filteredItems.length === 0 ? (
          <AdminState variant="empty" message="Nenhum item encontrado." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Estoque</th>
                  <th className="px-4 py-3">Mínimo</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Custo</th>
                  <th className="px-4 py-3">Valor total</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3">Última mov.</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const nextExpiry = item.kind === "material" ? nextExpiryByMaterial.get(item.id) : undefined;
                  return (
                    <tr key={item.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">{item.code}</td>
                      <td className="px-4 py-3 font-semibold text-ink-900">{item.name}</td>
                      <td className="px-4 py-3 text-ink-700/70">{item.groupLabel}</td>
                      <td className="px-4 py-3 text-ink-700/70">
                        {item.currentStock} {item.controlUnit}
                      </td>
                      <td className="px-4 py-3 text-ink-700/70">{item.minStock}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={situationTone(item)}>{situationLabel(item)}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-ink-700/70">{formatCurrency(item.unitCost)}</td>
                      <td className="px-4 py-3 text-ink-700/70">{formatCurrency(stockValue(item))}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">{nextExpiry?.batch || "-----"}</td>
                      <td className="px-4 py-3 text-ink-700/70">
                        {nextExpiry ? new Date(`${nextExpiry.expiryDate}T00:00:00`).toLocaleDateString("pt-BR") : "-----"}
                      </td>
                      <td className="px-4 py-3 text-ink-700/70">{formatDateTime(lastMovementByItem.get(item.id) ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
