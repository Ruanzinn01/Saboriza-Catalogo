import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { useInventoryStore } from "@/store/inventory-store";
import type { InventoryScope } from "@/types/inventory";

interface InventoryStartSheetProps {
  open: boolean;
  onClose: () => void;
}

interface UnitOption {
  id: string;
  name: string;
}

const SCOPE_OPTIONS: { key: InventoryScope; label: string }[] = [
  { key: "ALL", label: "Tudo" },
  { key: "PRODUCTS", label: "Produtos" },
  { key: "RAW_MATERIALS", label: "Matérias-primas" },
];

const fieldClass = "min-h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700";

function toLocalInput(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function InventoryStartSheet({ open, onClose }: InventoryStartSheetProps) {
  const createSession = useInventoryStore((state) => state.createSession);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [modality, setModality] = useState<"EXTRAORDINARY" | "SCHEDULED">("EXTRAORDINARY");
  const [scope, setScope] = useState<InventoryScope>("ALL");
  const [locationLabel, setLocationLabel] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 48 * 3600 * 1000)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || units.length > 0) return;
    void (async () => {
      const companyId = await resolveCurrentCompanyId();
      if (!companyId) return;
      const { data } = await supabase.from("units").select("id, name").eq("company_id", companyId).eq("status", "ACTIVE").order("name");
      const options = (data ?? []).map((unit) => ({ id: unit.id, name: unit.name }));
      setUnits(options);
      if (options.length > 0) setUnitId((current) => current || options[0].id);
    })();
  }, [open, units.length]);

  const needsReason = modality === "EXTRAORDINARY";
  const canSubmit = !saving && unitId !== "" && (!needsReason || reason.trim() !== "") && endsAt !== "" && (modality === "EXTRAORDINARY" || startsAt !== "");

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const start = modality === "EXTRAORDINARY" ? new Date() : new Date(startsAt);
    const message = await createSession({
      unitId,
      modality,
      scopeKind: scope,
      startsAt: start.toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      reason: reason.trim(),
      locationLabel: locationLabel.trim(),
    });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    toast.success(modality === "EXTRAORDINARY" ? "Inventário iniciado" : "Inventário programado");
    setReason("");
    setLocationLabel("");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Iniciar inventário"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <Button disabled={!canSubmit} className="w-full" onClick={() => void handleSubmit()}>
            {saving ? "Confirmando..." : modality === "EXTRAORDINARY" ? "Iniciar inventário agora" : "Programar inventário"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 rounded-2xl bg-ink-900/5 p-1">
          {(
            [
              { key: "EXTRAORDINARY", label: "Iniciar agora" },
              { key: "SCHEDULED", label: "Programar" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setModality(option.key)}
              className={cn(
                "min-h-11 flex-1 rounded-xl text-sm font-bold transition-colors",
                modality === option.key ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted hover:text-ink-900"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Unidade
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={fieldClass}>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Local físico
          <input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Ex.: Depósito principal" className={fieldClass} />
        </label>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Escopo</p>
          <div className="flex gap-2">
            {SCOPE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setScope(option.key)}
                className={cn(
                  "min-h-11 flex-1 rounded-xl border px-2 text-sm font-bold transition-colors",
                  scope === option.key ? "border-forest-700 bg-forest-950/10 text-forest-950" : "border-ink-900/15 text-ink-muted"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {modality === "SCHEDULED" && (
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            Início
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldClass} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Término
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldClass} />
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Motivo {needsReason ? "(obrigatório)" : "(opcional)"}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Por que este inventário está sendo feito?"
            className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm normal-case tracking-normal text-ink-900 outline-none focus:border-forest-700"
          />
        </label>
      </div>
    </Sheet>
  );
}
