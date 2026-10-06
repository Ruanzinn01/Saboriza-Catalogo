import type { IntegrationCredential, IntegrationEvent } from "@/types/integrations";

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
  const withError = asaas.find((c) => c.status === "ERRO") ?? null;
  const hasAsaasEvents = events.some((e) => e.environment !== null);

  const payments: OverviewItem = active
    ? {
        id: "payments",
        title: "Pagamentos · Asaas",
        detail: `${active.environment === "PRODUCAO" ? "Produção" : "Sandbox"} ativo e validado`,
        tone: "ok",
        anchor: "#pagamentos",
      }
    : withError
      ? {
          id: "payments",
          title: "Pagamentos · Asaas",
          detail: "Chave recusada pelo Asaas. Substitua a chave.",
          tone: "error",
          anchor: "#pagamentos",
        }
      : {
          id: "payments",
          title: "Pagamentos · Asaas",
          detail: asaas.length > 0 ? "Nenhum ambiente ativo. O Faturar não cria cobranças." : "Ainda não configurado",
          tone: "pending",
          anchor: "#pagamentos",
        };

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
    detail: "Integração ainda não disponível no Saboriza",
    tone: "off",
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
  const pending = items.filter((i) => i.tone === "pending" || i.tone === "error").length;

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-forest-950 p-5 text-cream-50 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">Visão geral</h2>
        <p className="text-sm text-cream-50/70">
          {pending === 0 ? "Nenhuma pendência" : `${pending} ${pending === 1 ? "pendência" : "pendências"} para o faturamento fiscal e de cobrança`}
        </p>
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
