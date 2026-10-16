import { useEffect, useState } from "react";
import { AdminState } from "@/components/admin/AdminState";
import { formatDateTime } from "@/lib/inventory";
import { fromUntyped } from "@/lib/supabase-rpc";

interface ShortageRow {
  id: string;
  order_number: string;
  customer_name: string;
  product_name: string;
  requested_units: number;
  separated_units: number;
  missing_units: number;
  reason: string;
  reported_by_name: string;
  created_at: string;
  situation?: "OPEN" | "RESOLVED" | "CANCELLED";
  cancel_reason?: string | null;
}

const SITUATION_LABEL = { OPEN: "Aberta", RESOLVED: "Resolvida", CANCELLED: "Cancelada" } as const;

/** Faltas na separação de pedidos: ocorrência do pedido, separada do relatório de divergências de inventário. */
export function SeparationShortagesReport() {
  const [rows, setRows] = useState<ShortageRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  async function load() {
    setStatus("loading");
    // Visão com situação (aberta/resolvida/cancelada); cai na tabela enquanto a migration do ciclo de vida não estiver aplicada.
    let result = await fromUntyped("separation_shortage_report").select("*").order("created_at", { ascending: false }).limit(200);
    if (result.error) result = await fromUntyped("separation_shortages").select("*").order("created_at", { ascending: false }).limit(200);
    const { data, error } = result;
    if (error) {
      setStatus("error");
      return;
    }
    setRows((data as ShortageRow[] | null) ?? []);
    setStatus("ready");
  }

  useEffect(() => {
    void load();
  }, []);

  if (status === "loading") return <AdminState variant="loading" message="Carregando faltas..." />;
  if (status === "error") return <AdminState variant="error" message="Não foi possível carregar as faltas." onRetry={() => void load()} />;
  if (rows.length === 0) return <AdminState variant="empty" message="Nenhuma falta registrada na separação." />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        Faltas são registradas pelo conferente quando a quantidade pedida não foi localizada. Pertencem ao pedido e não alteram o estoque nem aparecem nas divergências de inventário.
      </p>
      <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3 text-right">Pedido</th>
              <th className="px-4 py-3 text-right">Separado</th>
              <th className="px-4 py-3 text-right">Faltou</th>
              <th className="px-4 py-3">Operador</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-forest-950/5 last:border-none">
                <td className="px-4 py-3 text-ink-muted">{formatDateTime(row.created_at)}</td>
                <td className="px-4 py-3 font-bold text-forest-950">{row.order_number}</td>
                <td className="px-4 py-3">{row.customer_name}</td>
                <td className="px-4 py-3">{row.product_name}</td>
                <td className="px-4 py-3 text-right font-mono">{row.requested_units}</td>
                <td className="px-4 py-3 text-right font-mono">{row.separated_units}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-red-700">{row.missing_units}</td>
                <td className="px-4 py-3 text-ink-muted">{row.reported_by_name}</td>
                <td className="px-4 py-3 text-ink-muted">{row.reason || "—"}</td>
                <td className="px-4 py-3 font-semibold">{row.situation ? SITUATION_LABEL[row.situation] : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
