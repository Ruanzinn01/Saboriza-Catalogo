import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import { HEALTH_COLOR, HEALTH_LABEL, ITEM_TYPE_PLURAL, MOVEMENT_LABEL, healthRangeNote } from "@/lib/estoque";
import { formatDateTime } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { fromUntyped } from "@/lib/supabase-rpc";
import { Dialog } from "@/components/ui/Dialog";
import type { LedgerMovementType, StockHealth, StockPositionItem } from "@/types/estoque";

export function HealthBadge({ health }: { health: StockHealth }) {
  const color = HEALTH_COLOR[health];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${color}18`, color }}>
      {HEALTH_LABEL[health]}
    </span>
  );
}

/** Cartão clicável de indicador (equivale ao botão .kpi do protótipo). */
export function KpiButton({
  title,
  value,
  sub,
  accent,
  onClick,
}: {
  title: string;
  value: ReactNode;
  sub: ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative min-w-0 rounded-2xl border border-forest-950/10 bg-white p-4 text-left transition hover:-translate-y-px hover:shadow-md"
    >
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em]" style={accent ? { color: accent } : undefined}>
        {title}
      </span>
      <strong className="mt-2 block break-words text-2xl font-extrabold leading-tight text-forest-950">{value}</strong>
      <small className="mt-1 block text-xs text-ink-muted">{sub}</small>
      <span aria-hidden className="absolute right-3 top-3 text-ink-muted">›</span>
    </button>
  );
}

export function Section({ title, note }: { title: string; note?: string }) {
  return (
    <p className="text-sm text-ink-muted">
      <b className="text-ink-900">{title}</b>
      {note ? ` · ${note}` : ""}
    </p>
  );
}

export function Card({ title, note, children, className }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-3xl border border-forest-950/10 bg-white", className)}>
      <div className="border-b border-forest-950/10 px-4 py-3">
        <h2 className="text-base font-extrabold text-forest-950">{title}</h2>
      </div>
      {children}
      {note && <p className="px-4 pb-3 text-[11px] leading-relaxed text-ink-muted">{note}</p>}
    </section>
  );
}

export interface DonutEntry {
  name: string;
  value: number;
  color: string;
}

export function Donut({ entries, center, label, onSelect }: { entries: DonutEntry[]; center: ReactNode; label: string; onSelect?: (index: number) => void }) {
  const sum = entries.reduce((total, entry) => total + entry.value, 0);
  let start = 0;
  const stops = entries
    .map((entry) => {
      const end = start + (sum ? (entry.value / sum) * 100 : 0);
      const stop = `${entry.color} ${start}% ${end}%`;
      start = end;
      return stop;
    })
    .join(",");
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 p-4">
      <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: sum ? `conic-gradient(${stops})` : "#edf0ea" }} role="img" aria-label={label}>
        <div className="absolute inset-[25px] rounded-full bg-white" />
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-xl font-bold text-forest-950">
          {center}
          <small className="text-[10px] font-normal text-ink-muted">{label}</small>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {entries.map((entry, index) => (
          <button key={entry.name} type="button" onClick={() => onSelect?.(index)} className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-[11px] hover:underline">
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <b className="whitespace-nowrap">
              {formatNumber(entry.value)} · {sum ? formatNumber(Math.round((entry.value / sum) * 100)) : 0}%
            </b>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PositionTable({ items, onOpen }: { items: StockPositionItem[]; onOpen: (item: StockPositionItem) => void }) {
  if (items.length === 0) return <p className="p-8 text-center text-sm text-ink-muted">Nenhum item corresponde aos filtros.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-forest-950/10 bg-cream-50 text-[10px] uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-3 py-3">Produto / código</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3">Físico</th>
            <th className="px-3 py-3">Reservado</th>
            <th className="px-3 py-3">Disponível</th>
            <th className="px-3 py-3">Valor a custo</th>
            <th className="px-3 py-3">Cobertura disponível</th>
            <th className="px-3 py-3">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.itemType}-${item.itemId}`}
              tabIndex={0}
              role="button"
              aria-label={`Detalhes de ${item.name}`}
              onClick={() => onOpen(item)}
              onKeyDown={(e) => e.key === "Enter" && onOpen(item)}
              className="cursor-pointer border-b border-forest-950/5 last:border-none hover:bg-forest-950/5"
            >
              <td className="px-3 py-3">
                <b>{item.name}</b>
                <small className="block font-mono text-[10px] text-ink-muted">{item.sku}</small>
              </td>
              <td className="px-3 py-3 text-ink-700/80">{ITEM_TYPE_PLURAL[item.itemType]}</td>
              <td className="px-3 py-3">{formatNumber(item.physical)} {item.baseUnit}</td>
              <td className="px-3 py-3">{formatNumber(item.reserved)} {item.baseUnit}</td>
              <td className="px-3 py-3">{formatNumber(item.available)} {item.baseUnit}</td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold">{item.stockValue === null ? <span className="font-normal text-ink-muted">Sem custo</span> : formatCurrency(item.stockValue)}</td>
              <td className="px-3 py-3">{item.coverageDays === null ? "—" : `${formatNumber(item.coverageDays, 1)} dias`}</td>
              <td className="px-3 py-3"><HealthBadge health={item.health} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ItemMove {
  id: string;
  type: LedgerMovementType;
  quantity: number;
  before: number | null;
  after: number | null;
  note: string;
  at: string;
}

