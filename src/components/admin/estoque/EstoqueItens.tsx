import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, normalizeText } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { supabase } from "@/lib/supabase";
import { useEstoqueStore } from "@/store/estoque-store";
import { usePurchaseStore, type PurchaseCatalogItem } from "@/store/purchase-store";
import { useSuppliersStore } from "@/store/suppliers-store";

const selectCls = "min-h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";
const USAGE_LABEL = { MATERIAL: "Matéria-prima / embalagem", RESALE: "Produto para revenda" } as const;

export function EstoqueItens() {
  const catalog = usePurchaseStore((s) => s.catalog);
  const status = usePurchaseStore((s) => s.catalogStatus);
  const fetchCatalog = usePurchaseStore((s) => s.fetchCatalog);
  const saveSupplierCode = usePurchaseStore((s) => s.saveSupplierCode);
  const setLotTracking = usePurchaseStore((s) => s.setLotTracking);
  const registerOpeningBalance = useEstoqueStore((s) => s.registerOpeningBalance);
  const suppliers = useSuppliersStore((s) => s.suppliers);
  const fetchSuppliers = useSuppliersStore((s) => s.fetchSuppliers);
  const [movementCount, setMovementCount] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [usageFilter, setUsageFilter] = useState<"ALL" | "MATERIAL" | "RESALE">("ALL");
  const [editing, setEditing] = useState<PurchaseCatalogItem | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState<PurchaseCatalogItem | null>(null);
  const [openingQty, setOpeningQty] = useState("");
  const [openingCost, setOpeningCost] = useState("");
  const [openingWhy, setOpeningWhy] = useState("");
  const [openingError, setOpeningError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCatalog(null);
    if (suppliers.length === 0) void fetchSuppliers();
    void supabase
      .from("stock_ledger")
      .select("ledger_id", { count: "exact", head: true })
      .in("movement_type", ["PURCHASE_ENTRY", "PURCHASE_RETURN"])
      .then(({ count }) => setMovementCount(count ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = normalizeText(query.trim());
    return catalog.filter(
      (item) =>
        (usageFilter === "ALL" || item.usage === usageFilter) &&
        (term === "" || normalizeText(`${item.name} ${item.sku} ${item.gtin} ${item.brand} ${item.categoryName}`).includes(term))
    );
  }, [catalog, query, usageFilter]);

  const lastPurchase = useMemo(
    () => catalog.map((item) => item.lastPurchaseDate).filter((date): date is string => date !== null).sort().reverse()[0] ?? null,
    [catalog]
  );

  async function handleSaveCode() {
    if (!editing || supplierId === "") return;
    setSaving(true);
    const error = await saveSupplierCode(supplierId, editing.itemType, editing.itemId, code);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Código do fornecedor salvo. O SKU Óris não muda.");
    setEditing(null);
    setCode("");
    setSupplierId("");
  }

  async function handleOpening() {
    if (!opening || saving) return;
    setSaving(true);
    setOpeningError(null);
    const message = await registerOpeningBalance({
      itemType: opening.itemType,
      itemId: opening.itemId,
      quantity: Number(openingQty || 0),
      unitCost: openingCost.trim() === "" ? null : Number(openingCost),
      justification: openingWhy.trim(),
    });
    setSaving(false);
    if (message) {
      setOpeningError(message);
      return;
    }
    toast.success("Saldo inicial registrado com origem e justificativa.");
    setOpening(null);
    void fetchCatalog(null);
  }

  if (status === "loading" || status === "idle") return <AdminState variant="loading" message="Carregando itens..." />;
  if (status === "error") return <AdminState variant="error" message="Não foi possível carregar os itens." onRetry={() => void fetchCatalog(null)} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Itens controlados" value={formatNumber(catalog.length)} hint="Matérias-primas, embalagens e produtos de revenda" />
        <StatCard label="Última compra" value={lastPurchase ? new Date(`${lastPurchase}T00:00:00`).toLocaleDateString("pt-BR") : "—"} />
        <StatCard label="Movimentos de compra" value={movementCount === null ? "—" : formatNumber(movementCount)} hint="Entradas e devoluções no razão" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nome, SKU ou código de barras"
            aria-label="Buscar item"
            className="min-h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </label>
        <select value={usageFilter} onChange={(e) => setUsageFilter(e.target.value as typeof usageFilter)} className={selectCls} aria-label="Tipo de uso">
          <option value="ALL">Todos os tipos</option>
          <option value="MATERIAL">Matéria-prima / embalagem</option>
          <option value="RESALE">Produto para revenda</option>
        </select>
        <Link to="/admin/despesas/nova">
          <Button className="w-full sm:w-auto">+ Registrar compra</Button>
        </Link>
      </div>

      {filtered.length === 0 ? (
        <AdminState variant="empty" message="Nenhum item encontrado." />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <div key={`${item.itemType}-${item.itemId}`} className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold text-forest-950">{item.name}</p>
                <p className="text-xs text-ink-muted">
                  <span className="font-mono">{item.sku}</span> · {item.gtin ? `EAN ${item.gtin}` : "sem código de barras"} · {item.categoryName || "Sem categoria"} · {item.unit} · {USAGE_LABEL[item.usage]}
                </p>
              </div>
              <div className="text-sm sm:text-right">
                <strong className="block text-ink-900">
                  Estoque {formatNumber(item.currentStock)} {item.unit}
                </strong>
                <span className="text-xs text-ink-muted">
                  {item.lastPurchaseCost !== null
                    ? `Última compra ${formatCurrency(item.lastPurchaseCost)}/${item.unit}`
                    : "Aguardando primeira compra"}
                  {item.avgCost > 0 ? ` · custo médio ${formatCurrency(item.avgCost)}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.itemType === "PRODUCT" && (
                  <Link to={`/admin/produtos/${item.itemId}`}>
                    <Button size="sm" variant="outline" className="min-h-11">
                      Preço e margem
                    </Button>
                  </Link>
                )}
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => { setEditing(item); setSupplierId(""); setCode(""); }}>
                  Código do fornecedor
                </Button>
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => { setOpening(item); setOpeningQty(""); setOpeningCost(""); setOpeningWhy(""); setOpeningError(null); }}>
                  Saldo inicial
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  aria-pressed={item.tracksLots}
                  onClick={async () => {
                    const message = await setLotTracking(item.itemType, item.itemId, !item.tracksLots);
                    if (message) toast.error(message);
                    else toast.success(item.tracksLots ? "Rastreamento de lote desativado." : "Rastreamento de lote ativado: a entrada passa a exigir lote e validade.");
                  }}
                >
                  {item.tracksLots ? "Lote: rastreado" : "Rastrear lote"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-ink-muted">
        O valor do estoque usa custo médio ponderado. A margem de revenda usa o custo líquido da compra válida mais recente. São indicadores diferentes.
        {lastPurchase ? ` Última atualização de custo em ${formatDateTime(`${lastPurchase}T00:00:00`)}.` : ""}
      </p>

      <Sheet
        open={opening !== null}
        onClose={() => setOpening(null)}
        title="Saldo inicial"
        footer={
          <div className="flex flex-col gap-2">
            {openingError && <p role="alert" className="text-sm font-semibold text-red-600">{openingError}</p>}
            <Button className="w-full" disabled={saving || openingWhy.trim() === ""} onClick={() => void handleOpening()}>
              {saving ? "Registrando..." : "Registrar saldo inicial"}
            </Button>
          </div>
        }
      >
        {opening && (
          <div className="flex flex-col gap-3">
            <p className="font-bold text-ink-900">{opening.name}</p>
            <p className="text-xs text-ink-muted">
              O saldo atual não é editável no cadastro. O saldo inicial gera movimento com origem e justificativa; o custo informado inicia a avaliação média e a referência de margem enquanto não houver compra. Custo desconhecido fica em branco, nunca zero.
            </p>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Quantidade ({opening.unit})
              <input type="number" min={0} step="any" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} className="min-h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm normal-case tracking-normal text-ink-900 outline-none focus:border-forest-700" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Custo unitário (R$) — opcional
              <input type="number" min={0} step="0.01" value={openingCost} onChange={(e) => setOpeningCost(e.target.value)} className="min-h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm normal-case tracking-normal text-ink-900 outline-none focus:border-forest-700" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Origem / justificativa (obrigatória)
              <textarea value={openingWhy} onChange={(e) => setOpeningWhy(e.target.value)} rows={3} className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm normal-case tracking-normal text-ink-900 outline-none focus:border-forest-700" />
            </label>
          </div>
        )}
      </Sheet>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Código do fornecedor"
        footer={
          <Button className="w-full" disabled={saving || supplierId === ""} onClick={() => void handleSaveCode()}>
            {saving ? "Salvando..." : "Salvar código"}
          </Button>
        }
      >
        {editing && (
          <div className="flex flex-col gap-3">
            <p className="font-bold text-ink-900">{editing.name}</p>
            <p className="text-xs text-ink-muted">O código pertence ao par fornecedor + item. O mesmo código pode existir em outro fornecedor e nunca substitui o SKU Óris ({editing.sku}).</p>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Fornecedor
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectCls}>
                <option value="">Selecione</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.tradeName || supplier.companyName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Código deste fornecedor (vazio remove o vínculo)
              <input value={code} onChange={(e) => setCode(e.target.value)} className="min-h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm normal-case tracking-normal text-ink-900 outline-none focus:border-forest-700" />
            </label>
          </div>
        )}
      </Sheet>
    </div>
  );
}
