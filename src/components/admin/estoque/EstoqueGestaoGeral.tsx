import { useEffect, useMemo, useState } from "react";
import { AdminState } from "@/components/admin/AdminState";
import { Card, Donut, ItemDetailDialog, KpiButton, PositionTable, Section } from "@/components/admin/estoque/EstoquePrimitives";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/currency";
import {
  HEALTH_COLOR,
  HEALTH_FILTER_ORDER,
  HEALTH_LABEL,
  IDLE_THRESHOLD_DAYS,
  ITEM_TYPE_COLOR,
  ITEM_TYPE_PLURAL,
  accuracy,
  healthRangeNote,
  summarizePosition,
} from "@/lib/estoque";
import { normalizeText, percent } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { useEstoqueStore } from "@/store/estoque-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { StockHealth, StockItemType, StockPositionItem } from "@/types/estoque";

const selectCls = "min-h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";
const SHOWN_HEALTH: StockHealth[] = ["ZERO", "CRITICAL", "LOW", "HEALTHY", "ABOVE_IDEAL", "EXCESS"];
const HEALTH_CARD_TITLE: Record<string, string> = {
  ZERO: "ZERADOS",
  CRITICAL: "CRÍTICOS",
  LOW: "ESTOQUE BAIXO",
  HEALTHY: "SAUDÁVEIS",
  ABOVE_IDEAL: "ACIMA DO IDEAL",
  EXCESS: "EXCESSO",
};

interface EstoqueGestaoGeralProps {
  goTo: (tab: string) => void;
}

