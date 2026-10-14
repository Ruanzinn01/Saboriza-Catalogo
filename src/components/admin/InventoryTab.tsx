import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ImageOff, ScanLine, Search } from "lucide-react";
import { BarcodeScannerModal } from "@/components/admin/BarcodeScannerModal";
import { inventoryItemPath, isOperatorBase, useSeparaBase } from "@/lib/separa-base";
import { AdminState } from "@/components/admin/AdminState";
import { InventoryStartSheet } from "@/components/admin/InventoryStartSheet";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  FILTER_OPTIONS,
  GROUP_TITLES,
  STATE_META,
  formatDateTime,
  lookupItemByCode,
  matchesFilter,
  matchesQuery,
  percent,
  sessionLabel,
  sessionStatusLabel,
} from "@/lib/inventory";
import { useInventoryStore } from "@/store/inventory-store";
import type { InventoryItem, InventorySession } from "@/types/inventory";
import { InventoryResults } from "@/components/admin/InventoryResults";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/10">
      <div className="h-full rounded-full bg-forest-700 transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}

interface ItemRowProps {
  item: InventoryItem;
  workable: boolean;
  canManage: boolean;
  onOpen: (item: InventoryItem) => void;
  onRecount: (item: InventoryItem) => void;
}

function ItemRow({ item, workable, canManage, onOpen, onRecount }: ItemRowProps) {
  const meta = STATE_META[item.state];
  const clickable = workable && (item.state === "PENDING" || item.state === "RECOUNT");
  const canRequestRecount = workable && canManage && (item.state === "COUNTED" || item.state === "DIVERGENCE");

  const body = (
    <>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-900/5 text-ink-muted">
          <ImageOff size={18} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-bold text-ink-900">{item.name}</span>
        <span className="truncate text-xs text-ink-muted">
          {[item.presentation, item.kindLabel, item.baseUnit].filter(Boolean).join(" · ")}
        </span>
        {item.sku && <span className="font-mono text-[11px] text-ink-muted">{item.sku}</span>}
      </span>
      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", meta.className)}>{meta.label}</span>
    </>
  );

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-forest-950/10 bg-white">
      {clickable ? (
        <button type="button" onClick={() => onOpen(item)} className="flex min-h-14 flex-1 items-center gap-3 p-3 text-left">
          {body}
        </button>
      ) : (
        <div className="flex min-h-14 flex-1 items-center gap-3 p-3">{body}</div>
      )}
      {canRequestRecount && (
        <button
          type="button"
          onClick={() => onRecount(item)}
          className="mr-3 min-h-11 shrink-0 rounded-xl border border-forest-900/20 px-3 text-xs font-bold text-forest-900 hover:bg-forest-900/5"
        >
          Recontar
        </button>
      )}
    </div>
  );
}

function SessionHeader({ session }: { session: InventorySession }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl border border-forest-950/10 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold-600">Inventário</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold",
            session.status === "OPEN" ? "bg-forest-950/10 text-forest-950" : "bg-ink-900/10 text-ink-700"
          )}
        >
          {sessionStatusLabel(session.status)}
        </span>
      </div>
      <p className="text-base font-extrabold text-forest-950">{sessionLabel(session)}</p>
      <p className="text-xs text-ink-muted">
        {session.locationLabel ? `${session.locationLabel} · ` : ""}
        {formatDateTime(session.startsAt)} até {formatDateTime(session.endsAt)}
      </p>
      {session.reason && <p className="text-xs text-ink-muted">Motivo: {session.reason}</p>}
    </div>
  );
}

