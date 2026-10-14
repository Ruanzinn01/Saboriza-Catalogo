import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { InventoryTab } from "@/components/admin/InventoryTab";
import { PageHeader } from "@/components/admin/PageHeader";
import { SeparationHistorySection, SeparationQueueSection, useSeparationLive } from "@/components/admin/SeparationSections";
import { SeparationShortagesReport } from "@/components/admin/SeparationShortagesReport";
import { cn } from "@/lib/cn";

type Tab = "pendentes" | "historico" | "inventario" | "faltas";

const TABS: { key: Tab; label: string }[] = [
  { key: "pendentes", label: "Pendentes" },
  { key: "historico", label: "Histórico" },
  { key: "inventario", label: "Inventário" },
  { key: "faltas", label: "Faltas" },
];

function initialTab(param: string | null): Tab {
  return TABS.some((tab) => tab.key === param) ? (param as Tab) : "pendentes";
}

export function SeparaConferePage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab(searchParams.get("aba")));
  useSeparationLive();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Separa Confere" description="Separação e conferência física dos pedidos." />

      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-ink-900/5 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "min-h-11 flex-1 rounded-xl px-3 text-sm font-bold transition-colors",
              tab === item.key ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted hover:text-ink-900"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "pendentes" && <SeparationQueueSection />}
      {tab === "historico" && <SeparationHistorySection />}
      {tab === "inventario" && <InventoryTab />}
      {tab === "faltas" && <SeparationShortagesReport />}
    </div>
  );
}
