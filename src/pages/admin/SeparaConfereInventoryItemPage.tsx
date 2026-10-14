import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ImageOff } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatQuantity, sessionLabel } from "@/lib/inventory";
import { inventoryListPath, useSeparaBase } from "@/lib/separa-base";
import { useInventoryStore } from "@/store/inventory-store";
import type { InventoryCountResult, InventoryCountSession } from "@/types/inventory";

type UnitMode = "BASE" | "PACK";

function parseQuantity(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "" || !/^\d*\.?\d+$|^\d+\.$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function SeparaConfereInventoryItemPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const LIST_PATH = inventoryListPath(useSeparaBase());
  const beginCount = useInventoryStore((state) => state.beginCount);
  const releaseItem = useInventoryStore((state) => state.releaseItem);
  const registerCount = useInventoryStore((state) => state.registerCount);
  const sessions = useInventoryStore((state) => state.sessions);
  const selectedSessionId = useInventoryStore((state) => state.selectedSessionId);
  const session = sessions.find((candidate) => candidate.id === selectedSessionId) ?? null;

  const [detail, setDetail] = useState<InventoryCountSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unitMode, setUnitMode] = useState<UnitMode>("BASE");
  const [zeroPrompt, setZeroPrompt] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [needsNewSnapshot, setNeedsNewSnapshot] = useState(false);
  const [result, setResult] = useState<InventoryCountResult | null>(null);

  const commandId = useRef<string>(crypto.randomUUID());
  const registered = useRef(false);
  const submitLock = useRef(false);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoadError(null);
    setDetail(null);
    const { data, error } = await beginCount(itemId);
    if (error || !data) {
      setLoadError(error ?? "Item não encontrado");
      return;
    }
    commandId.current = crypto.randomUUID();
    setDetail(data);
    setNeedsNewSnapshot(false);
  }, [itemId, beginCount]);

  useEffect(() => {
    void load();
    return () => {
      if (itemId && !registered.current) void releaseItem(itemId);
    };
  }, [itemId, load, releaseItem]);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => navigate(LIST_PATH, { replace: true }), 3500);
    return () => window.clearTimeout(timer);
  }, [result, navigate]);

  const dirty = quantity.trim() !== "" && !result;

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function guardLeave(event: React.MouseEvent) {
    if (!dirty) return;
    if ((event.target as HTMLElement).closest("a")) {
      event.preventDefault();
      event.stopPropagation();
      setLeavePrompt(true);
    }
  }

  const parsed = parseQuantity(quantity);
  const factor = unitMode === "PACK" && detail?.packFactor ? detail.packFactor : 1;
  const unitLabel = unitMode === "PACK" ? "packs" : (detail?.baseUnit ?? "");
  const mustBeInteger = unitMode === "PACK" || (detail !== null && !detail.divisible);

  let validation: string | null = null;
  if (quantity.trim() !== "") {
    if (parsed === null) validation = "Informe um número válido.";
    else if (mustBeInteger && !Number.isInteger(parsed)) validation = "Esta unidade só aceita quantidade inteira.";
    else if (Math.round(parsed * 1000) / 1000 !== parsed) validation = "No máximo 3 casas decimais.";
  }
  const canRegister = !submitting && !needsNewSnapshot && parsed !== null && parsed > 0 && validation === null && detail !== null;

  async function submit(value: number, zeroConfirmed: boolean) {
    if (!detail || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const { data, error } = await registerCount({
      commandId: commandId.current,
      token: detail.token,
      quantity: value,
      unitMode,
      zeroConfirmed,
    });
    setSubmitting(false);
    submitLock.current = false;
    if (error || !data) {
      const message = error ?? "Não foi possível registrar a contagem.";
      if (message.includes("MOVIMENTACAO_DURANTE_CONTAGEM")) {
        setNeedsNewSnapshot(true);
        setSubmitError("Movimentação durante a contagem. Confira novamente e gere uma nova fotografia para confirmar.");
      } else {
        setSubmitError(message);
      }
      return;
    }
    registered.current = true;
    setZeroPrompt(false);
    setResult(data);
  }

  const currentFactorNote =
    detail?.packFactor && unitMode === "PACK" && parsed !== null && parsed > 0
      ? `${formatQuantity(parsed)} packs = ${formatQuantity(parsed * factor)} ${detail.baseUnit}`
      : null;

  if (loadError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Inventário" back={{ to: LIST_PATH, label: "Voltar" }} />
        <AdminState variant="error" message={loadError} onRetry={() => void load()} />
      </div>
    );
  }

  if (!detail) {
    return <AdminState variant="loading" message="Carregando item..." />;
  }

  if (result) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={detail.name} description="Contagem registrada" />
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-forest-950/10 bg-white p-8 text-center">
          <CheckCircle2 size={36} className="text-forest-700" />
          <p className="text-lg font-extrabold text-forest-950">Contagem registrada</p>
          <p className="text-sm text-ink-700">
            Contado: <strong>{formatQuantity(result.baseQuantity)}</strong> {detail.baseUnit} · Saldo fotografado:{" "}
            <strong>{formatQuantity(result.expectedBalance)}</strong> ·{" "}
            <strong className={result.difference === 0 ? "text-forest-950" : "text-red-700"}>
              Diferença {result.difference > 0 ? "+" : ""}
              {formatQuantity(result.difference)}
            </strong>
          </p>
          <p className="text-xs text-ink-muted">Esta contagem não altera o saldo. O ajuste, se houver, é decidido no Estoque.</p>
          <Button variant="outline" onClick={() => navigate(LIST_PATH, { replace: true })}>
            Voltar à lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" onClickCapture={guardLeave}>
      <PageHeader
        title={detail.name}
        description={session ? `${sessionLabel(session)}${session.locationLabel ? ` · ${session.locationLabel}` : ""}` : "Inventário"}
        back={{ to: LIST_PATH, label: "Voltar" }}
      />

      {leavePrompt && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">A quantidade informada ainda não foi registrada. Sair descarta o que foi digitado.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLeavePrompt(false)}>
              Continuar contando
            </Button>
            <Button size="sm" onClick={() => navigate(LIST_PATH)}>
              Sair mesmo assim
            </Button>
          </div>
        </div>
      )}

      {detail.imageUrl ? (
        <img src={detail.imageUrl} alt={detail.name} className="max-h-[50vh] w-full rounded-2xl bg-ink-900/5 object-contain" />
      ) : (
        <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-ink-900/5 text-ink-muted">
          <ImageOff size={28} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">{[detail.presentation, detail.kindLabel].filter(Boolean).join(" · ")}</p>
        {detail.sku && <p className="font-mono text-xs text-ink-muted">{detail.sku}</p>}
        {detail.packLabel && <p className="text-xs text-ink-muted">Cadastro: {detail.packLabel}</p>}
        <p className="mt-2 text-sm font-semibold text-ink-900">Quantidade física encontrada</p>
        <p className="text-xs text-ink-muted">Conte o que está no local, na unidade abaixo. O saldo do sistema não é exibido antes da confirmação.</p>
      </div>

      {detail.packFactor && (
        <div className="flex gap-2 rounded-2xl bg-ink-900/5 p-1">
          {(
            [
              { key: "BASE", label: `Em ${detail.baseUnit}` },
              { key: "PACK", label: "Em packs" },
            ] as { key: UnitMode; label: string }[]
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setUnitMode(option.key)}
              className={cn(
                "min-h-11 flex-1 rounded-xl text-sm font-bold transition-colors",
                unitMode === option.key ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted hover:text-ink-900"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setZeroPrompt(false);
            }}
            inputMode={mustBeInteger ? "numeric" : "decimal"}
            placeholder="0"
            aria-label="Quantidade física encontrada"
            className="min-h-14 w-full rounded-2xl border border-ink-900/15 bg-white px-4 text-2xl font-extrabold text-forest-950 outline-none focus:border-forest-700"
          />
          <span className="shrink-0 text-sm font-bold text-ink-muted">{unitLabel}</span>
        </div>
        {validation && <p role="alert" className="text-sm font-semibold text-red-600">{validation}</p>}
        {currentFactorNote && <p className="text-sm font-semibold text-forest-950">{currentFactorNote}</p>}
        {!currentFactorNote && parsed !== null && parsed > 0 && validation === null && (
          <p className="text-sm font-semibold text-forest-950">
            {formatQuantity(parsed)} {detail.baseUnit}
          </p>
        )}
      </div>

      {submitError && <p role="alert" className="text-sm font-semibold text-red-600">{submitError}</p>}

      {zeroPrompt && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">Confirma que este item não foi encontrado no local? Será registrado como zero.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setZeroPrompt(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={submitting} onClick={() => void submit(0, true)}>
              {submitting ? "Registrando..." : "Sim, não encontrei"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {needsNewSnapshot ? (
          <Button className="w-full" onClick={() => void load()}>
            Gerar nova fotografia
          </Button>
        ) : (
          <>
            <Button className="w-full" disabled={!canRegister} onClick={() => parsed !== null && void submit(parsed, false)}>
              {submitting ? "Registrando..." : "Registrar contagem"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={submitting}
              onClick={() => {
                setQuantity("");
                setZeroPrompt(true);
              }}
            >
              Confirmar zerado
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
