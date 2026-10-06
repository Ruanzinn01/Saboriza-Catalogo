import type { IntegrationCredential, IntegrationEvent } from "@/types/integrations";

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
    id: "juros-multa",
    title: "Juros, multa e desconto do boleto não chegam ao Asaas",
    detail: "O Faturar guarda essas regras, mas a cobrança é criada sem elas. Corrigir antes de emitir boletos reais.",
    severity: "limitacao",
    anchor: "#pagamentos",
  },
  {
    id: "cpf-cnpj",
    title: "CPF/CNPJ do cliente não é validado antes de cobrar",
    detail: "Se o cliente não tiver documento, o Asaas pode recusar o boleto e a falha só aparece depois.",
    severity: "limitacao",
    anchor: "#pagamentos",
  },
  {
    id: "agendamento",
    title: "Programação de pagamento pelo Asaas ainda não agenda nada",
    detail: "A data é gravada na despesa, mas nenhum agendamento é enviado ao Asaas.",
    severity: "limitacao",
    anchor: "#pagamentos",
  },
  {
    id: "nfe-produto",
    title: "NF-e de Produto ainda não tem integração",
    detail: "Depende de escolher e implementar o provedor (Base by Asaas ainda não pesquisada).",
    severity: "limitacao",
    anchor: "#fiscal",
  },
  {
    id: "certificado",
    title: "Certificado digital não é tratado pelo Saboriza",
    detail: "Se o município exigir certificado para NFS-e, a configuração precisa ser feita no painel do Asaas.",
    severity: "limitacao",
    anchor: "#fiscal",
  },
];

function buildAccountPendencies(credentials: IntegrationCredential[], events: IntegrationEvent[]): Pendency[] {
  const asaas = credentials.filter((c) => c.provider === "ASAAS");
  const active = asaas.find((c) => c.isActive) ?? null;
  const pending: Pendency[] = [];

  if (asaas.length === 0) {
    pending.push({
      id: "sem-chave",
      title: "Cadastrar a chave de API do Asaas",
      detail: "Sem chave cadastrada, o Faturar não cria cobrança nem nota.",
      severity: "acao",
      anchor: "#pagamentos",
    });
  }

  for (const c of asaas) {
    const env = c.environment === "PRODUCAO" ? "Produção" : "Sandbox";
    if (c.status === "ERRO") {
      pending.push({
        id: `erro-${c.environment}`,
        title: `Chave do ${env} recusada pelo Asaas`,
        detail: "Gere uma nova chave no painel do Asaas e substitua aqui.",
        severity: "acao",
        anchor: "#pagamentos",
      });
    } else if (c.status === "CONFIGURADO") {
      pending.push({
        id: `teste-${c.environment}`,
        title: `Testar a conexão do ${env}`,
        detail: "A chave foi salva, mas ainda não foi confirmada pelo Asaas.",
        severity: "acao",
        anchor: "#pagamentos",
      });
    }
  }

  if (!active && asaas.length > 0) {
    pending.push({
      id: "sem-ativo",
      title: "Nenhum ambiente Asaas ativo",
      detail: "O Faturar não cria cobranças até um ambiente validado ser ativado.",
      severity: "acao",
      anchor: "#pagamentos",
    });
  }

  if (active) {
    const hasEvents = events.some((e) => e.environment !== null);
    if (!hasEvents) {
      pending.push({
        id: "webhook",
        title: "Configurar o webhook no Asaas",
        detail: "Sem o webhook, pagamentos e vencimentos não atualizam sozinhos no Saboriza.",
        severity: "acao",
        anchor: "#webhooks",
      });
    }
    pending.push({
      id: "nfse-config",
      title: "Confirmar a configuração fiscal da NFS-e no Asaas",
      detail: "Informações fiscais, inscrição municipal e serviço municipal precisam estar cadastrados no painel do Asaas.",
      severity: "acao",
      anchor: "#fiscal",
    });
  }

  return pending;
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
