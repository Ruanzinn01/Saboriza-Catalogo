import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/admin/estoque/EstoquePrimitives";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/currency";
import { resolveCurrentCompany } from "@/lib/current-company";
import { buildReportCsv, buildReportHtml, escapeHtml, positionToReportItems } from "@/lib/estoque-report";
import { formatDateTime } from "@/lib/inventory";
import { fromUntyped } from "@/lib/supabase-rpc";
import { supabase } from "@/lib/supabase";
import { useEstoqueStore } from "@/store/estoque-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { ClosingRow, ReportData, ReportItem } from "@/types/estoque";

const monthLabel = (competence: string) => {
  const [year, month] = competence.split("-");
  return `${month}/${year}`;
};

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function EstoqueRelatorios() {
  const position = useEstoqueStore((s) => s.position);
  const fetchPosition = useEstoqueStore((s) => s.fetchPosition);
  const closings = useEstoqueStore((s) => s.closings);
  const fetchClosings = useEstoqueStore((s) => s.fetchClosings);
  const closePeriod = useEstoqueStore((s) => s.closePeriod);
  const losses = useEstoqueStore((s) => s.losses);
  const returns = useEstoqueStore((s) => s.returns);
  const fetchLosses = useEstoqueStore((s) => s.fetchLosses);
  const fetchReturns = useEstoqueStore((s) => s.fetchReturns);
  const sessions = useInventoryStore((s) => s.sessions);
  const fetchSessions = useInventoryStore((s) => s.fetchSessions);

  const [company, setCompany] = useState("");
  const [unit, setUnit] = useState("");
  const [moves, setMoves] = useState<{ type: string; count: number; quantity: number }[]>([]);
  const [view, setView] = useState<ReportData | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPosition();
    void fetchClosings();
    void fetchLosses();
    void fetchReturns();
    void fetchSessions();
    void (async () => {
      const current = await resolveCurrentCompany();
      if (!current) return;
      setCompany(current.display_name);
      const { data } = await supabase.from("units").select("name").eq("company_id", current.id).eq("status", "ACTIVE").order("created_at").limit(1);
      setUnit(data?.[0]?.name ?? "");
      const ledger = await fromUntyped("stock_ledger").select("movement_type, quantity").gte("occurred_at", monthStartIso()).limit(5000);
      const grouped = new Map<string, { count: number; quantity: number }>();
      for (const row of (ledger.data ?? []) as { movement_type: string; quantity: number }[]) {
        const entry = grouped.get(row.movement_type) ?? { count: 0, quantity: 0 };
        entry.count += 1;
        entry.quantity += Number(row.quantity);
        grouped.set(row.movement_type, entry);
      }
      setMoves([...grouped.entries()].map(([type, value]) => ({ type, ...value })).sort((a, b) => a.type.localeCompare(b.type)));
    })();
  }, [fetchPosition, fetchClosings, fetchLosses, fetchReturns, fetchSessions]);

  const currentCompetence = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const alreadyClosed = closings.some((row) => row.competence === currentCompetence);

  const liveReport = (): ReportData => {
    const monthPrefix = currentCompetence.slice(0, 7);
    const monthLosses = losses.filter((row) => row.occurredOn.startsWith(monthPrefix));
    return {
      title: "Relatório parcial · posição atual",
      company,
      unit,
      periodLabel: monthLabel(currentCompetence),
      generatedAt: formatDateTime(new Date().toISOString()),
      closed: false,
      items: positionToReportItems(position),
      movements: moves,
      inventory: sessions.map((s) => ({ items: s.total, counted: s.counted, divergences: s.divergences })),
      losses: {
        count: monthLosses.length,
        total_cost: monthLosses.reduce((sum, row) => sum + (row.totalCost ?? 0), 0),
        unknown_cost: monthLosses.filter((row) => row.totalCost === null).length,
        awaiting_returns: returns.filter((row) => row.status === "AWAITING").length,
      },
      policy: position[0]
        ? {
            product: { min_days: position.find((p) => p.itemType === "PRODUCT")?.policyMin ?? 30, ideal_days: position.find((p) => p.itemType === "PRODUCT")?.policyIdeal ?? 45, max_days: position.find((p) => p.itemType === "PRODUCT")?.policyMax ?? 60 },
            raw_material: { min_days: position.find((p) => p.itemType === "RAW_MATERIAL")?.policyMin ?? 30, ideal_days: position.find((p) => p.itemType === "RAW_MATERIAL")?.policyIdeal ?? 45, max_days: position.find((p) => p.itemType === "RAW_MATERIAL")?.policyMax ?? 60 },
          }
        : null,
    };
  };

  // Relatório do fechamento: lê SOMENTE a fotografia preservada, nunca a posição atual.
  const closedReport = (row: ClosingRow): ReportData => {
    const snap = row.snapshot as {
      generated_at?: string;
      items?: ReportItem[];
      movements?: ReportData["movements"];
      inventory?: ReportData["inventory"];
      losses_and_returns?: ReportData["losses"];
      policy?: ReportData["policy"];
    };
    return {
      title: `Fotografia de fechamento · ${monthLabel(row.competence)}${row.partial ? " (parcial)" : ""}`,
      company,
      unit,
      periodLabel: monthLabel(row.competence),
      generatedAt: formatDateTime(snap.generated_at ?? row.closedAt),
      closed: true,
      items: snap.items ?? [],
      movements: snap.movements ?? [],
      inventory: snap.inventory ?? [],
      losses: snap.losses_and_returns ?? null,
      policy: snap.policy ?? null,
    };
  };

  function printReport(data: ReportData) {
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) {
      toast.error("O navegador bloqueou a janela de impressão. Permita pop-ups e tente de novo.");
      return;
    }
    win.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title><style>body{font:12px 'Segoe UI',Arial,sans-serif;color:#18372d;margin:24px}table{border-collapse:collapse;width:100%;margin:8px 0 16px}td,th{border:1px solid #d8dfd7;padding:5px 7px;text-align:left;vertical-align:top}th{background:#faf8f0;font-size:10px;text-transform:uppercase}h2{margin:0 0 6px}h3{margin:14px 0 4px}small{color:#788078}</style></head><body>${buildReportHtml(data)}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  }

  function downloadCsv(data: ReportData) {
    const blob = new Blob([buildReportCsv(data.items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Estoque_${data.periodLabel.replace("/", "-")}${data.closed ? "_fechamento" : "_parcial"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    setError(null);
    const message = await closePeriod(currentCompetence);
    setClosing(false);
    if (message) {
      setError(message);
      return;
    }
    setConfirmClose(false);
    toast.success("Fechamento preservado. Eventos seguintes não alteram este relatório.");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Fechamentos e relatórios mensais">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-forest-950">{monthLabel(currentCompetence)}</h3>
              <p className="text-sm text-ink-muted">{alreadyClosed ? "Competência fechada." : "Período aberto · posição parcial."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setView(liveReport())}>Visualizar relatório</Button>
              {!alreadyClosed && <Button variant="outline" onClick={() => { setConfirmClose(true); setError(null); }}>Fechar competência</Button>}
            </div>
          </div>
          <p className="rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
            O relatório aberto acompanha a posição atual. Uma fotografia fechada preserva valores, nomes, custos e política; mudanças posteriores não a recalculam.
          </p>
        </div>
      </Card>

      <Card title="Fotografias preservadas">
        {closings.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Nenhum fechamento ainda. Ao fechar uma competência, ela aparece aqui e alimenta os gráficos históricos da Gestão Geral.</p>
        ) : (
          <div className="flex flex-col">
            {closings.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-950/10 px-4 py-3 last:border-none">
                <div>
                  <b>{monthLabel(row.competence)}{row.partial ? " (parcial)" : ""}</b>
                  <small className="block text-xs text-ink-muted">{row.itemsCount} itens · {formatCurrency(row.totalValue)} a custo · fechado em {formatDateTime(row.closedAt)}</small>
                </div>
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => setView(closedReport(row))}>Ver fotografia preservada</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Conteúdo do relatório">
        <div className="p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
            <li>Posição física e disponível, a custo.</li>
            <li>Composição e situação do estoque.</li>
            <li>Cobertura e necessidade líquida.</li>
            <li>Movimentações e suas origens.</li>
            <li>Inventário: contagem realizada e acuracidade separadas.</li>
            <li>Retornos, perdas e exceções.</li>
            <li>Política usada no fechamento.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-muted">
            Impressão / salvar PDF e planilha CSV estão disponíveis no visualizador. O envio à Central de PDFs e ao WhatsApp depende da integração oficial, ainda não existente: nada é enviado automaticamente.
          </p>
        </div>
      </Card>

      <Dialog open={view !== null} onClose={() => setView(null)} title="Visualizador de relatório" wide>
        {view && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button onClick={() => printReport(view)}>Imprimir / salvar PDF</Button>
              <Button variant="outline" onClick={() => downloadCsv(view)}>Baixar planilha CSV</Button>
            </div>
            <div
              className="text-sm [&_h2]:text-xl [&_h2]:font-extrabold [&_h3]:mt-4 [&_h3]:font-bold [&_small]:text-ink-muted [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-forest-950/10 [&_td]:p-1.5 [&_th]:border [&_th]:border-forest-950/10 [&_th]:bg-cream-50 [&_th]:p-1.5 [&_th]:text-left [&_th]:text-[10px] [&_th]:uppercase"
              // HTML gerado por buildReportHtml, que escapa todo valor vindo de cadastro
              dangerouslySetInnerHTML={{ __html: buildReportHtml(view) }}
            />
          </>
        )}
      </Dialog>

      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)} title={`Fechar competência ${monthLabel(currentCompetence)}`}>
        <div className="flex flex-col gap-3 text-sm">
          <p>Será criada uma fotografia <b>imutável</b> com posição, custos, política e totais de agora. Depois disso, compras, vendas e ajustes não alteram esse relatório, e ele não pode ser refeito.</p>
          <p className="text-ink-muted">Fechar antes do fim do mês gera um fechamento marcado como parcial.</p>
          {error && <p role="alert" className="font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmClose(false)}>Cancelar</Button>
            <Button disabled={closing} onClick={() => void handleClose()}>{closing ? "Fechando..." : "Confirmar fechamento"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
