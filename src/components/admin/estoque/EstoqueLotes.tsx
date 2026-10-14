import { useEffect, useState } from "react";
import { AdminState } from "@/components/admin/AdminState";
import { Card } from "@/components/admin/estoque/EstoquePrimitives";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/number";
import { supabase } from "@/lib/supabase";
import { rpcUntyped } from "@/lib/supabase-rpc";

interface LotRow {
  item_type: "PRODUCT" | "RAW_MATERIAL";
  item_id: string;
  item_name: string;
  sku: string | null;
  base_unit: string;
  lot_code: string;
  received_on: string | null;
  expires_on: string | null;
  received_qty: number;
  remaining_qty: number;
  days_to_expiry: number | null;
  status: "OK" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";
}

function situation(row: LotRow): { label: string; className: string } {
  if (row.status === "EXPIRED") return { label: `Vencido há ${Math.abs(row.days_to_expiry ?? 0)} dias`, className: "bg-red-100 text-red-700" };
  if (row.status === "EXPIRING") return { label: `${row.days_to_expiry} dias · verificar`, className: "bg-amber-100 text-amber-800" };
  if (row.status === "NO_EXPIRY") return { label: "Sem validade informada", className: "bg-ink-900/10 text-ink-700" };
  return { label: `${row.days_to_expiry} dias`, className: "bg-forest-950/10 text-forest-950" };
}

export function EstoqueLotes({ goTo }: { goTo: (tab: string) => void }) {
  const [rows, setRows] = useState<LotRow[] | null>(null);
  const [tracked, setTracked] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [lots, products, materials] = await Promise.all([
        rpcUntyped("stock_lots"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("tracks_lots", true),
        supabase.from("raw_materials").select("id", { count: "exact", head: true }).eq("tracks_lots", true),
      ]);
      if (!active) return;
      if (lots.error) {
        setError(true);
        return;
      }
      setRows((lots.data ?? []) as LotRow[]);
      setTracked((products.count ?? 0) + (materials.count ?? 0));
    })();
    return () => {
      active = false;
    };
  }, []);

  if (error) return <AdminState variant="error" message="Não foi possível carregar os lotes." />;
  if (rows === null) return <AdminState variant="loading" message="Carregando lotes..." />;

  return (
    <div className="flex flex-col gap-4">
      <Card title="Lotes e validade">
        <p className="m-4 rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
          Apenas lotes com quantidade e validade conhecidas geram alertas. Ausência de rastreamento não significa validade regular. O saldo atual é distribuído entre os lotes assumindo FEFO (o que sobra pertence aos lotes de validade mais distante).
        </p>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-ink-muted">
            {tracked === 0
              ? "Nenhum item está com rastreamento de lote ativo. Ative em Itens cadastrados (botão “Rastrear lote”); a partir daí a entrada exige lote e validade."
              : "Nenhum lote com saldo para os itens rastreados."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-y border-forest-950/10 bg-cream-50 text-[10px] uppercase tracking-wide text-ink-muted">
                <tr><th className="px-3 py-3">Lote</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Quantidade rastreada</th><th className="px-3 py-3">Validade</th><th className="px-3 py-3">Situação</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const state = situation(row);
                  return (
                    <tr key={`${row.item_id}-${row.lot_code}`} className="border-b border-forest-950/5 last:border-none">
                      <td className="px-3 py-3 font-mono text-xs">{row.lot_code}</td>
                      <td className="px-3 py-3"><b>{row.item_name}</b><small className="block font-mono text-[10px] text-ink-muted">{row.sku}</small></td>
                      <td className="px-3 py-3">{formatNumber(row.remaining_qty)} {row.base_unit}<small className="block text-[10px] text-ink-muted">de {formatNumber(row.received_qty)} recebidos</small></td>
                      <td className="px-3 py-3">{row.expires_on ? new Date(`${row.expires_on}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${state.className}`}>{state.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col gap-2 p-4">
          <p className="text-sm text-ink-700">
            Somente os itens com rastreamento ativo possuem lote; os demais permanecem <b>sem rastreamento de validade</b>.
            {tracked !== null ? ` Itens rastreados: ${tracked}.` : ""}
          </p>
          <div><Button variant="outline" onClick={() => goTo("retornos")}>Tratar perdas e devoluções</Button></div>
        </div>
      </Card>
    </div>
  );
}
