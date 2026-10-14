import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/admin/estoque/EstoquePrimitives";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { useEstoqueStore } from "@/store/estoque-store";
import type { StockPolicyRow } from "@/types/estoque";

const fieldCls = "min-h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";
const SCOPE_LABEL: Record<StockPolicyRow["scope"], string> = { ALL: "Todos os itens", PRODUCT: "Produtos", RAW_MATERIAL: "Matérias-primas" };

export function EstoquePoliticas() {
  const position = useEstoqueStore((s) => s.position);
  const policies = useEstoqueStore((s) => s.policies);
  const fetchPolicies = useEstoqueStore((s) => s.fetchPolicies);
  const fetchPosition = useEstoqueStore((s) => s.fetchPosition);
  const savePolicy = useEstoqueStore((s) => s.savePolicy);

  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [unitId, setUnitId] = useState("");
  const [scope, setScope] = useState<StockPolicyRow["scope"]>("ALL");
  const [minDays, setMinDays] = useState("");
  const [idealDays, setIdealDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [why, setWhy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPolicies();
    if (position.length === 0) void fetchPosition();
    void (async () => {
      const companyId = await resolveCurrentCompanyId();
      if (!companyId) return;
      const { data } = await supabase.from("units").select("id, name").eq("company_id", companyId).eq("status", "ACTIVE").order("name");
      const list = (data ?? []).map((unit) => ({ id: unit.id, name: unit.name }));
      setUnits(list);
      setUnitId((current) => current || list[0]?.id || "");
    })();
  }, [fetchPolicies, fetchPosition, position.length]);

  const current = position[0] ? { min: position[0].policyMin, ideal: position[0].policyIdeal, max: position[0].policyMax } : { min: 30, ideal: 45, max: 60 };

  useEffect(() => {
    setMinDays((value) => value || String(current.min));
    setIdealDays((value) => value || String(current.ideal));
    setMaxDays((value) => value || String(current.max));
  }, [current.min, current.ideal, current.max]);

  const min = Number(minDays);
  const ideal = Number(idealDays);
  const max = Number(maxDays);
  const valid = min > 0 && min < ideal && ideal < max;

  async function handleSave() {
    if (!valid) {
      setError("Informe 0 < mínimo < ideal < máximo.");
      return;
    }
    if (why.trim() === "") {
      setError("Informe a justificativa da alteração.");
      return;
    }
    setSaving(true);
    setError(null);
    const message = await savePolicy({ unitId, scope, minDays: min, idealDays: ideal, maxDays: max, justification: why.trim() });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setWhy("");
    toast.success("Política aplicada às projeções atuais. Fechamentos anteriores não são recalculados.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Política de cobertura">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm text-ink-700">Parâmetros da unidade. Mudanças afetam somente as projeções atuais; cada alteração fica registrada com autor, data e justificativa.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-bold">
                Unidade
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={fieldCls}>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold">
                Aplica-se a
                <select value={scope} onChange={(e) => setScope(e.target.value as StockPolicyRow["scope"])} className={fieldCls}>
                  {(Object.keys(SCOPE_LABEL) as StockPolicyRow["scope"][]).map((key) => (
                    <option key={key} value={key}>{SCOPE_LABEL[key]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs font-bold">Mínimo (dias)<input type="number" min={1} value={minDays} onChange={(e) => setMinDays(e.target.value)} className={fieldCls} /></label>
              <label className="flex flex-col gap-1 text-xs font-bold">Ideal (dias)<input type="number" min={1} value={idealDays} onChange={(e) => setIdealDays(e.target.value)} className={fieldCls} /></label>
              <label className="flex flex-col gap-1 text-xs font-bold">Máximo (dias)<input type="number" min={1} value={maxDays} onChange={(e) => setMaxDays(e.target.value)} className={fieldCls} /></label>
            </div>
            {!valid && (minDays !== "" || idealDays !== "" || maxDays !== "") && <p className="text-xs font-semibold text-amber-800">Use 0 &lt; mínimo &lt; ideal &lt; máximo.</p>}
            <label className="flex flex-col gap-1 text-xs font-bold">
              Motivo da alteração
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3} className="rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm font-normal text-ink-900 outline-none focus:border-forest-700" />
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
            <Button disabled={saving || unitId === ""} onClick={() => void handleSave()}>{saving ? "Aplicando..." : "Aplicar política"}</Button>
          </div>
        </Card>

        <Card title="Critérios sem ambiguidade">
          <div className="flex flex-col gap-1.5 p-4 text-sm">
            <p><b>Zerado:</b> saldo físico igual a zero.</p>
            <p><b>Crítico:</b> cobertura disponível menor que metade do mínimo.</p>
            <p><b>Baixo:</b> da metade do mínimo até abaixo do mínimo.</p>
            <p><b>Saudável:</b> do mínimo até o ideal, inclusive.</p>
            <p><b>Acima do ideal:</b> acima do ideal até o máximo.</p>
            <p><b>Excesso:</b> acima do máximo.</p>
            <p className="mt-1 rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
              Classifica com a precisão completa e arredonda só a exibição. Sem média válida, exibe “Sem histórico” ou “Sem consumo recente”. Cobertura = disponível ÷ demanda média; disponível = físico − reservado.
            </p>
          </div>
        </Card>
      </div>

      <Card title="Histórico de alterações">
        {policies.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Nenhuma alteração registrada: vale a política padrão de {formatNumber(current.min)} / {formatNumber(current.ideal)} / {formatNumber(current.max)} dias.</p>
        ) : (
          <div className="flex flex-col">
            {policies.map((policy) => (
              <div key={policy.id} className="border-b border-forest-950/10 px-4 py-3 text-sm last:border-none">
                <b>{SCOPE_LABEL[policy.scope]}</b> · {formatNumber(policy.minDays)} / {formatNumber(policy.idealDays)} / {formatNumber(policy.maxDays)} dias
                <small className="block text-xs text-ink-muted">{policy.justification} · {formatDateTime(policy.createdAt)}</small>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
