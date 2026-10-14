import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { buildEspelhoPdf, formatMinutes, type EspelhoContent } from "@/lib/espelho-pdf";

interface PontoStatus {
  status: string;
  revision_number?: number;
  pending_count?: number;
  stale?: boolean;
  as_of?: string;
  cutoff_date?: string;
  totals?: { worked_minutes: number; normal_minutes: number; extra_minutes: number; late_minutes: number };
}

interface MirrorRow {
  id: string;
  version: number;
  issued_at: string;
  content: EspelhoContent;
}

interface DayPunch {
  id: string;
  type: string;
  server_time: string;
  origin?: string;
}

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  SEM_REVISAO: { text: "Sem revisão", tone: "bg-ink-900/10 text-ink-700" },
  EM_APURACAO: { text: "Revisão gerada", tone: "bg-blue-50 text-blue-800" },
  COM_PENDENCIAS: { text: "Com pendências", tone: "bg-red-100 text-red-700" },
  CONFERIDO: { text: "Conferido", tone: "bg-emerald-100 text-emerald-800" },
  CONSOLIDADO: { text: "Consolidado", tone: "bg-forest-950 text-white" },
  RETIFICADO: { text: "Retificado — aguardando conferência", tone: "bg-gold-500/20 text-gold-800" },
  DESATUALIZADA: { text: "Desatualizada: os dados mudaram", tone: "bg-gold-500/20 text-gold-800" },
  CONFERENCIA_INVALIDADA: { text: "Conferência invalidada: os dados mudaram", tone: "bg-red-100 text-red-700" },
  IMPACTO_PENDENTE: { text: "Impacto pendente: retifique a revisão", tone: "bg-red-100 text-red-700" },
};

const KIND_OPTIONS = [
  { value: "CORRECT_TIME", label: "Corrigir horário de uma batida" },
  { value: "ADD_PUNCH", label: "Adicionar batida esquecida" },
  { value: "VOID_PUNCH", label: "Anular uma batida" },
  { value: "RESTORE_PUNCH", label: "Restaurar batida anulada" },
  { value: "VOID_ADDED", label: "Anular batida adicionada" },
];

const PUNCH_LABEL: Record<string, string> = { ENTRADA: "Entrada", INTERVALO: "Intervalo", RETORNO: "Retorno", SAIDA: "Saída" };

function friendlyError(message: string): string {
  const cleaned = message.replace(/^[A-Z_]+: /, "");
  if (message.startsWith("REVISION_CONFLICT")) return `Os dados mudaram. ${cleaned}`;
  return cleaned;
}

