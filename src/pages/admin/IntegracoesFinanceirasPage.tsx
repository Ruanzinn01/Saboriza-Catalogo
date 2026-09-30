import { useEffect, useMemo, useState } from "react";
import { useIntegrationsStore } from "@/store/integrations-store";
import type { IntegrationCredential, IntegrationEnvironment, IntegrationProvider } from "@/types/integrations";
import { Button } from "@/components/ui/Button";

const STATUS_LABEL: Record<IntegrationCredential["status"], string> = {
  NAO_CONFIGURADO: "Não configurado",
  CONFIGURADO: "Configurado — aguardando integração real",
  VALIDADO: "Validado",
  ERRO: "Erro",
};

const STATUS_COLOR: Record<IntegrationCredential["status"], string> = {
  NAO_CONFIGURADO: "bg-forest-950/5 text-ink-muted",
  CONFIGURADO: "bg-amber-100 text-amber-700",
  VALIDADO: "bg-emerald-100 text-emerald-700",
  ERRO: "bg-red-100 text-red-700",
};

function CredentialCard({
  title,
  subtitle,
  provider,
  environment,
  existing,
  showWallet,
  showFiscalProviderName,
}: {
  title: string;
  subtitle: string;
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
  existing: IntegrationCredential | null;
  showWallet?: boolean;
  showFiscalProviderName?: boolean;
}) {
  const saveCredential = useIntegrationsStore((s) => s.saveCredential);
  const removeCredential = useIntegrationsStore((s) => s.removeCredential);
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [walletId, setWalletId] = useState(existing?.walletId ?? "");
  const [fiscalProviderName, setFiscalProviderName] = useState(existing?.fiscalProviderName ?? "");
  const [saving, setSaving] = useState(false);

  const status = existing?.status ?? "NAO_CONFIGURADO";

  async function handleSave() {
    setSaving(true);
    const ok = await saveCredential(provider, environment, apiKey, showWallet ? walletId : null, showFiscalProviderName ? fiscalProviderName : null);
    setSaving(false);
    if (ok) {
      setApiKey("");
      setEditing(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    await removeCredential(provider, environment);
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-forest-950/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-forest-950">{title}</h3>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
      </div>

      {existing && !editing && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-forest-950/5 px-4 py-3">
          <div className="text-sm">
            <span className="font-mono">•••• {existing.keyLast4}</span>
            {existing.walletId && <span className="ml-3 text-ink-muted">wallet: {existing.walletId}</span>}
            {existing.fiscalProviderName && <span className="ml-3 text-ink-muted">{existing.fiscalProviderName}</span>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Atualizar chave
            </Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => void handleRemove()}>
              Remover
            </Button>
          </div>
        </div>
      )}

      {(!existing || editing) && (
        <div className="mt-3 flex flex-col gap-2">
          {showFiscalProviderName && (
            <div>
              <label className="mb-1 block text-xs font-bold">Provedor de emissão fiscal</label>
              <input
                value={fiscalProviderName}
                onChange={(e) => setFiscalProviderName(e.target.value)}
                placeholder="Ex: Focus NFe, eNotas, PlugNotas"
                className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-bold">{showFiscalProviderName ? "Token de acesso" : "Chave de API"}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={existing ? "Nova chave (substitui a atual)" : "Cole a chave aqui"}
              className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm"
            />
          </div>
          {showWallet && (
            <div>
              <label className="mb-1 block text-xs font-bold">Wallet ID (opcional)</label>
              <input
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                placeholder="Wallet ID do Asaas"
                className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="mt-1 flex gap-2">
            <Button size="sm" disabled={saving || apiKey.trim().length < 8} onClick={() => void handleSave()}>
              {saving ? "Salvando..." : "Salvar credencial"}
            </Button>
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IntegracoesFinanceirasPage() {
  const credentials = useIntegrationsStore((s) => s.credentials);
  const fetchAll = useIntegrationsStore((s) => s.fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const byKey = useMemo(() => {
    const map = new Map<string, IntegrationCredential>();
    credentials.forEach((c) => map.set(`${c.provider}:${c.environment}`, c));
    return map;
  }, [credentials]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Integrações Financeiras</h1>
        <p className="text-sm text-ink-muted">
          Cada empresa cadastra a própria conta — a Saboriza e cada franquia futura usam credenciais separadas. A chave fica
          criptografada no Supabase Vault, nunca em texto puro. Salvar aqui deixa tudo pronto; a chamada real pra API do
          Asaas e do emissor fiscal ainda não está ligada — isso é a próxima etapa, fora deste escopo.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Asaas (Fase 5 — cobrança)</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CredentialCard
            title="Asaas · Sandbox"
            subtitle="Ambiente de testes"
            provider="ASAAS"
            environment="SANDBOX"
            existing={byKey.get("ASAAS:SANDBOX") ?? null}
            showWallet
          />
          <CredentialCard
            title="Asaas · Produção"
            subtitle="Ambiente real — cobranças de verdade"
            provider="ASAAS"
            environment="PRODUCAO"
            existing={byKey.get("ASAAS:PRODUCAO") ?? null}
            showWallet
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Emissão Fiscal (Fase 6 — NFe/NFC-e)</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CredentialCard
            title="Emissão Fiscal · Sandbox"
            subtitle="Ambiente de testes"
            provider="FISCAL"
            environment="SANDBOX"
            existing={byKey.get("FISCAL:SANDBOX") ?? null}
            showFiscalProviderName
          />
          <CredentialCard
            title="Emissão Fiscal · Produção"
            subtitle="Ambiente real — notas fiscais de verdade"
            provider="FISCAL"
            environment="PRODUCAO"
            existing={byKey.get("FISCAL:PRODUCAO") ?? null}
            showFiscalProviderName
          />
        </div>
      </div>
    </div>
  );
}