export function InventoryTab() {
  const navigate = useNavigate();
  const base = useSeparaBase();
  const operatorView = isOperatorBase(base);
  const sessions = useInventoryStore((state) => state.sessions);
  const sessionsStatus = useInventoryStore((state) => state.sessionsStatus);
  const selectedSessionId = useInventoryStore((state) => state.selectedSessionId);
  const items = useInventoryStore((state) => state.items);
  const itemsStatus = useInventoryStore((state) => state.itemsStatus);
  const filter = useInventoryStore((state) => state.filter);
  const query = useInventoryStore((state) => state.query);
  const groupFocus = useInventoryStore((state) => state.groupFocus);
  const scrollY = useInventoryStore((state) => state.scrollY);
  const fetchSessions = useInventoryStore((state) => state.fetchSessions);
  const fetchItems = useInventoryStore((state) => state.fetchItems);
  const selectSession = useInventoryStore((state) => state.selectSession);
  const setFilter = useInventoryStore((state) => state.setFilter);
  const setQuery = useInventoryStore((state) => state.setQuery);
  const setGroupFocus = useInventoryStore((state) => state.setGroupFocus);
  const saveScroll = useInventoryStore((state) => state.saveScroll);
  const subscribeRealtime = useInventoryStore((state) => state.subscribeRealtime);
  const unsubscribeRealtime = useInventoryStore((state) => state.unsubscribeRealtime);
  const closeSession = useInventoryStore((state) => state.closeSession);
  const requestRecount = useInventoryStore((state) => state.requestRecount);

  const [startOpen, setStartOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [choices, setChoices] = useState<InventoryItem[] | null>(null);
  const scrollRestored = useRef(false);

  useEffect(() => {
    void fetchSessions();
    subscribeRealtime();
    return () => unsubscribeRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (itemsStatus !== "ready" || scrollRestored.current) return;
    scrollRestored.current = true;
    if (scrollY > 0) window.scrollTo({ top: scrollY });
  }, [itemsStatus, scrollY]);

  const session = sessions.find((candidate) => candidate.id === selectedSessionId) ?? null;
  const upcoming = sessions.filter((candidate) => candidate.status === "SCHEDULED");
  const canManage = sessions.some((candidate) => candidate.canManage);
  const workable = session?.status === "OPEN";

  const visibleByGroup = useMemo(() => {
    const filtered = items.filter((item) => matchesFilter(item, filter) && matchesQuery(item, query));
    return {
      1: filtered.filter((item) => item.groupNo === 1),
      2: filtered.filter((item) => item.groupNo === 2),
    };
  }, [items, filter, query]);

  const filterCounts = useMemo(
    () => Object.fromEntries(FILTER_OPTIONS.map((option) => [option.key, items.filter((item) => matchesFilter(item, option.key)).length])),
    [items]
  );

  function handleOpen(item: InventoryItem) {
    saveScroll(window.scrollY);
    navigate(inventoryItemPath(base, item.id));
  }

  function openFromCode(rawCode: string): boolean {
    const result = lookupItemByCode(items, rawCode);
    if (result.kind === "empty") return false;
    if (result.kind === "none") {
      toast.error("Código não encontrado neste inventário. Use a busca manual.");
      return false;
    }
    if (result.kind === "multiple") {
      setChoices(result.items);
      toast.error("Este código pertence a mais de um item. Escolha o correto.");
      return true;
    }
    const target = result.item;
    if (target.state !== "PENDING" && target.state !== "RECOUNT") {
      toast.error("Este item já foi contado.");
      return true;
    }
    handleOpen(target);
    return true;
  }

  function handleScan(code: string) {
    setScannerOpen(false);
    openFromCode(code);
  }

  async function handleRecount(item: InventoryItem) {
    const message = await requestRecount(item.id);
    if (message) toast.error(message);
    else toast.success("Recontagem solicitada");
  }

  async function handleClose() {
    if (!session || closing) return;
    setClosing(true);
    const message = await closeSession(session.id);
    setClosing(false);
    if (message) toast.error(message);
    else toast.success("Inventário encerrado");
  }

  if (sessionsStatus === "loading" || sessionsStatus === "idle") {
    return <AdminState variant="loading" message="Carregando inventário..." />;
  }
  if (sessionsStatus === "error") {
    return <AdminState variant="error" message="Não foi possível carregar o inventário." onRetry={() => void fetchSessions()} />;
  }

  const startSheet = <InventoryStartSheet open={startOpen} onClose={() => setStartOpen(false)} />;

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <AdminState
          variant="empty"
          message={canManage || !operatorView ? "Nenhum inventário disponível." : "Nenhum inventário disponível para você agora. Aguarde a liberação do gestor."}
        />
        {upcoming.map((candidate) => (
          <div key={candidate.id} className="rounded-2xl border border-forest-950/10 bg-white p-4 text-sm">
            <p className="font-bold text-forest-950">Programado: {sessionLabel(candidate)}</p>
            <p className="text-xs text-ink-muted">Abre em {formatDateTime(candidate.startsAt)}</p>
          </div>
        ))}
        {canManage && (
          <Button className="w-full" onClick={() => setStartOpen(true)}>
            Iniciar inventário agora
          </Button>
        )}
        {startSheet}
      </div>
    );
  }

  const overallPercent = percent(session.counted, session.total);
  const groupOneDone = session.group1Total > 0 && session.group1Counted === session.group1Total;
  const groups: { no: 1 | 2; total: number; counted: number }[] = [
    { no: 1, total: session.group1Total, counted: session.group1Counted },
    { no: 2, total: session.group2Total, counted: session.group2Counted },
  ];

  return (
    <div className="flex flex-col gap-4">
      {sessions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sessions.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => void selectSession(candidate.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-xl border px-3 text-xs font-bold transition-colors",
                candidate.id === session.id ? "border-forest-700 bg-forest-950/10 text-forest-950" : "border-ink-900/15 text-ink-muted"
              )}
            >
              {sessionLabel(candidate)} · {sessionStatusLabel(candidate.status)}
            </button>
          ))}
        </div>
      )}

      <SessionHeader session={session} />

      {session.status === "SCHEDULED" ? (
        <AdminState variant="empty" message={`Este inventário abre em ${formatDateTime(session.startsAt)}.`} />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-4">
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-bold text-ink-900">
                {session.counted}/{session.total} realizados
              </span>
              <span className="font-mono text-xs text-ink-muted">{overallPercent}%</span>
            </div>
            <ProgressBar value={overallPercent} />
            <p className="text-xs text-ink-muted">
              {session.total} previstos · {session.counted} contados · {session.pending} pendentes · {session.divergences} divergências
              {session.recount > 0 ? ` · ${session.recount} em recontagem` : ""}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {groups.map((group) => (
                <button
                  key={group.no}
                  type="button"
                  onClick={() => setGroupFocus(groupFocus === group.no ? null : group.no)}
                  className={cn(
                    "flex min-h-11 flex-col gap-1 rounded-2xl border p-3 text-left transition-colors",
                    groupFocus === group.no ? "border-forest-700 bg-forest-950/5" : "border-ink-900/10"
                  )}
                >
                  <span className="text-xs font-bold text-ink-900">{GROUP_TITLES[group.no]}</span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {group.counted}/{group.total} · {percent(group.counted, group.total)}%
                  </span>
                  <ProgressBar value={percent(group.counted, group.total)} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && workable && openFromCode(query)) setQuery("");
                }}
                placeholder="Buscar por nome, apresentação ou SKU"
                className="min-h-11 w-full rounded-2xl border border-ink-900/15 bg-white pl-10 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
              />
            </label>
            {workable && (
              <Button variant="outline" className="w-full" onClick={() => setScannerOpen(true)}>
                <ScanLine size={16} /> Ler código
              </Button>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold transition-colors",
                    filter === option.key ? "bg-white text-forest-950 shadow-sm ring-1 ring-forest-950/10" : "bg-ink-900/5 text-ink-muted hover:text-ink-900"
                  )}
                >
                  {option.label} <span className="font-mono text-xs">{filterCounts[option.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {itemsStatus === "loading" && items.length === 0 ? (
            <AdminState variant="loading" message="Carregando itens..." />
          ) : itemsStatus === "error" ? (
            <AdminState variant="error" message="Não foi possível carregar os itens." onRetry={() => void fetchItems(session.id)} />
          ) : (
            groups
              .filter((group) => groupFocus === null || groupFocus === group.no)
              .map((group) => {
                const rows = visibleByGroup[group.no];
                const highlighted = group.no === 2 && groupOneDone && group.counted < group.total;
                return (
                  <section
                    key={group.no}
                    className={cn("flex flex-col gap-2 rounded-3xl p-1", highlighted && "bg-forest-950/5 ring-2 ring-forest-700/40")}
                  >
                    <div className="flex items-center justify-between gap-2 px-2 pt-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{GROUP_TITLES[group.no]}</p>
                      {highlighted && <span className="rounded-full bg-forest-700 px-2.5 py-1 text-[11px] font-bold text-white">Próximo grupo</span>}
                    </div>
                    {rows.length === 0 ? (
                      <p className="px-2 pb-3 text-sm text-ink-muted">
                        {group.total === 0 ? "Nenhum item neste grupo." : "Nenhum item neste filtro."}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {rows.map((item) => (
                          <ItemRow key={item.id} item={item} workable={Boolean(workable)} canManage={session.canManage} onOpen={handleOpen} onRecount={(row) => void handleRecount(row)} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
          )}
        </>
      )}

      {session.canManage && (
        <div className="flex flex-col gap-2">
          {session.status === "OPEN" && (
            <Button variant="outline" className="w-full" disabled={closing} onClick={() => void handleClose()}>
              {closing ? "Encerrando..." : "Encerrar inventário"}
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => setStartOpen(true)}>
            Iniciar inventário agora
          </Button>
          {session.status !== "SCHEDULED" && <InventoryResults sessionId={session.id} refreshKey={session.counted + session.recount} />}
        </div>
      )}
      {choices && (
        <div role="alert" className="flex flex-col gap-2 rounded-3xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">Código ligado a mais de um item. Escolha pelo cadastro:</p>
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => {
                setChoices(null);
                handleOpen(choice);
              }}
              className="min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-left text-sm font-bold text-ink-900"
            >
              {choice.name} <span className="font-mono text-xs text-ink-muted">{choice.sku}</span>
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setChoices(null)}>
            Cancelar
          </Button>
        </div>
      )}
      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
      {startSheet}
    </div>
  );
}
