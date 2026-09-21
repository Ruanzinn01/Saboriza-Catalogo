import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRightLeft, PackagePlus } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { useStockStore } from "@/store/stock-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockActionSheet } from "@/components/admin/StockActionSheet";
import { situationLabel, situationTone } from "@/lib/stock-insights";
import type { StockMovementOrigin } from "@/types/stock";

type PeriodFilter = "7dias" | "mes" | "tudo" | "personalizado";

const originLabel: Record<StockMovementOrigin, string> = {
  production: "Produção",
  entry: "Entrada manual",
  order: "Pedido",
  adjustment: "Ajuste",
};

function isWithinPeriod(date: Date, period: PeriodFilter, from: string, to: string) {
  const now = new Date();
  if (period === "tudo") return true;
  if (period === "7dias") {
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }
  if (period === "mes") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (period === "personalizado") {
    if (!from && !to) return true;
    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59:59`) : null;
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  }
  return true;
}

export function ProductStockDetailPage() {
  const { productId } = useParams();
  const products = useCatalogStore((state) => state.products);
  const catalogStatus = useCatalogStore((state) => state.status);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const movementsByProduct = useStockStore((state) => state.movementsByProduct);
  const movementsStatus = useStockStore((state) => state.status);
  const fetchMovements = useStockStore((state) => state.fetchMovements);
  const userId = useAdminAuthStore((state) => state.session?.user.id);

  const [period, setPeriod] = useState<PeriodFilter>("mes");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sheetMode, setSheetMode] = useState<"entry" | "adjustment" | null>(null);

  useEffect(() => {
    if (products.length === 0) fetchCatalog();
    if (productId) fetchMovements(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const product = products.find((item) => item.id === productId);
  const movements = useMemo(() => movementsByProduct[productId ?? ""] ?? [], [movementsByProduct, productId]);

  const filtered = useMemo(
    () => movements.filter((movement) => isWithinPeriod(new Date(movement.createdAt), period, from, to)),
    [movements, period, from, to]
  );

  if (catalogStatus === "loading" && !product) {
    return <AdminState variant="loading" message="Carregando produto..." />;
  }

  if (!product) {
    return <AdminState variant="empty" message="Produto não encontrado." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={product.name}
        eyebrow={product.code}
        back={{ to: "/admin/estoque", label: "Voltar para Estoque" }}
        actions={
          <>
            <Button variant="outline" onClick={() => setSheetMode("entry")}>
              <PackagePlus size={16} /> Entrada
            </Button>
            <Button variant="outline" onClick={() => setSheetMode("adjustment")}>
              <ArrowRightLeft size={16} /> Ajuste
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Estoque atual" value={`${product.currentStock} un`} />
        <StatCard label="Mínimo" value={`${product.minStock} un`} />
        <StatCard
          label="Situação"
          value={<StatusBadge tone={situationTone(product)}>{situationLabel(product)}</StatusBadge>}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["7dias", "mes", "tudo", "personalizado"] as PeriodFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              period === key ? "bg-forest-950 text-cream-50" : "bg-white text-ink-700/70 hover:bg-forest-950/5"
            }`}
          >
            {key === "7dias" ? "Últimos 7 dias" : key === "mes" ? "Este mês" : key === "tudo" ? "Tudo" : "Personalizado"}
          </button>
        ))}
      </div>

      {period === "personalizado" && (
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-muted">De</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-muted">Até</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </label>
        </div>
      )}

      {movementsStatus === "loading" && movements.length === 0 ? (
        <AdminState variant="loading" message="Carregando movimentação..." />
      ) : filtered.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma movimentação nesse período." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Movimento</th>
                <th className="px-4 py-3">Quantidade</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((movement) => (
                <tr key={movement.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                  <td className="px-4 py-3 text-ink-700/70">{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{originLabel[movement.origin]}</td>
                  <td className={`px-4 py-3 font-semibold ${movement.variation < 0 ? "text-red-600" : "text-forest-700"}`}>
                    {movement.variation > 0 ? "+" : ""}
                    {movement.variation} un
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">
                    {movement.previousBalance} → {movement.newBalance}
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">
                    {movement.responsibleId ? (movement.responsibleId === userId ? "Você" : "Sistema") : "-----"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{movement.observation || "-----"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StockActionSheet mode={sheetMode} product={product} onClose={() => setSheetMode(null)} />
    </div>
  );
}