export function PontoRevisaoPanel({ employeeId, competencia, onChanged }: { employeeId: string; competencia: Date; onChanged: () => void }) {
  const competenciaIso = `${competencia.getFullYear()}-${String(competencia.getMonth() + 1).padStart(2, "0")}-01`;
  const [status, setStatus] = useState<PontoStatus | null>(null);
  const [mirrors, setMirrors] = useState<MirrorRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [viewing, setViewing] = useState<MirrorRow | null>(null);

  const [showAdjust, setShowAdjust] = useState(false);
  const [kind, setKind] = useState("CORRECT_TIME");
  const [adjDate, setAdjDate] = useState("");
  const [adjTime, setAdjTime] = useState("");
  const [adjType, setAdjType] = useState("SAIDA");
  const [adjReason, setAdjReason] = useState("");
  const [dayPunches, setDayPunches] = useState<DayPunch[]>([]);
  const [punchId, setPunchId] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("oris360_status_ponto", { p_employee_id: employeeId, p_competencia: competenciaIso });
    setStatus((data as unknown as PontoStatus | null) ?? null);
    const { data: rows } = await supabase
      .from("time_mirrors")
      .select("id, version, issued_at, content")
      .eq("employee_id", employeeId)
      .eq("competence", competenciaIso)
      .order("version", { ascending: false });
    setMirrors((rows ?? []) as unknown as MirrorRow[]);
  }, [employeeId, competenciaIso]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPunchId("");
    setDayPunches([]);
    if (!adjDate || kind === "ADD_PUNCH") return;
    void supabase
      .rpc("oris360_apurar_dia_detalhado", { p_employee_id: employeeId, p_date: adjDate })
      .then(({ data }) => {
        const raw = data as unknown as { punches?: DayPunch[] } | null;
        setDayPunches(raw?.punches ?? []);
      });
  }, [adjDate, kind, employeeId]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, success: string) {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return false;
    }
    toast.success(success);
    await load();
    onChanged();
    return true;
  }

  const current = status?.status ?? "SEM_REVISAO";
  const label = STATUS_LABEL[current] ?? { text: current, tone: "bg-ink-900/10 text-ink-700" };
  const needsReason = current === "CONSOLIDADO" || current === "IMPACTO_PENDENTE";
  const canGenerate = current === "SEM_REVISAO" || ["DESATUALIZADA", "CONFERENCIA_INVALIDADA", "IMPACTO_PENDENTE", "COM_PENDENCIAS", "EM_APURACAO"].includes(current);
  const canReview = (current === "EM_APURACAO" || current === "RETIFICADO") && !status?.stale;
  const canConsolidate = current === "CONFERIDO";
  const canIssue = (current === "CONFERIDO" || current === "CONSOLIDADO") && !status?.stale;

  async function submitAdjust() {
    const needsPunch = ["CORRECT_TIME", "VOID_PUNCH", "RESTORE_PUNCH"].includes(kind);
    const needsTime = kind === "CORRECT_TIME" || kind === "ADD_PUNCH";
    if (!adjDate || (needsPunch && !punchId) || (kind === "VOID_ADDED" && !punchId) || (needsTime && !adjTime)) {
      toast.error("Preencha os campos do ajuste");
      return;
    }
    const newTime = needsTime ? new Date(`${adjDate}T${adjTime}:00`).toISOString() : undefined;
    const ok = await run(
      () =>
        supabase.rpc("oris360_ajustar_batida", {
          p_employee_id: employeeId,
          p_kind: kind,
          p_punch_id: needsPunch ? punchId : undefined,
          p_punch_type: kind === "ADD_PUNCH" ? adjType : undefined,
          p_new_time: newTime,
          p_target_adjustment_id: kind === "VOID_ADDED" ? punchId : undefined,
          p_reason: adjReason,
          p_expected_revision: status?.revision_number ?? 0,
        }),
      "Ajuste registrado. A revisão atual fica desatualizada até gerar uma nova."
    );
    if (ok) {
      setAdjReason("");
      setAdjTime("");
      setPunchId("");
    }
  }

  const selectablePunches = dayPunches.filter((p) => (kind === "VOID_ADDED" ? p.origin === "ADICIONADA" : true));

  return (
    <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Revisão do ponto da competência</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${label.tone}`}>{label.text}</span>
            {status?.revision_number ? <span className="text-xs text-ink-muted">revisão {status.revision_number}</span> : null}
            {status?.pending_count ? <span className="text-xs font-semibold text-red-600">{status.pending_count} dia(s) com ocorrência</span> : null}
          </div>
          {status?.totals && (
            <p className="mt-2 text-xs text-ink-muted">
              Na revisão: trabalhado <b className="text-ink-900">{formatMinutes(status.totals.worked_minutes)}</b> · extra{" "}
              <b className="text-emerald-700">{formatMinutes(status.totals.extra_minutes)}</b> · atraso{" "}
              <b className="text-red-600">{formatMinutes(status.totals.late_minutes)}</b>
              {status.cutoff_date ? ` · até ${status.cutoff_date.split("-").reverse().join("/")}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <Button
              disabled={busy || (needsReason && reason.trim().length < 5)}
              onClick={() => void run(() => supabase.rpc("oris360_gerar_revisao_ponto", { p_employee_id: employeeId, p_competencia: competenciaIso, p_reason: reason || undefined }), "Revisão gerada")}
            >
              {needsReason ? "Retificar (nova revisão)" : "Gerar revisão"}
            </Button>
          )}
          {canReview && (
            <Button disabled={busy} onClick={() => void run(() => supabase.rpc("oris360_conferir_ponto", { p_employee_id: employeeId, p_competencia: competenciaIso, p_expected_revision: status?.revision_number ?? 0 }), "Revisão conferida")}>
              Conferir
            </Button>
          )}
          {canConsolidate && (
            <Button disabled={busy} onClick={() => void run(() => supabase.rpc("oris360_consolidar_ponto", { p_employee_id: employeeId, p_competencia: competenciaIso, p_expected_revision: status?.revision_number ?? 0 }), "Competência consolidada")}>
              Consolidar
            </Button>
          )}
          {canIssue && (
            <Button disabled={busy} onClick={() => void run(() => supabase.rpc("oris360_emitir_espelho", { p_employee_id: employeeId, p_competencia: competenciaIso }), "Espelho emitido")}>
              Emitir Espelho
            </Button>
          )}
        </div>
      </div>

      {needsReason && (
        <label className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
          Motivo da retificação (obrigatório)
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 rounded-lg border border-ink-900/15 px-3 text-sm text-ink-900" />
        </label>
      )}

      <div className="mt-4 border-t border-forest-950/10 pt-3">
        <button type="button" onClick={() => setShowAdjust((v) => !v)} className="text-sm font-semibold text-forest-800 hover:underline">
          {showAdjust ? "Fechar ajuste de batida" : "Ajustar batida"}
        </button>
        {showAdjust && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Tipo de ajuste
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm text-ink-900">
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Dia
              <input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm text-ink-900" />
            </label>
            {kind !== "ADD_PUNCH" && (
              <label className="flex flex-col gap-1 text-xs text-ink-muted sm:col-span-2">
                Batida do dia
                <select value={punchId} onChange={(e) => setPunchId(e.target.value)} className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm text-ink-900">
                  <option value="">{adjDate ? (selectablePunches.length ? "Selecione..." : "Nenhuma batida disponível neste dia") : "Escolha o dia primeiro"}</option>
                  {selectablePunches.map((p) => (
                    <option key={p.id} value={p.id}>
                      {PUNCH_LABEL[p.type] ?? p.type} · {new Date(p.server_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {p.origin && p.origin !== "BATIDA" ? ` (${p.origin === "AJUSTADA" ? "ajustada" : "adicionada"})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {kind === "ADD_PUNCH" && (
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Tipo da batida
                <select value={adjType} onChange={(e) => setAdjType(e.target.value)} className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm text-ink-900">
                  {Object.entries(PUNCH_LABEL).map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </label>
            )}
            {(kind === "CORRECT_TIME" || kind === "ADD_PUNCH") && (
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Horário correto
                <input type="time" value={adjTime} onChange={(e) => setAdjTime(e.target.value)} className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm text-ink-900" />
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-ink-muted sm:col-span-2">
              Motivo (obrigatório; a batida original é preservada)
              <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="h-10 rounded-lg border border-ink-900/15 px-3 text-sm text-ink-900" />
            </label>
            <div className="sm:col-span-2">
              <Button disabled={busy || adjReason.trim().length < 5} onClick={() => void submitAdjust()}>
                Registrar ajuste
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-forest-950/10 pt-3">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Espelhos emitidos</p>
        {mirrors.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">Nenhum Espelho emitido para esta competência.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {mirrors.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forest-950/10 px-3 py-2 text-sm">
                <span>
                  Versão {m.version} · revisão {m.content.revision.number} · emitido em {new Date(m.issued_at).toLocaleString("pt-BR")}
                  {m.version === mirrors[0].version ? " · atual" : " · substituída"}
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setViewing(viewing?.id === m.id ? null : m)} className="font-semibold text-forest-800 hover:underline">
                    {viewing?.id === m.id ? "Ocultar" : "Ver"}
                  </button>
                  <button
                    type="button"
                    onClick={() => buildEspelhoPdf(m.content).save(`espelho-ponto-${m.content.employee.code}-${m.content.competence.slice(0, 7)}-v${m.version}.pdf`)}
                    className="font-semibold text-forest-800 hover:underline"
                  >
                    Baixar PDF
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {viewing && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-forest-950/10">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-forest-950/10 uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Dia</th>
                  <th className="px-3 py-2">Batidas</th>
                  <th className="px-3 py-2">Trabalhado</th>
                  <th className="px-3 py-2">Extra</th>
                  <th className="px-3 py-2">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {viewing.content.days.map((d) => (
                  <tr key={d.date} className="border-b border-forest-950/5 last:border-none">
                    <td className="px-3 py-2">{d.date.split("-").reverse().join("/")}</td>
                    <td className="px-3 py-2">
                      {d.punches.map((p) => `${PUNCH_LABEL[p.type] ?? p.type} ${p.time}${p.origin !== "BATIDA" ? "*" : ""}`).join(" · ") || "-----"}
                      {d.inconsistency ? <span className="ml-2 font-semibold text-red-600">{d.inconsistency}</span> : null}
                    </td>
                    <td className="px-3 py-2">{formatMinutes(d.worked_minutes)}</td>
                    <td className="px-3 py-2">{d.extra_minutes > 0 ? formatMinutes(d.extra_minutes) : "-"}</td>
                    <td className="px-3 py-2">{d.late_minutes > 0 ? formatMinutes(d.late_minutes) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewing.content.adjustments.length > 0 && (
              <p className="border-t border-forest-950/10 px-3 py-2 text-xs text-ink-muted">
                * horário ajustado ou batida adicionada. {viewing.content.adjustments.length} ajuste(s) registrado(s) na competência.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