/** "Como chegamos neste número?" — cálculo, origem do consumo e movimentos do item. */
export function ItemDetailDialog({ item, onClose }: { item: StockPositionItem | null; onClose: () => void }) {
  const [moves, setMoves] = useState<ItemMove[] | null>(null);

  useEffect(() => {
    setMoves(null);
    if (!item) return;
    let active = true;
    void fromUntyped("stock_ledger")
      .select("ledger_id, movement_type, quantity, previous_balance, new_balance, note, occurred_at")
      .eq("item_id", item.itemId)
      .order("occurred_at", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (!active) return;
        setMoves(
          ((data ?? []) as { ledger_id: string; movement_type: LedgerMovementType; quantity: number; previous_balance: number | null; new_balance: number | null; note: string | null; occurred_at: string }[]).map((row) => ({
            id: row.ledger_id,
            type: row.movement_type,
            quantity: Number(row.quantity),
            before: row.previous_balance === null ? null : Number(row.previous_balance),
            after: row.new_balance === null ? null : Number(row.new_balance),
            note: row.note ?? "",
            at: row.occurred_at,
          }))
        );
      });
    return () => {
      active = false;
    };
  }, [item]);

  if (!item) return null;
  const policy = { min: item.policyMin, ideal: item.policyIdeal, max: item.policyMax };
  const source = item.itemType === "PRODUCT" ? "saídas de pedido (Finalizar Conferência)" : "consumos produtivos confirmados";

  return (
    <Dialog open onClose={onClose} title={item.name}>
      <p className="text-sm text-ink-700">
        {item.sku} · {ITEM_TYPE_PLURAL[item.itemType]} · {item.category || "Sem categoria"}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Físico", item.physical],
          ["Reservado", item.reserved],
          ["Disponível", item.available],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-forest-950/10 p-3">
            <small className="text-ink-muted">{label as string}</small>
            <strong className="block text-lg">
              {formatNumber(value as number)} {item.baseUnit}
            </strong>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
        <b>Como chegamos neste número?</b>
        <br />
        {item.dailyRate !== null && item.coverageDays !== null ? (
          <>
            Disponível {formatNumber(item.available)} ÷ média {formatNumber(item.dailyRate, 2)} por dia = {formatNumber(item.coverageDays, 1)} dias. Fonte: {source}, histórico de {item.historyDays} dias.
          </>
        ) : (
          <>Sem demanda média válida; a cobertura não é calculada (nada de cobertura artificial).</>
        )}
        <br />
        {item.stockValue !== null && item.unitCost !== null
          ? `Valor físico: ${formatNumber(item.physical)} × ${formatCurrency(item.unitCost)} = ${formatCurrency(item.stockValue)}. `
          : "Sem custo conhecido: o valor a custo não é inventado. "}
        <HealthBadge health={item.health} /> <span className="text-ink-muted">({healthRangeNote(item.health, policy)})</span>
      </div>

      {item.historyDays > 0 && item.historyDays < 90 && (
        <p className="mt-2 inline-block rounded-full bg-gold-500/15 px-2.5 py-1 text-[11px] font-bold text-gold-700">Histórico em formação · {item.historyDays}/90 dias</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-forest-950/10 p-3">
          <small className="text-ink-muted">Abastecimento confirmado</small>
          <strong className="block text-lg">{formatNumber(item.incoming)} {item.baseUnit}</strong>
          <small className="text-ink-muted">Compra a receber</small>
        </div>
        <div className="rounded-xl border border-forest-950/10 p-3">
          <small className="text-ink-muted">Em produção</small>
          <strong className="block text-lg">{formatNumber(item.inProduction)} {item.baseUnit}</strong>
          <small className="text-ink-muted">Disponível somente após fechamento</small>
        </div>
      </div>
      <p className="mt-3 text-sm">
        Necessidade líquida: <b>{item.netNeed === null ? "Avaliação manual (sem base de demanda)" : `${formatNumber(item.netNeed)} ${item.baseUnit}`}</b>
      </p>

      <h3 className="mb-1 mt-4 text-sm font-bold">Últimas movimentações</h3>
      {moves === null ? (
        <p className="text-xs text-ink-muted">Carregando...</p>
      ) : moves.length === 0 ? (
        <p className="text-xs text-ink-muted">Sem movimentos registrados no razão.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {moves.map((move) => (
            <div key={move.id} className="rounded-lg border-l-[3px] border-gold-500 bg-cream-50 px-3 py-2 text-xs">
              <b>{MOVEMENT_LABEL[move.type]}</b> · {move.quantity > 0 ? "+" : ""}
              {formatNumber(move.quantity)} {item.baseUnit}
              <small className="block text-ink-muted">
                {move.note || "—"} · {move.before === null || move.after === null ? "saldo n/d" : `${formatNumber(move.before)} → ${formatNumber(move.after)}`} · {formatDateTime(move.at)}
              </small>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