export function EstoqueGestaoGeral({ goTo }: EstoqueGestaoGeralProps) {
  const position = useEstoqueStore((state) => state.position);
  const status = useEstoqueStore((state) => state.positionStatus);
  const fetchPosition = useEstoqueStore((state) => state.fetchPosition);
  const divergences = useEstoqueStore((state) => state.divergences);
  const fetchDivergences = useEstoqueStore((state) => state.fetchDivergences);
  const losses = useEstoqueStore((state) => state.losses);
  const returns = useEstoqueStore((state) => state.returns);
  const fetchLosses = useEstoqueStore((state) => state.fetchLosses);
  const fetchReturns = useEstoqueStore((state) => state.fetchReturns);
  const sessions = useInventoryStore((state) => state.sessions);
  const fetchSessions = useInventoryStore((state) => state.fetchSessions);

  const [typeFilter, setTypeFilter] = useState<StockItemType | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState<StockHealth | "">("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<{ title: string; items: StockPositionItem[] } | null>(null);
  const [detail, setDetail] = useState<StockPositionItem | null>(null);

  useEffect(() => {
    void fetchPosition();
    void fetchSessions();
    void fetchLosses();
    void fetchReturns();
  }, [fetchPosition, fetchSessions, fetchLosses, fetchReturns]);

  const session = useMemo(() => sessions.find((candidate) => candidate.status === "OPEN") ?? sessions.find((candidate) => candidate.status !== "SCHEDULED") ?? null, [sessions]);

  useEffect(() => {
    if (session?.canManage) void fetchDivergences(session.id);
  }, [session?.id, session?.canManage, session?.counted, fetchDivergences]);

  const categories = useMemo(
    () => Array.from(new Set(position.filter((item) => typeFilter === "ALL" || item.itemType === typeFilter).map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [position, typeFilter]
  );

  const filtered = useMemo(() => {
    const term = normalizeText(query.trim());
    return position.filter(
      (item) =>
        (typeFilter === "ALL" || item.itemType === typeFilter) &&
        (categoryFilter === "" || item.category === categoryFilter) &&
        (healthFilter === "" || item.health === healthFilter) &&
        (term === "" || normalizeText(`${item.name} ${item.sku} ${item.category}`).includes(term))
    );
  }, [position, typeFilter, categoryFilter, healthFilter, query]);

  const summary = useMemo(() => summarizePosition(filtered), [filtered]);
  const policy = filtered[0] ? { min: filtered[0].policyMin, ideal: filtered[0].policyIdeal, max: filtered[0].policyMax } : { min: 30, ideal: 45, max: 60 };
  const historyDays = filtered[0]?.historyDays ?? 0;

  if (status === "loading" || status === "idle") return <AdminState variant="loading" message="Carregando posição do estoque..." />;
  if (status === "error") return <AdminState variant="error" message="Não foi possível carregar o estoque." onRetry={() => void fetchPosition()} />;

  const byType = (type: StockItemType) => filtered.filter((item) => item.itemType === type);
  const valueOf = (items: StockPositionItem[]) => items.reduce((sum, item) => sum + (item.stockValue ?? 0), 0);
  const typeEntries = (["PRODUCT", "RAW_MATERIAL"] as StockItemType[]).map((type) => ({ name: ITEM_TYPE_PLURAL[type], value: byType(type).length, color: ITEM_TYPE_COLOR[type] }));
  const healthEntries = (Object.keys(summary.byHealth) as StockHealth[])
    .filter((health) => summary.byHealth[health] > 0)
    .map((health) => ({ name: HEALTH_LABEL[health], value: summary.byHealth[health], color: HEALTH_COLOR[health], health }));

  const openList = (title: string, items: StockPositionItem[]) => setList({ title, items });
  const valueMax = Math.max(...(["PRODUCT", "RAW_MATERIAL"] as StockItemType[]).map((type) => valueOf(byType(type))), 1);

  // Inventário: acuracidade e contagem realizada são medidas diferentes e nunca se confundem.
  const acc = session ? accuracy(session.counted, session.divergences) : null;
  const openDivergences = divergences.filter((row) => row.isLatest && row.difference !== 0 && row.adjustmentStatus === "NONE");
  const approved = divergences.filter((row) => row.adjustmentStatus === "APPROVED");
  const canSeeResults = Boolean(session?.canManage);
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const monthLosses = losses.filter((row) => row.occurredOn.startsWith(monthPrefix));
  const monthLossCost = monthLosses.reduce((sum, row) => sum + (row.totalCost ?? 0), 0);
  const monthLossUnknown = monthLosses.filter((row) => row.totalCost === null).length;
  const awaitingReturns = returns.filter((row) => row.status === "AWAITING").length;
  const needAlerts = filtered.filter((item) => ["ZERO", "CRITICAL", "LOW"].includes(item.health));
  const withoutDemand = filtered.filter((item) => item.dailyRate === null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setCategoryFilter(""); }} className={selectCls} aria-label="Tipo de estoque">
          <option value="ALL">Todos os tipos</option>
          <option value="PRODUCT">Produtos</option>
          <option value="RAW_MATERIAL">Matérias-primas</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectCls} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, apresentação ou código…" aria-label="Buscar item" className={`${selectCls} min-w-[180px] flex-1`} />
        <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as StockHealth | "")} className={selectCls} aria-label="Situação">
          <option value="">Todas as situações</option>
          {HEALTH_FILTER_ORDER.map((health) => (
            <option key={health} value={health}>{HEALTH_LABEL[health]}</option>
          ))}
        </select>
        <Button variant="outline" onClick={() => { setTypeFilter("ALL"); setCategoryFilter(""); setHealthFilter(""); setQuery(""); }}>Limpar</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>Posição atual · {new Date().toLocaleDateString("pt-BR")}</span>
        <span>Os filtros acima afetam cards, gráficos e tabela.</span>
      </div>

      <Section title="Quanto temos em estoque" note="valores físicos a custo" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiButton title="ESTOQUE TOTAL" value={formatCurrency(summary.valueAtCost)} sub={`Total a custo · ${summary.total} SKUs distintos${summary.itemsWithoutCost > 0 ? ` · ${summary.itemsWithoutCost} sem custo` : ""}`} onClick={() => openList("Composição do estoque", filtered)} />
        {(["PRODUCT", "RAW_MATERIAL"] as StockItemType[]).map((type) => (
          <KpiButton
            key={type}
            title={ITEM_TYPE_PLURAL[type].toUpperCase()}
            accent={ITEM_TYPE_COLOR[type]}
            value={formatCurrency(valueOf(byType(type)))}
            sub={`Posição física a custo · ${byType(type).length} SKUs`}
            onClick={() => openList(ITEM_TYPE_PLURAL[type], byType(type))}
          />
        ))}
      </div>

      <Section title="Saúde do estoque" note="clique para abrir os itens de cada faixa" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {SHOWN_HEALTH.map((health) => (
          <button
            key={health}
            type="button"
            onClick={() => openList(HEALTH_LABEL[health], filtered.filter((item) => item.health === health))}
            className="min-w-0 rounded-2xl border border-forest-950/10 border-t-[3px] bg-white p-3.5 text-left transition hover:shadow-md"
            style={{ borderTopColor: HEALTH_COLOR[health] }}
          >
            <span className="text-[11px] font-semibold" style={{ color: HEALTH_COLOR[health] }}>{HEALTH_CARD_TITLE[health]}</span>
            <strong className="my-1.5 block text-2xl font-extrabold">{summary.byHealth[health]}</strong>
            <small className="block text-[10px] leading-snug text-ink-muted">{healthRangeNote(health, policy)}</small>
          </button>
        ))}
      </div>

      <Section title="Capital, perdas e inventário" note="posição atual e apuração do período" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiButton title="CAPITAL EM EXCESSO" accent="#7966a6" value={formatCurrency(summary.excessValue)} sub={`${summary.excessItems} itens com disponível acima do máximo`} onClick={() => openList("Capital em excesso", filtered.filter((item) => item.excessQty > 0))} />
        <KpiButton
          title="CAPITAL SEM GIRO 90+"
          accent="#7966a6"
          value={historyDays < IDLE_THRESHOLD_DAYS ? "Em formação" : formatCurrency(summary.idleValue)}
          sub={historyDays < IDLE_THRESHOLD_DAYS ? `Histórico de ${historyDays}/${IDLE_THRESHOLD_DAYS} dias: ainda não há como medir 90+ dias parados` : `${summary.idleItems} itens com saldo e 90+ dias sem atividade`}
          onClick={() => openList("Capital sem giro 90+ dias", filtered.filter((item) => item.physical > 0 && (item.idleDays ?? 0) >= IDLE_THRESHOLD_DAYS))}
        />
        <KpiButton title="PERDAS DO MÊS" accent="#bf5a50" value={formatCurrency(monthLossCost)} sub={monthLosses.length === 0 ? "Nenhuma perda confirmada no mês" : `${monthLosses.length} ocorrências${monthLossUnknown > 0 ? ` · ${monthLossUnknown} sem custo conhecido` : ""}`} onClick={() => goTo("retornos")} />
        <KpiButton title="ACURACIDADE INVENTÁRIO" accent="#357db5" value={acc === null ? "—" : `${formatNumber(acc, 1)}%`} sub={acc === null ? "Sem contagens neste período" : "Primeiras contagens sem divergência ÷ contados"} onClick={() => goTo("inventario")} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiButton title="DIVERGÊNCIAS ENCONTRADAS" accent="#d2a640" value={session ? session.divergences : "—"} sub="Primeiras contagens diferentes da fotografia" onClick={() => goTo("inventario")} />
        <KpiButton title="DIVERGÊNCIAS PENDENTES" accent="#d2a640" value={canSeeResults ? openDivergences.length : "—"} sub={canSeeResults ? "Aguardam conferência / aprovação" : "Visível para quem trata divergências"} onClick={() => goTo("inventario")} />
        <KpiButton title="AJUSTES APROVADOS" accent="#357db5" value={canSeeResults ? approved.length : "—"} sub="Diferenças aplicadas ao saldo atual (a contagem original é preservada)" onClick={() => goTo("inventario")} />
        <KpiButton title="CONTAGEM REALIZADA" value={session ? `${percent(session.counted, session.total)}%` : "—"} sub={session ? `${session.counted} de ${session.total} itens da sessão · não é acuracidade` : "Nenhuma sessão de inventário"} onClick={() => goTo("inventario")} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Composição por tipo" note="Participação por número de SKUs. Clique na legenda para filtrar.">
          <Donut entries={typeEntries} center={filtered.length} label="SKUs distintos" onSelect={(index) => setTypeFilter((["PRODUCT", "RAW_MATERIAL"] as StockItemType[])[index])} />
        </Card>
        <Card title="Valor em estoque por tipo" note="Valores em R$ a custo. As categorias comerciais estão no filtro superior.">
          <div className="flex flex-col gap-3 p-4">
            {(["PRODUCT", "RAW_MATERIAL"] as StockItemType[]).map((type) => {
              const value = valueOf(byType(type));
              return (
                <button key={type} type="button" onClick={() => setTypeFilter(type)} className="text-left">
                  <div className="mb-1 flex justify-between text-xs"><b>{ITEM_TYPE_PLURAL[type]}</b><span>{formatCurrency(value)}</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-ink-900/10"><div className="h-full rounded-full" style={{ width: `${(value / valueMax) * 100}%`, background: ITEM_TYPE_COLOR[type] }} /></div>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title="Situação do estoque" note="Classificação pela cobertura disponível; sem histórico aparece separado.">
          <Donut entries={healthEntries} center={filtered.length} label="itens" onSelect={(index) => setHealthFilter(healthEntries[index].health)} />
        </Card>
      </div>

      <Card title="Como o estoque evoluiu" note="O histórico mensal (valor do estoque e entradas × saídas) vem das fotografias de fechamento e aparece a partir do primeiro fechamento, na aba Relatórios mensais.">
        <div className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink-700">A posição atual acima é sempre a de hoje; os gráficos históricos nunca recalculam períodos fechados.</p>
          <Button variant="outline" onClick={() => goTo("relatorios")}>Ir para Relatórios</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Central de Atenção do Estoque" note="Cada alerta abre a origem e a ação pertinente.">
          <button type="button" onClick={() => openList("Reposição prioritária", needAlerts)} className="flex w-full items-center gap-3 border-b border-forest-950/10 px-4 py-3 text-left hover:bg-forest-950/5">
            <span className="flex-1"><b className="block text-xs">Evite a falta de mercadoria</b><small className="text-[11px] text-ink-muted">Confira os itens zerados, críticos e baixos.</small></span>
            <b className="whitespace-nowrap text-sm">{needAlerts.length} itens ›</b>
          </button>
          <button type="button" onClick={() => goTo("retornos")} className="flex w-full items-center gap-3 border-b border-forest-950/10 px-4 py-3 text-left hover:bg-forest-950/5">
            <span className="flex-1"><b className="block text-xs">Retorno aguardando conferência</b><small className="text-[11px] text-ink-muted">Cancelamento não torna mercadoria disponível; só a conferência física.</small></span>
            <b className="whitespace-nowrap text-sm">{awaitingReturns} ›</b>
          </button>
          <button type="button" onClick={() => openList("Sem base de demanda", withoutDemand)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-forest-950/5">
            <span className="flex-1"><b className="block text-xs">Histórico insuficiente ou sem consumo</b><small className="text-[11px] text-ink-muted">Sem cobertura artificial.</small></span>
            <b className="whitespace-nowrap text-sm">{withoutDemand.length} ›</b>
          </button>
        </Card>
        <Card title="Planejar sem duplicar reposição">
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-forest-950/10 p-3"><small className="text-ink-muted">Estoque disponível</small><b className="block">Físico − reservado</b></div>
              <div className="rounded-xl border border-forest-950/10 p-3"><small className="text-ink-muted">A receber</small><b className="block">Compra confirmada</b></div>
              <div className="rounded-xl border border-forest-950/10 p-3"><small className="text-ink-muted">Em produção</small><b className="block">Saldo ainda não fechado</b></div>
            </div>
            <p className="my-3 rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">Reposição líquida considera o disponível e os abastecimentos confirmados. Quantidades futuras não entram no saldo físico.</p>
            <Button onClick={() => goTo("cobertura")}>Analisar necessidade de reposição →</Button>
          </div>
        </Card>
      </div>

      <Card title={`Posição detalhada • ${filtered.length} itens`} note="Clique em uma linha para conferir cálculo, saldo, origem e movimentações.">
        <PositionTable items={filtered} onOpen={setDetail} />
      </Card>

      <Dialog open={list !== null} onClose={() => setList(null)} title={list?.title ?? ""} wide>
        {list && (
          <>
            <p className="mb-3 text-sm text-ink-muted">Posição atual · {list.items.length} itens · {formatCurrency(list.items.reduce((sum, item) => sum + (item.stockValue ?? 0), 0))} a custo</p>
            <PositionTable items={list.items} onOpen={(item) => { setList(null); setDetail(item); }} />
          </>
        )}
      </Dialog>
      <ItemDetailDialog item={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
