import { InventoryTab } from "@/components/admin/InventoryTab";
import { PageHeader } from "@/components/admin/PageHeader";
import { SeparationHistorySection, SeparationQueueSection, useSeparationLive } from "@/components/admin/SeparationSections";

export function OperatorOrdersPage() {
  useSeparationLive();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pedidos" description="Separação e conferência física dos pedidos." />
      <SeparationQueueSection />
    </div>
  );
}

export function OperatorInventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventário" description="Contagem física por item." />
      <InventoryTab />
    </div>
  );
}

export function OperatorHistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Histórico" description="Conferências concluídas." />
      <SeparationHistorySection />
    </div>
  );
}
