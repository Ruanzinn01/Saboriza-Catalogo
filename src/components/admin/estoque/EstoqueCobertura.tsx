import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AdminState } from "@/components/admin/AdminState";
import { HealthBadge, ItemDetailDialog, KpiButton } from "@/components/admin/estoque/EstoquePrimitives";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/currency";
import { GROUP_LABEL, GROUP_ORDER, HEALTH_FILTER_ORDER, HEALTH_LABEL, summarizePosition } from "@/lib/estoque";
import { normalizeText } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { useEstoqueStore } from "@/store/estoque-store";
import { usePurchaseStore } from "@/store/purchase-store";
import type { StockGroup, StockHealth, StockPositionItem } from "@/types/estoque";

const selectCls = "min-h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

export function EstoqueCobertura({ goTo }: { goTo: (tab: string) => void }) {
  const navigate = useNavigate();
  const position = useEstoqueStore((s) => s.position);
  const status = useEstoqueStore((s) => s.positionStatus);
  const fetchPosition = useEstoqueStore((s) => s.fetchPosition);

  const [typeFilter, setTypeFilter] = useState<StockGroup | "ALL">("ALL");
  const [healthFilter, setHealthFilter] = useState<StockHealth | "">("");
  const [query, setQuery] = useState("");
  const [proposal, setProposal] = useState<StockPositionItem | null>(null);
  const [detail, setDetail] = useState<StockPositionItem | null>(null);

  const catalog = usePurchaseStore((s) => s.catalog);
  const fetchCatalog = usePurchaseStore((s) => s.fetchCatalog);

  useEffect(() => {
    void fetchPosition();
    void fetchCatalog(null);
  }, [fetchPosition, fetchCatalog]);

  // Matéria-prima e produto comprado pronto repõem-se por compra; produto fabricado, por produção.
  const buysItem = (item: StockPositionItem) => item.itemType === "RAW_MATERIAL" || catalog.some((entry) => entry.itemId === item.itemId && entry.usage === "RESALE");

  const filtered = useMemo(() => {
    const term = normalizeText(query.trim());
    return position
      .filter(
        (item) =>
          (typeFilter === "ALL" || item.group === typeFilter) &&
          (healthFilter === "" || item.health === healthFilter) &&
          (term === "" || normalizeText(`${item.name} ${item.sku} ${item.category}`).includes(term))
      )
      .sort((a, b) => (b.netNeed ?? -1) - (a.netNeed ?? -1));
  }, [position, typeFilter, healthFilter, query]);

  const summary = useMemo(() => summarizePosition(filtered), [filtered]);

  if (status === "loading" || status === "idle") return <AdminState variant="loading" message="Carregando cobertura..." />;
  if (status === "error") return <AdminState variant="error" message="Não foi possível carregar a cobertura." onRetry={() => void fetchPosition()} />;

  const policy = position[0] ? { min: position[0].policyMin, ideal: position[0].policyIdeal, max: position[0].policyMax } : { min: 30, ideal: 45, max: 60 };

  // A sugestão abre o módulo de origem; nenhuma compra, produção ou conta a pagar é criada aqui.
  function openOrigin(item: StockPositionItem) {
    setProposal(null);
    navigate(buysItem(item) ? (item.itemType === "RAW_MATERIAL" ? `/admin/despesas/nova?insumo=${item.itemId}` : "/admin/despesas/nova") : "/admin/planos-producao");
    toast.info("Abrimos o módulo de origem. Nada foi criado automaticamente.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={selectCls} aria-label="Tipo de estoque">
          <option value="ALL">Todos os tipos</option>
          {GROUP_ORDER.map((group) => (
            <option key={group} value={group}>{GROUP_LABEL[group]}</option>
          ))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, apresentação ou código…" aria-label="Buscar item" className={`${selectCls} min-w-[180px] flex-1`} />
        <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as StockHealth | "")} className={selectCls} aria-label="Situação">
          <option value="">Todas as situações</option>
          {HEALTH_FILTER_ORDER.map((health) => (
            <option key={health} value={health}>{HEALTH_LABEL[health]}</option>
          ))}
        </select>
      </div>

      <p className="rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
        Produtos: média das saídas por pedido separado (Finalizar Conferência). Matérias-primas, embalagens e insumos: média de consumo produtivo confirmado. Base principal de 90 dias; planos de produção são compromissos futuros separados.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiButton title="MÍNIMO" accent="#d2a640" value={`${formatNumber(policy.min)} dias`} sub="Abaixo disso: atenção à reposição" onClick={() => goTo("politicas")} />
        <KpiButton title="IDEAL" value={`${formatNumber(policy.ideal)} dias`} sub="Alvo da necessidade" onClick={() => goTo("politicas")} />
        <KpiButton title="MÁXIMO" accent="#7966a6" value={`${formatNumber(policy.max)} dias`} sub="Limite de referência para excesso" onClick={() => goTo("politicas")} />
        <KpiButton title="NECESSIDADE ESTIMADA" accent="#357db5" value={formatCurrency(summary.netNeedValue)} sub="Estimativa a custo · não é obrigação financeira" onClick={() => toast.info("Quantidade líquida sugerida × custo. Não cria compra, produção ou conta a pagar.")} />
      </div>

      <section className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
        <div className="border-b border-forest-950/10 px-4 py-3"><h2 className="text-base font-extrabold text-forest-950">Necessidade líquida por item</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-forest-950/10 bg-cream-50 text-[10px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-3">Item / base</th><th className="px-3 py-3">Média/dia</th><th className="px-3 py-3">Disponível</th><th className="px-3 py-3">Ideal</th>
                <th className="px-3 py-3">A receber</th><th className="px-3 py-3">Em produção</th><th className="px-3 py-3">Sugerido</th><th className="px-3 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={`${item.itemType}-${item.itemId}`} className="border-b border-forest-950/5 last:border-none">
                  <td className="px-3 py-3">
                    <button type="button" className="text-left" onClick={() => setDetail(item)}>
                      <b className="hover:underline">{item.name}</b>
                    </button>
                    <small className="block text-[10px] text-ink-muted">{item.itemType === "PRODUCT" ? "Saída por pedido" : "Consumo produtivo"} · {item.historyDays || "sem"} dias · <HealthBadge health={item.health} /></small>
                  </td>
                  <td className="px-3 py-3">{item.dailyRate === null ? "—" : `${formatNumber(item.dailyRate, 2)} ${item.baseUnit}`}</td>
                  <td className="px-3 py-3">{formatNumber(item.available)}</td>
                  <td className="px-3 py-3">{item.dailyRate === null ? "—" : formatNumber(item.dailyRate * item.policyIdeal, 1)}</td>
                  <td className="px-3 py-3">{formatNumber(item.incoming)}</td>
                  <td className="px-3 py-3">{formatNumber(item.inProduction)}</td>
                  <td className="px-3 py-3"><b>{item.netNeed === null ? "Sem base" : `${formatNumber(item.netNeed)} ${item.baseUnit}`}</b></td>
                  <td className="px-3 py-3">
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => setProposal(item)}>
                      {buysItem(item) ? "Ver compra sugerida" : "Ver produção sugerida"}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-ink-muted">Nenhum item corresponde aos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rounded-xl bg-amber-500/15 p-3 text-xs leading-relaxed text-amber-900">
        Uma sugestão não movimenta estoque. O recebimento confirmado ou o fechamento oficial é que gera o movimento. Prazos de chegada precisam ser conferidos antes de assumir que não haverá ruptura.
      </p>

      <Dialog open={proposal !== null} onClose={() => setProposal(null)} title={proposal ? `Planejar reposição · ${proposal.name}` : ""}>
        {proposal && (
          <>
            <p className="text-sm text-ink-700">{proposal.sku} · {GROUP_LABEL[proposal.group]}</p>
            <p className="my-3 rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
              {proposal.dailyRate === null
                ? "Sem demanda média válida: não há base para sugestão automática."
                : `Ideal (${formatNumber(proposal.dailyRate * proposal.policyIdeal, 1)}) − disponível (${formatNumber(proposal.available)}) − compra confirmada (${formatNumber(proposal.incoming)}) − produção aberta (${formatNumber(proposal.inProduction)}).`}
            </p>
            <h3 className="text-lg font-extrabold">{proposal.netNeed === null ? "Sem base para sugestão automática" : `${formatNumber(proposal.netNeed)} ${proposal.baseUnit} sugeridos`}</h3>
            <p className="my-2 text-sm">Destino: <b>{buysItem(proposal) ? "Compras e Despesas" : "Planos de Produção / Produziu Registra"}</b>.</p>
            <p className="mb-3 text-xs text-ink-muted">Ao abrir o módulo de origem, o item vai como contexto. Nenhuma solicitação, compra ou conta a pagar é criada por esta tela.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openOrigin(proposal)}>Abrir {buysItem(proposal) ? "Compras e Despesas" : "Planos de Produção"}</Button>
              <Button variant="outline" onClick={() => { setDetail(proposal); setProposal(null); }}>Conferir dados do item</Button>
            </div>
          </>
        )}
      </Dialog>
      <ItemDetailDialog item={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
