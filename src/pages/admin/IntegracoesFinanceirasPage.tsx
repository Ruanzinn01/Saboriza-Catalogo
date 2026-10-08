import { useEffect } from "react";
import { EnvironmentPanel } from "@/components/integracoes/EnvironmentPanel";
import { FiscalPanel } from "@/components/integracoes/FiscalPanel";
import { IntegrationHelp } from "@/components/integracoes/IntegrationHelp";
import { IntegrationOverview } from "@/components/integracoes/IntegrationOverview";
import { PendenciasPanel } from "@/components/integracoes/PendenciasPanel";
import { WebhookPanel } from "@/components/integracoes/WebhookPanel";
import { useIntegrationsStore } from "@/store/integrations-store";
import type { IntegrationEnvironment } from "@/types/integrations";

const ASAAS_ENVIRONMENTS: IntegrationEnvironment[] = ["PRODUCAO", "SANDBOX"];

export function IntegracoesFinanceirasPage() {
  const companyId = useIntegrationsStore((s) => s.companyId);
  const credentials = useIntegrationsStore((s) => s.credentials);
  const events = useIntegrationsStore((s) => s.events);
  const canManage = useIntegrationsStore((s) => s.canManage);
  const status = useIntegrationsStore((s) => s.status);
  const errorMessage = useIntegrationsStore((s) => s.errorMessage);
  const fetchAll = useIntegrationsStore((s) => s.fetchAll);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const asaasCredentials = credentials.filter((c) => c.provider === "ASAAS");
  const activeEnvironment = asaasCredentials.find((c) => c.isActive)?.environment ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-extrabold text-forest-950">Central de Integrações</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Os serviços externos que o Saboriza usa para cobrar seus clientes e emitir notas. Cada empresa conecta a própria conta, e as credenciais ficam protegidas.
        </p>
      </header>

      {status === "error" && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage ?? "Não foi possível carregar as integrações."}</p>
      )}

      {status === "ready" && !canManage && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você pode consultar as integrações, mas não alterar. Alterações exigem a permissão de gestão de integrações financeiras.
        </p>
      )}

      {status === "ready" && <IntegrationOverview credentials={credentials} events={events} />}

      {status === "ready" && <PendenciasPanel credentials={credentials} events={events} />}

      <section id="pagamentos" className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-forest-950">Pagamentos e recebimentos</h2>
          <p className="text-sm text-ink-muted">Provedor que cria as cobranças do Faturar e recebe os pagamentos dos clientes.</p>
        </div>
        <div className="rounded-3xl border border-forest-950/10 bg-cream-50 p-4 sm:p-5">
          <h3 className="font-bold text-forest-950">Asaas</h3>
          <p className="mb-4 text-sm text-ink-muted">
            Somente um ambiente fica ativo por vez. O Faturar usa o ambiente ativo.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ASAAS_ENVIRONMENTS.map((environment) => (
              <EnvironmentPanel
                key={environment}
                provider="ASAAS"
                providerName="Asaas"
                kind="payment"
                showWallet
                environment={environment}
                credential={asaasCredentials.find((c) => c.environment === environment) ?? null}
                canManage={canManage}
                otherEnvironmentActive={activeEnvironment !== null && activeEnvironment !== environment}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="fiscal" className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-forest-950">Documentos fiscais</h2>
          <p className="text-sm text-ink-muted">Notas de produto e de serviço seguem regras e provedores diferentes, por isso ficam separadas.</p>
        </div>
        <FiscalPanel credentials={credentials} canManage={canManage} />
      </section>

      <section id="webhooks" className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-forest-950">Webhooks</h2>
          <p className="text-sm text-ink-muted">Avisos automáticos que o provedor envia quando um pagamento ou uma nota fiscal muda de status.</p>
        </div>
        {companyId && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WebhookPanel
              companyId={companyId}
              provider="ASAAS"
              providerName="Asaas"
              functionSlug="asaas-webhook"
              description="Avisa o Saboriza quando uma cobrança é paga, vence ou é estornada."
              credentials={credentials}
              events={events}
              canManage={canManage}
            />
            <WebhookPanel
              companyId={companyId}
              provider="BASE"
              providerName="Base"
              functionSlug="base-webhook"
              description="Avisa o Saboriza quando uma NF-e de produto é autorizada, rejeitada ou cancelada."
              credentials={credentials}
              events={events}
              canManage={canManage}
            />
          </div>
        )}
      </section>

      <IntegrationHelp />
    </div>
  );
}
