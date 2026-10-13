import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, PackagePlus } from "lucide-react";
import { EstoqueGestaoGeral } from "@/components/admin/estoque/EstoqueGestaoGeral";
import { EstoqueInventario } from "@/components/admin/estoque/EstoqueInventario";
import { EstoqueMovimentacoes } from "@/components/admin/estoque/EstoqueMovimentacoes";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Tab = "gestao" | "movimentacoes" | "inventario";

const TABS: { key: Tab; label: string }[] = [
  { key: "gestao", label: "Gestão Geral" },
  { key: "movimentacoes", label: "Movimentações" },
  { key: "inventario", label: "Inventário" },
];

function parseTab(value: string | null): Tab {
  return TABS.some((tab) => tab.key === value) ? (value as Tab) : "gestao";
}

export function EstoquePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("aba"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Estoque"
        description="Posição, razão de movimentos e inventário de produtos e matérias-primas."
        actions={
          <>
            <Link to="/admin/estoque/produtos">
              <Button variant="outline" className="w-full sm:w-auto">
                <PackagePlus size={18} /> Entrada e ajuste de produtos
              </Button>
            </Link>
            <Link to="/admin/estoque/indicadores">
              <Button variant="outline" className="w-full sm:w-auto">
                <BarChart3 size={18} /> Indicadores de estoque
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-ink-900/5 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setSearchParams(item.key === "gestao" ? {} : { aba: item.key }, { replace: true })}
            className={cn(
              "min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition-colors",
              tab === item.key ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted hover:text-ink-900"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "gestao" && <EstoqueGestaoGeral />}
      {tab === "movimentacoes" && <EstoqueMovimentacoes />}
      {tab === "inventario" && <EstoqueInventario />}
    </div>
  );
}
