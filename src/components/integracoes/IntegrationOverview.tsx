import type { IntegrationCredential, IntegrationEvent } from "@/types/integrations";
import { deriveEnvironmentState } from "./status";

type Tone = "ok" | "pending" | "error" | "off";

interface OverviewItem {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  anchor: string;
}

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  off: "bg-forest-950/5 text-ink-muted",
};

const TONE_LABEL: Record<Tone, string> = {
  ok: "OK",
  pending: "Pendente",
  error: "Erro",
  off: "Indisponível",
};

function buildItems(credentials: IntegrationCredential[], events: IntegrationEvent[]): OverviewItem[] {
  const asaas = credentials.filter((c) => c.provider === "ASAAS");
  const active = asaas.find((c) => c.isActive) ?? null;
  const hasAsaasEvents = events.some((e) => e.provider === "ASAAS" && e.environment !== null);

  function describeEnvironmentPair(rows: IntegrationCredential[], providerLabel: string): { detail: string; tone: Tone } {
    const sandboxState = deriveEnvironmentState(rows.find((c) => c.environment === "SANDBOX") ?? null);
    const producaoState = deriveEnvironmentState(rows.find((c) => c.environment === "PRODUCAO") ?? null);
    if (sandboxState === "ATIVO") return { detail: "Sandbox ativo e validado", tone: "ok" };
    if (producaoState === "ATIVO") return { detail: "Produção ativa e validada", tone: "ok" };
    if (sandboxState === "ERRO_CREDENCIAL" || producaoState === "ERRO_CREDENCIAL") {
      return { detail: `Chave recusada pelo ${providerLabel}. Substitua a chave.`, tone: "error" };
    }
    const configurados: string[] = [];
    if (sandboxState === "CONEXAO_VALIDA") configurados.push("Sandbox configurado");
    if (producaoState === "CONEXAO_VALIDA") configurados.push("Produção configurada");
    if (configurados.length > 0) return { detail: `${configurados.join(" · ")} — nenhum ambiente ativo`, tone: "pending" };
    if (sandboxState === "CHAVE_SALVA" || producaoState === "CHAVE_SALVA") {
      return { detail: "Chave salva, falta testar a conexão", tone: "pending" };
    }
    return { detail: "Ainda não configurado", tone: "pending" };
  }

  const paymentsInfo = describeEnvironmentPair(asaas, "Asaas");
  const payments: OverviewItem = {
    id: "payments",
    title: "Pagamentos · Asaas",
    detail: paymentsInfo.detail,
    tone: paymentsInfo.tone,
    anchor: "#pagamentos",
  };

  const base = credentials.filter((c) => c.provider === "BASE");
  const baseInfo = describeEnvironmentPair(base, "Base");
  const productInvoiceInfo: { detail: string; tone: Tone } =
    base.some((c) => c.isActive) ? { detail: baseInfo.detail + " — falta ligar ao Faturar", tone: "pending" } : baseInfo;

  const serviceInvoice: OverviewItem = active
    ? {
        id: "nfse",
        title: "NFS-e de Serviço",
        detail: "Usa o Asaas ativo. Confirme a configuração fiscal no painel Asaas.",
        tone: "pending",
        anchor: "#fiscal",
      }
    : {
        id: "nfse",
        title: "NFS-e de Serviço",
        detail: "Depende de um ambiente Asaas ativo",
        tone: "off",
        anchor: "#fiscal",
      };

  const productInvoice: OverviewItem = {
    id: "nfe",
    title: "NF-e de Produto",
    detail: productInvoiceInfo.detail,
    tone: productInvoiceInfo.tone,
    anchor: "#fiscal",
  };

  const webhook: OverviewItem = active
    ? {
        id: "webhook",
        title: "Webhook de pagamentos",
        detail: hasAsaasEvents ? "Recebendo eventos do Asaas" : "Aguardando o primeiro evento do Asaas",
        tone: hasAsaasEvents ? "ok" : "pending",
        anchor: "#webhooks",
      }
    : {
        id: "webhook",
        title: "Webhook de pagamentos",
        detail: "Só recebe eventos com um ambiente ativo",
        tone: "off",
        anchor: "#webhooks",
      };

  return [payments, serviceInvoice, productInvoice, webhook];
}

interface IntegrationOverviewProps {
  credentials: IntegrationCredential[];
  events: IntegrationEvent[];
}

export function IntegrationOverview({ credentials, events }: IntegrationOverviewProps) {
  const items = buildItems(credentials, events);

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-forest-950 p-5 text-cream-50 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">Visão geral</h2>
        <p className="text-sm text-cream-50/70">Acompanhe o estado das integrações necessárias para cobrança e emissão fiscal.</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <a href={item.anchor} className="flex h-full flex-col gap-2 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition-colors hover:bg-white/10">
              <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[item.tone]}`}>{TONE_LABEL[item.tone]}</span>
              <span className="font-semibold">{item.title}</span>
              <span className="text-xs text-cream-50/70">{item.detail}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
