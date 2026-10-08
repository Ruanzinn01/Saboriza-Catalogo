import type { IntegrationCredential, IntegrationEvent, IntegrationProvider } from "@/types/integrations";

type Severity = "acao" | "limitacao";

interface Pendency {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  anchor: string;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  acao: "Ação sua",
  limitacao: "Limitação do sistema",
};

const SEVERITY_TONE: Record<Severity, string> = {
  acao: "bg-amber-100 text-amber-700",
  limitacao: "bg-red-100 text-red-700",
};

const KNOWN_LIMITATIONS: Pendency[] = [
  {
    id: "agendamento",
    title: "Agendamento de pagamento pelo Asaas ainda não disponível",
    detail: "O Saboriza não envia agendamentos de pagamentos ao Asaas. A data de vencimento/pagamento registrada nas despesas continua sendo uma informação interna do sistema.",
    severity: "limitacao",
    anchor: "#pagamentos",
  },
  {
    id: "nfe-produto-faturar",
    title: "NF-e de Produto ainda não tem botão no Faturar",
    detail: "A conexão com o Base (credencial, emissão, webhook) já funciona. Falta só a opção de escolher \"NF-e de Produto\" na tela de faturar um pedido — hoje isso só é testável diretamente.",
    severity: "limitacao",
    anchor: "#fiscal",
  },
  {
    id: "certificado",
    title: "Certificado digital não é tratado pelo Saboriza",
    detail: "Depende do tipo de documento fiscal, do município e do provedor utilizado. O Saboriza não armazena nem manipula certificado digital.",
    severity: "limitacao",
    anchor: "#fiscal",
  },
];

interface ProviderPendencyConfig {
  provider: IntegrationProvider;
  providerLabel: string;
  anchor: string;
  noKeyTitle: string;
  noKeyDetail: string;
  noActiveTitle: string;
  noActiveDetail: string;
}

const PROVIDER_CONFIGS: ProviderPendencyConfig[] = [
  {
    provider: "ASAAS",
    providerLabel: "Asaas",
    anchor: "#pagamentos",
    noKeyTitle: "Cadastrar a chave de API do Asaas",
    noKeyDetail: "Sem chave cadastrada, o Faturar não cria cobrança nem nota.",
    noActiveTitle: "Nenhum ambiente Asaas ativo",
    noActiveDetail: "O Faturar não cria cobranças até um ambiente validado ser ativado.",
  },
  {
    provider: "BASE",
    providerLabel: "Base",
    anchor: "#fiscal",
    noKeyTitle: "Cadastrar a chave de API do Base",
    noKeyDetail: "Sem chave cadastrada, não é possível emitir NF-e de produto.",
    noActiveTitle: "Nenhum ambiente Base ativo",
    noActiveDetail: "A emissão de NF-e de produto não funciona até um ambiente validado ser ativado.",
  },
];

function buildProviderPendencies(config: ProviderPendencyConfig, credentials: IntegrationCredential[], events: IntegrationEvent[]): Pendency[] {
  const rows = credentials.filter((c) => c.provider === config.provider);
  const active = rows.find((c) => c.isActive) ?? null;
  const pending: Pendency[] = [];

  if (rows.length === 0) {
    pending.push({ id: `${config.provider}-sem-chave`, title: config.noKeyTitle, detail: config.noKeyDetail, severity: "acao", anchor: config.anchor });
  }

  for (const c of rows) {
    const env = c.environment === "PRODUCAO" ? "Produção" : "Sandbox";
    if (c.status === "ERRO") {
      pending.push({
        id: `${config.provider}-erro-${c.environment}`,
        title: `Chave do ${env} recusada pelo ${config.providerLabel}`,
        detail: `Gere uma nova chave no painel do ${config.providerLabel} e substitua aqui.`,
        severity: "acao",
        anchor: config.anchor,
      });
    } else if (c.status === "CONFIGURADO") {
      pending.push({
        id: `${config.provider}-teste-${c.environment}`,
        title: `Testar a conexão do ${env}`,
        detail: `A chave foi salva, mas ainda não foi confirmada pelo ${config.providerLabel}.`,
        severity: "acao",
        anchor: config.anchor,
      });
    }
  }

  if (!active && rows.length > 0) {
    pending.push({ id: `${config.provider}-sem-ativo`, title: config.noActiveTitle, detail: config.noActiveDetail, severity: "acao", anchor: config.anchor });
  }

  if (active) {
    const hasEvents = events.some((e) => e.provider === config.provider && e.environment !== null);
    if (!hasEvents) {
      pending.push({
        id: `${config.provider}-webhook`,
        title: `Configurar o webhook no ${config.providerLabel}`,
        detail: "Sem o webhook, o status não atualiza sozinho no Saboriza.",
        severity: "acao",
        anchor: "#webhooks",
      });
    }
    if (config.provider === "ASAAS") {
      pending.push({
        id: "nfse-config",
        title: "Confirmar a configuração fiscal da NFS-e no Asaas",
        detail: "Informações fiscais, inscrição municipal e serviço municipal precisam estar cadastrados no painel do Asaas.",
        severity: "acao",
        anchor: "#fiscal",
      });
    }
    if (config.provider === "BASE") {
      pending.push({
        id: "base-config",
        title: "Confirmar a configuração fiscal da NF-e no Base",
        detail: "Certificado digital, regime tributário e impostos precisam estar configurados no painel do Base antes da primeira emissão.",
        severity: "acao",
        anchor: "#fiscal",
      });
    }
  }

  return pending;
}

function buildAccountPendencies(credentials: IntegrationCredential[], events: IntegrationEvent[]): Pendency[] {
  return PROVIDER_CONFIGS.flatMap((config) => buildProviderPendencies(config, credentials, events));
}

interface PendenciasPanelProps {
  credentials: IntegrationCredential[];
  events: IntegrationEvent[];
}

export function PendenciasPanel({ credentials, events }: PendenciasPanelProps) {
  const pending = buildAccountPendencies(credentials, events);

  return (
    <section id="pendencias" className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-base font-bold text-forest-950">Pendências</h2>
        <p className="text-sm text-ink-muted">O que falta para o faturamento funcionar de ponta a ponta, e o que o sistema ainda não faz.</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Da sua conta</p>
        {pending.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Nenhuma pendência da sua conta.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((item) => (
              <PendencyRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Limitações conhecidas do sistema</p>
        <ul className="flex flex-col gap-2">
          {KNOWN_LIMITATIONS.map((item) => (
            <PendencyRow key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function PendencyRow({ item }: { item: Pendency }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-forest-950/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-forest-950">{item.title}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{item.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SEVERITY_TONE[item.severity]}`}>{SEVERITY_LABEL[item.severity]}</span>
        <a href={item.anchor} className="text-xs font-bold text-forest-900 underline-offset-2 hover:underline">
          Ver
        </a>
      </div>
    </li>
  );
}
