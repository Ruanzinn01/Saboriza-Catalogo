import { EnvironmentPanel } from "./EnvironmentPanel";
import type { IntegrationCredential, IntegrationEnvironment } from "@/types/integrations";

const ENVIRONMENT_LABEL: Record<IntegrationEnvironment, string> = {
  SANDBOX: "Sandbox",
  PRODUCAO: "Produção",
};

const BASE_ENVIRONMENTS: IntegrationEnvironment[] = ["PRODUCAO", "SANDBOX"];

function ServiceInvoiceCard({ activeAsaas }: { activeAsaas: IntegrationCredential | null }) {
  const usable = activeAsaas !== null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-forest-950/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-forest-950">NFS-e de Serviço</h3>
          <p className="mt-1 text-sm text-ink-muted">Para prestação de serviços. Emitida pelo Asaas, com a conexão de pagamentos.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${usable ? "bg-amber-100 text-amber-700" : "bg-forest-950/5 text-ink-muted"}`}>
          {usable ? "Verificar configuração fiscal" : "Depende do Asaas ativo"}
        </span>
      </div>

      <p className="text-sm text-ink-muted">
        {usable
          ? `Usa a conexão Asaas em ${ENVIRONMENT_LABEL[activeAsaas.environment]}. Antes da primeira emissão, o Asaas exige as informações fiscais da empresa e as regras do município (serviço, inscrição municipal e método de autenticação). O Saboriza ainda não confere esses dados sozinho: confirme no painel do Asaas.`
          : "Para emitir NFS-e, ative um ambiente Asaas validado na seção Pagamentos."}
      </p>

      <p className="rounded-xl bg-forest-950/5 px-3 py-2 text-xs text-ink-muted">
        Os dados fiscais de cada serviço ficam no cadastro do próprio serviço, não nesta tela.
      </p>
    </div>
  );
}

interface FiscalPanelProps {
  credentials: IntegrationCredential[];
  canManage: boolean;
}

export function FiscalPanel({ credentials, canManage }: FiscalPanelProps) {
  const activeAsaas = credentials.find((c) => c.provider === "ASAAS" && c.isActive) ?? null;
  const baseCredentials = credentials.filter((c) => c.provider === "BASE");
  const activeBaseEnvironment = baseCredentials.find((c) => c.isActive)?.environment ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ServiceInvoiceCard activeAsaas={activeAsaas} />
        <div className="flex flex-col gap-2 rounded-2xl border border-forest-950/10 bg-white p-5">
          <h3 className="font-bold text-forest-950">NF-e de Produto</h3>
          <p className="text-sm text-ink-muted">Para venda e movimentação de mercadorias. Emitida pelo Base ERP (Base by Asaas) — configure abaixo.</p>
          <p className="rounded-xl bg-forest-950/5 px-3 py-2 text-xs text-ink-muted">
            NCM e unidade de venda de cada produto precisam estar cadastrados no produto. Impostos (ICMS/IPI/PIS/COFINS, regime tributário, certificado digital) são configurados direto no painel do Base — o Saboriza não trata isso.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-forest-950/10 bg-cream-50 p-4 sm:p-5">
        <h3 className="font-bold text-forest-950">Base ERP (Base by Asaas)</h3>
        <p className="mb-4 text-sm text-ink-muted">Somente um ambiente fica ativo por vez. A emissão de NF-e de produto usa o ambiente ativo.</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {BASE_ENVIRONMENTS.map((environment) => (
            <EnvironmentPanel
              key={environment}
              provider="BASE"
              providerName="Base"
              kind="fiscal"
              environment={environment}
              credential={baseCredentials.find((c) => c.environment === environment) ?? null}
              canManage={canManage}
              otherEnvironmentActive={activeBaseEnvironment !== null && activeBaseEnvironment !== environment}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
