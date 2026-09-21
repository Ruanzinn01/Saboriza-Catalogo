import { StockInsightsPanel } from "@/components/admin/StockInsightsPanel";
import { PageHeader } from "@/components/admin/PageHeader";

export function StockInsightsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Indicadores de estoque"
        eyebrow="Somente leitura"
        description="Leitura consolidada de saldos e movimentações. Nada aqui altera dado nenhum."
        back={{ to: "/admin/estoque", label: "Voltar para Estoque" }}
      />
      <StockInsightsPanel />
    </div>
  );
}
