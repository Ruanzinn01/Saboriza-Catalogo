import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { useIntegrationsStore } from "@/store/integrations-store";
import type { IntegrationCredential, IntegrationEnvironment, IntegrationEvent, IntegrationProvider } from "@/types/integrations";
import { ConfirmDialog } from "./ConfirmDialog";

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`;

const ENVIRONMENT_LABEL: Record<IntegrationEnvironment, string> = {
  SANDBOX: "Sandbox",
  PRODUCAO: "Produção",
};

function eventResult(event: IntegrationEvent): { label: string; tone: string } {
  if (event.processError?.startsWith("IGNORADO")) return { label: "Ignorado (ambiente inativo)", tone: "text-ink-muted" };
  if (event.processError) return { label: `Erro: ${event.processError}`, tone: "text-red-700" };
  if (event.processedAt) return { label: "Processado", tone: "text-emerald-700" };
  return { label: "Pendente", tone: "text-amber-700" };
}

async function copyToClipboard(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie manualmente.");
  }
}

interface WebhookPanelProps {
  companyId: string;
  provider: IntegrationProvider;
  providerName: string;
  functionSlug: string;
  description: string;
  credentials: IntegrationCredential[];
  events: IntegrationEvent[];
  canManage: boolean;
}

export function WebhookPanel({ companyId, provider, providerName, functionSlug, description, credentials, events, canManage }: WebhookPanelProps) {
  const getWebhookToken = useIntegrationsStore((s) => s.getWebhookToken);
  const rotateWebhookToken = useIntegrationsStore((s) => s.rotateWebhookToken);
  const [rotating, setRotating] = useState<IntegrationEnvironment | null>(null);
  const [busy, setBusy] = useState(false);

  const endpoint = `${SUPABASE_FUNCTIONS_URL}/${functionSlug}?company=${companyId}`;
  const providerCredentials = credentials.filter((c) => c.provider === provider);
  const providerEvents = events.filter((e) => e.provider === provider && e.environment !== null);
  const lastEvent = providerEvents[0];

  async function handleCopyToken(environment: IntegrationEnvironment) {
    const token = await getWebhookToken(provider, environment);
    if (token) await copyToClipboard(token, `Token copiado. Cole em 'Token de autenticação' no webhook do ${providerName}.`);
  }

  async function handleRotate() {
    if (!rotating) return;
    setBusy(true);
    await rotateWebhookToken(provider, rotating);
    setBusy(false);
    setRotating(null);
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-forest-950/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-forest-950">Webhook — {providerName}</h3>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${lastEvent ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {lastEvent ? "Recebendo eventos" : "Aguardando o primeiro evento"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink-900">Endereço (URL) do webhook</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-forest-950/5 px-3 py-2 font-mono text-xs">{endpoint}</code>
          <Button size="sm" variant="outline" onClick={() => void copyToClipboard(endpoint, "URL copiada")}>
            Copiar URL
          </Button>
        </div>
        <p className="text-xs text-ink-muted">A mesma URL serve para Sandbox e Produção. Cada ambiente tem um token próprio, e é o token que diz de qual ambiente veio o evento.</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink-900">Token de autenticação, por ambiente</p>
        {providerCredentials.length === 0 && <p className="text-xs text-ink-muted">Salve uma chave de API para gerar o token deste ambiente.</p>}
        {providerCredentials.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forest-950/10 px-3 py-2">
            <span className="text-sm font-semibold">{ENVIRONMENT_LABEL[c.environment]}</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!canManage || !c.hasWebhookToken} onClick={() => void handleCopyToken(c.environment)}>
                Copiar token
              </Button>
              <Button size="sm" variant="ghost" disabled={!canManage || !c.hasWebhookToken} onClick={() => setRotating(c.environment)}>
                Gerar novo token
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink-900">Últimos eventos recebidos</p>
        {providerEvents.length === 0 ? (
          <p className="text-xs text-ink-muted">Nenhum evento ainda. Ele aparece aqui assim que o {providerName} enviar o primeiro aviso.</p>
        ) : (
          <ul className="divide-y divide-forest-950/10 rounded-xl border border-forest-950/10">
            {providerEvents.slice(0, 8).map((e) => {
              const result = eventResult(e);
              return (
                <li key={e.id} className="grid grid-cols-1 gap-1 px-3 py-2 text-xs sm:grid-cols-[150px_1fr_auto] sm:items-center">
                  <span className="text-ink-muted">{new Date(e.receivedAt).toLocaleString("pt-BR")}</span>
                  <span className="font-mono">
                    {e.eventType} · {e.environment ? ENVIRONMENT_LABEL[e.environment] : "—"}
                  </span>
                  <span className={result.tone}>{result.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={rotating !== null}
        title="Gerar novo token?"
        danger
        description={
          <p>
            O token atual de {rotating ? ENVIRONMENT_LABEL[rotating] : ""} deixa de funcionar na hora. Eventos do {providerName} vão falhar até você colar o novo token no painel do {providerName}.
          </p>
        }
        confirmLabel="Gerar novo token"
        busy={busy}
        onConfirm={() => void handleRotate()}
        onCancel={() => setRotating(null)}
      />
    </div>
  );
}
