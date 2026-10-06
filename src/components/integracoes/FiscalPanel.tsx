import type { IntegrationCredential, IntegrationEnvironment } from "@/types/integrations";

const ENVIRONMENT_LABEL: Record<IntegrationEnvironment, string> = {
  SANDBOX: "Sandbox",
  PRODUCAO: "Produção",
};

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

function ProductInvoiceCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-forest-950/20 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-forest-950">NF-e de Produto</h3>
          <p className="mt-1 text-sm text-ink-muted">Para venda e movimentação de mercadorias.</p>
        </div>
        <span className="rounded-full bg-forest-950/5 px-3 py-1 text-xs font-semibold text-ink-muted">Indisponível</span>
      </div>
      <p className="text-sm text-ink-muted">
        Esta integração ainda não existe no Saboriza. Quando for implementada, a configuração aparece aqui. Nenhuma credencial é pedida até lá.
      </p>
    </div>
  );
}

interface FiscalPanelProps {
  credentials: IntegrationCredential[];
}

export function FiscalPanel({ credentials }: FiscalPanelProps) {
  const activeAsaas = credentials.find((c) => c.provider === "ASAAS" && c.isActive) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ServiceInvoiceCard activeAsaas={activeAsaas} />
      <ProductInvoiceCard />
    </div>
  );
}
