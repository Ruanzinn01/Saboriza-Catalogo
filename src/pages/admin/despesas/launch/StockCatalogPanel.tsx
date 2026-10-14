import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanLine } from "lucide-react";
import { normalizeText } from "@/lib/inventory";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";
import { brl } from "@/pages/admin/despesas/shared";
import { usePurchaseStore, type PurchaseCatalogItem } from "@/store/purchase-store";

const C = DESPESAS_COLORS;
const fieldCls = "rounded-[10px] border px-3 py-3 text-sm";

type TypeFilter = "ALL" | "MATERIAL" | "RESALE";

interface StockCatalogPanelProps {
  supplierId: string;
  onAdd: (item: PurchaseCatalogItem) => void;
  onQuickCreate: (barcode?: string) => void;
}

const USAGE_LABEL = { MATERIAL: "Matéria-prima / embalagem", RESALE: "Produto para revenda" } as const;

export function StockCatalogPanel({ supplierId, onAdd, onQuickCreate }: StockCatalogPanelProps) {
  const catalog = usePurchaseStore((s) => s.catalog);
  const status = usePurchaseStore((s) => s.catalogStatus);
  const fetchCatalog = usePurchaseStore((s) => s.fetchCatalog);

  const [query, setQuery] = useState("");
  const [scan, setScan] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchCatalog(supplierId || null);
  }, [supplierId, fetchCatalog]);

  const categories = useMemo(
    () => Array.from(new Set(catalog.filter((item) => typeFilter === "ALL" || item.usage === typeFilter).map((item) => item.categoryName).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [catalog, typeFilter]
  );

  const filtered = useMemo(() => {
    const term = normalizeText(query.trim());
    return catalog.filter(
      (item) =>
        (typeFilter === "ALL" || item.usage === typeFilter) &&
        (categoryFilter === "" || item.categoryName === categoryFilter) &&
        (term === "" || normalizeText(`${item.name} ${item.sku} ${item.gtin} ${item.supplierCode} ${item.brand}`).includes(term))
    );
  }, [catalog, query, typeFilter, categoryFilter]);

  // Leitor que digita como teclado: Enter confirma. Leitura repetida soma na mesma linha; código desconhecido abre o cadastro.
  function handleScan() {
    const code = scan.trim();
    if (code === "") return;
    const found = catalog.find((item) => item.gtin === code || (supplierId !== "" && item.supplierCode === code) || item.sku.toLowerCase() === code.toLowerCase());
    setScan("");
    if (found) {
      onAdd(found);
      scanRef.current?.focus();
      return;
    }
    toast.info("Código não encontrado. Cadastre o item para vinculá-lo.");
    onQuickCreate(code);
  }

  return (
    <div className="rounded-[20px] border bg-white" style={{ borderColor: C.line }}>
      <div className="flex items-center justify-between gap-2 border-b p-[21px]" style={{ borderColor: C.line }}>
        <div>
          <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Adicionar ao carrinho</h2>
          <p className="text-xs" style={{ color: C.muted }}>Busque pelo nome, SKU ou código de barras.</p>
        </div>
        <button onClick={() => onQuickCreate()} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
          + Cadastrar item
        </button>
      </div>

      <div className="flex flex-col gap-2.5 p-[18px]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, SKU ou código do fornecedor" aria-label="Buscar item" className={fieldCls} style={{ borderColor: C.line }} />
        <div className="relative">
          <ScanLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleScan();
              }
            }}
            inputMode="numeric"
            placeholder="Ler código de barras e pressionar Enter"
            aria-label="Ler código de barras"
            className={`${fieldCls} w-full pl-9`}
            style={{ borderColor: C.line }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); setCategoryFilter(""); }} className={fieldCls} style={{ borderColor: C.line }} aria-label="Tipo de item">
            <option value="ALL">Todos os tipos</option>
            <option value="MATERIAL">Matéria-prima / embalagem</option>
            <option value="RESALE">Produto para revenda</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <p className="text-[11px]" style={{ color: C.muted }}>
          A quantidade e o custo são informados na unidade de controle do item. A unidade do pacote do fornecedor não muda a unidade cadastrada.
        </p>
      </div>

      <div className="max-h-[520px] overflow-y-auto">
        {status === "loading" && catalog.length === 0 ? (
          <p className="p-14 text-center text-sm" style={{ color: C.muted }}>Carregando catálogo...</p>
        ) : status === "error" ? (
          <p role="alert" className="p-14 text-center text-sm font-semibold text-red-600">Não foi possível carregar o catálogo.</p>
        ) : filtered.length === 0 ? (
          <p className="p-14 text-center text-sm" style={{ color: C.muted }}>
            Nenhum item encontrado. Use “Cadastrar item” para criá-lo sem sair do lançamento.
          </p>
        ) : (
          filtered.map((item) => (
            <div key={`${item.itemType}-${item.itemId}`} className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b p-[15px_20px]" style={{ borderColor: "#eff0eb" }}>
              <div className="min-w-0">
                <strong className="block text-[13px]" style={{ color: C.green }}>{item.name}</strong>
                <small style={{ color: C.muted }}>
                  {item.sku} · {item.categoryName || "Sem categoria"} · {item.unit} · {USAGE_LABEL[item.usage]}
                  {item.gtin ? ` · EAN ${item.gtin}` : ""}
                  {item.supplierCode ? ` · cód. fornecedor ${item.supplierCode}` : ""}
                </small>
                <small className="block" style={{ color: C.muted }}>
                  Estoque {item.currentStock.toLocaleString("pt-BR")} {item.unit} ·{" "}
                  {item.lastPurchaseCost !== null ? `última compra ${brl(item.lastPurchaseCost)}/${item.unit}` : "aguardando primeira compra"}
                </small>
              </div>
              <button onClick={() => onAdd(item)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
                + Adicionar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
