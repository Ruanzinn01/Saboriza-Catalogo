import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminState } from "@/components/admin/AdminState";
import { InventoryStartSheet } from "@/components/admin/InventoryStartSheet";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { ITEM_TYPE_LABEL, accuracy } from "@/lib/estoque";
import { formatDateTime, formatQuantity, percent, sessionLabel, sessionStatusLabel } from "@/lib/inventory";
import { useEstoqueStore } from "@/store/estoque-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { DivergenceRow } from "@/types/estoque";

type Pending = { row: DivergenceRow; action: "APPROVE" | "DISMISS" } | null;

export function EstoqueInventario() {
  const sessions = useInventoryStore((state) => state.sessions);
  const sessionsStatus = useInventoryStore((state) => state.sessionsStatus);
  const selectedSessionId = useInventoryStore((state) => state.selectedSessionId);
  const fetchSessions = useInventoryStore((state) => state.fetchSessions);
  const selectSession = useInventoryStore((state) => state.selectSession);
  const requestRecount = useInventoryStore((state) => state.requestRecount);
  const closeSession = useInventoryStore((state) => state.closeSession);
  const subscribeRealtime = useInventoryStore((state) => state.subscribeRealtime);
  const unsubscribeRealtime = useInventoryStore((state) => state.unsubscribeRealtime);

  const divergences = useEstoqueStore((state) => state.divergences);
  const divergencesStatus = useEstoqueStore((state) => state.divergencesStatus);
  const divergencesError = useEstoqueStore((state) => state.divergencesError);
  const fetchDivergences = useEstoqueStore((state) => state.fetchDivergences);
  const resolveDivergence = useEstoqueStore((state) => state.resolveDivergence);
  const fetchPosition = useEstoqueStore((state) => state.fetchPosition);

  const [startOpen, setStartOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const session = sessions.find((candidate) => candidate.id === selectedSessionId) ?? null;

  useEffect(() => {
    void fetchSessions();
    subscribeRealtime();
    return () => unsubscribeRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session?.canManage && session.status !== "SCHEDULED") void fetchDivergences(session.id);
  }, [session?.id, session?.canManage, session?.status, session?.counted, session?.recount, fetchDivergences]);

  const firstCounts = useMemo(() => divergences.filter((row) => row.round === 1), [divergences]);
  const open = useMemo(() => divergences.filter((row) => row.isLatest && row.difference !== 0 && row.adjustmentStatus === "NONE"), [divergences]);
  const resolved = useMemo(() => divergences.filter((row) => row.isLatest && row.difference !== 0 && row.adjustmentStatus !== "NONE"), [divergences]);

  async function handleConfirm() {
    if (!pending || saving) return;
    setSaving(true);
    setSheetError(null);
    const message = await resolveDivergence(pending.row.countId, pending.action, justification.trim());
    setSaving(false);
    if (message) {
      setSheetError(message);
      return;
    }
    toast.success(pending.action === "APPROVE" ? "Ajuste aplicado ao saldo atual" : "Divergência conferida sem ajuste");
    setPending(null);
    setJustification("");
    if (session) await fetchDivergences(session.id);
    void fetchPosition();
  }

  async function handleRecount(row: DivergenceRow) {
    const message = await requestRecount(row.sessionItemId);
    if (message) toast.error(message);
    else {
      toast.success("Recontagem solicitada no Separa Confere");
      if (session) await fetchDivergences(session.id);
    }
  }

  if (sessionsStatus === "loading" || sessionsStatus === "idle") return <AdminState variant="loading" message="Carregando inventário..." />;
  if (sessionsStatus === "error") return <AdminState variant="error" message="Não foi possível carregar o inventário." onRetry={() => void fetchSessions()} />;

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <AdminState variant="empty" message="Nenhum inventário em andamento." />
        <Button className="w-full sm:w-auto" onClick={() => setStartOpen(true)}>
          Iniciar ou programar inventário
        </Button>
        <InventoryStartSheet open={startOpen} onClose={() => setStartOpen(false)} />
      </div>
    );
  }

  const acc = accuracy(session.counted, session.divergences);

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

      <div className="rounded-3xl border border-forest-950/10 bg-white p-4">
        <p className="text-base font-extrabold text-forest-950">{sessionLabel(session)}</p>
        <p className="text-xs text-ink-muted">
          {sessionStatusLabel(session.status)} · {formatDateTime(session.startsAt)} até {formatDateTime(session.endsAt)}
          {session.reason ? ` · ${session.reason}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Previstos" value={session.total} />
        <StatCard label="Progresso" value={`${percent(session.counted, session.total)}%`} hint={`${session.counted} contados · ${session.pending} pendentes`} />
        <StatCard
          label="Acuracidade"
          value={acc === null ? "Indisponível" : `${acc.toLocaleString("pt-BR")}%`}
          hint="Primeira contagem sem divergência ÷ contados"
        />
        <StatCard label="Divergências abertas" value={open.length} tone={open.length > 0 ? "danger" : "default"} hint={`${resolved.length} tratadas`} />
        <StatCard label="Em recontagem" value={session.recount} tone={session.recount > 0 ? "warning" : "default"} />
      </div>

      {!session.canManage ? (
        <AdminState variant="empty" message="Seu perfil não tem permissão para tratar divergências de inventário." />
      ) : divergencesStatus === "loading" && divergences.length === 0 ? (
        <AdminState variant="loading" message="Carregando contagens..." />
      ) : divergencesStatus === "error" ? (
        <AdminState variant="error" message={divergencesError ?? "Não foi possível carregar as contagens."} onRetry={() => void fetchDivergences(session.id)} />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Divergências para tratar</h2>
            {open.length === 0 ? (
              <p className="rounded-2xl border border-forest-950/10 bg-white p-4 text-sm text-ink-muted">
                {firstCounts.length === 0 ? "Nenhuma contagem registrada ainda." : "Nenhuma divergência aberta."}
              </p>
            ) : (
              open.map((row) => (
                <div key={row.countId} className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink-900">{row.name}</p>
                      <p className="font-mono text-[11px] text-ink-muted">
                        {row.sku} · {ITEM_TYPE_LABEL[row.itemType]} · rodada {row.round}
                      </p>
                    </div>
                    <StatusBadge tone="critical" className="shrink-0">
                      {`${row.difference > 0 ? "+" : ""}${formatQuantity(row.difference)}`}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Fotografia {formatQuantity(row.expectedBalance)} · contado {formatQuantity(row.baseQuantity)} · {row.countedByName} ·{" "}
                    {formatDateTime(row.countedAt)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="min-h-11" onClick={() => { setPending({ row, action: "APPROVE" }); setJustification(""); setSheetError(null); }}>
                      Aprovar ajuste
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => { setPending({ row, action: "DISMISS" }); setJustification(""); setSheetError(null); }}>
                      Conferir sem ajuste
                    </Button>
                    {session.status === "OPEN" && (
                      <Button size="sm" variant="outline" className="min-h-11" onClick={() => void handleRecount(row)}>
                        Solicitar recontagem
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>

          {resolved.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Divergências tratadas</h2>
              {resolved.map((row) => (
                <div key={row.countId} className="flex flex-col gap-1 rounded-2xl border border-forest-950/10 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-ink-900">{row.name}</span>
                    <StatusBadge tone={row.adjustmentStatus === "APPROVED" ? "ok" : "neutral"} className="shrink-0">
                      {row.adjustmentStatus === "APPROVED" ? "Ajuste aprovado" : "Conferida sem ajuste"}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Diferença {row.difference > 0 ? "+" : ""}
                    {formatQuantity(row.difference)} · {row.justification}
                  </p>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {session.canManage && session.status === "OPEN" && (
          <Button variant="outline" onClick={async () => { const message = await closeSession(session.id); if (message) toast.error(message); else toast.success("Inventário encerrado"); }}>
            Encerrar inventário
          </Button>
        )}
        {session.canManage && (
          <Button variant="outline" onClick={() => setStartOpen(true)}>
            Iniciar ou programar inventário
          </Button>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        Aprovar aplica a diferença da fotografia ao saldo atual (movimentos posteriores são preservados) e gera um movimento no razão. A primeira contagem nunca é apagada.
      </p>

      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.action === "APPROVE" ? "Aprovar ajuste" : "Conferir sem ajuste"}
        footer={
          <div className="flex flex-col gap-2">
            {sheetError && <p role="alert" className="text-sm font-semibold text-red-600">{sheetError}</p>}
            <Button disabled={saving || justification.trim() === ""} className="w-full" onClick={() => void handleConfirm()}>
              {saving ? "Confirmando..." : pending?.action === "APPROVE" ? "Aplicar ao saldo atual" : "Marcar como conferida"}
            </Button>
          </div>
        }
      >
        {pending && (
          <div className="flex flex-col gap-3">
            <p className="font-bold text-ink-900">{pending.row.name}</p>
            <p className="text-sm text-ink-muted">
              Diferença da contagem: {pending.row.difference > 0 ? "+" : ""}
              {formatQuantity(pending.row.difference)}.{" "}
              {pending.action === "APPROVE"
                ? "O valor será somado ao saldo atual, e não substitui o saldo pela contagem."
                : "O saldo não será alterado."}
            </p>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Justificativa (obrigatória)
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm normal-case tracking-normal text-ink-900 outline-none focus:border-forest-700"
              />
            </label>
          </div>
        )}
      </Sheet>
      <InventoryStartSheet open={startOpen} onClose={() => setStartOpen(false)} />
    </div>
  );
}
