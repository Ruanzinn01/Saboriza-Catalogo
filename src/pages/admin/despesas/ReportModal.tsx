import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { useRelatoriosStore } from "@/store/relatorios-store";
import { buildDespesasReport, type DespesasReportType } from "@/lib/despesas-report";
import type { Expense } from "@/store/despesas-store";
import { Button } from "@/components/ui/Button";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;

/** Modal de relatório + Central de PDFs — equivalente ao `<dialog id="reportModal">` do HTML V2. */
export function ReportModal({
  onClose,
  periodLabel,
  periodExpenses,
  kpis,
  byOrigin,
  composition,
  periodFrom,
  periodTo,
}: {
  onClose: () => void;
  periodLabel: string;
  periodExpenses: Expense[];
  kpis: { total: number; pago: number; aPagar: number; agendado: number; atrasado: number };
  byOrigin: { label: string; total: number }[];
  composition: { label: string; total: number; count: number }[];
  periodFrom: string;
  periodTo: string;
}) {
  const reports = useRelatoriosStore((s) => s.reports);
  const fetchReports = useRelatoriosStore((s) => s.fetchReports);
  const registerReport = useRelatoriosStore((s) => s.registerReport);
  const [reportType, setReportType] = useState<DespesasReportType>("complete");
  const [saveCentral, setSaveCentral] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReports("despesas");
  }, [fetchReports]);

  async function handleGenerate() {
    setGenerating(true);
    const companyId = await resolveCurrentCompanyId();
    const { data: company } = companyId ? await supabase.from("companies").select("display_name").eq("id", companyId).maybeSingle() : { data: null };

    const doc = buildDespesasReport({
      companyName: company?.display_name ?? "Óris 360",
      periodLabel,
      type: reportType,
      kpis,
      byOrigin,
      composition,
      rows: periodExpenses,
    });
    doc.save(`despesas-${reportType}-${periodFrom}-a-${periodTo}.pdf`);

    if (saveCentral) {
      const err = await registerReport({ module: "despesas", reportType, periodFrom, periodTo, filters: { periodLabel } });
      if (err) toast.error(`PDF baixado, mas não foi possível salvar na Central: ${err}`);
      else toast.success("PDF preparado e salvo na Central de PDFs/Relatórios.");
    } else {
      toast.success("PDF preparado para exportação.");
    }
    setGenerating(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#092d237a] p-4" onClick={onClose}>
      <div
        className="w-full max-w-[780px] rounded-[18px] bg-white p-[22px] shadow-[0_20px_80px_#082d2333]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[3px]" style={{ color: C.gold }}>RELATÓRIOS</p>
            <h2 className="text-lg font-extrabold" style={{ color: C.green }}>Gerar relatório da Visão Geral</h2>
            <p className="text-xs" style={{ color: C.muted }}>Respeita o mês/período e filtros aplicados: {periodLabel}.</p>
          </div>
          <button onClick={onClose} className="px-1.5 text-2xl leading-none" style={{ color: C.green }}>×</button>
        </div>

        <div className="my-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            onClick={() => setReportType("complete")}
            className="rounded-[13px] border p-3.5 text-left"
            style={reportType === "complete" ? { borderColor: "#73a487", background: "#f1f7ed" } : { borderColor: C.line }}
          >
            <strong style={{ color: C.green }}>PDF completo</strong>
            <p className="text-xs" style={{ color: C.muted }}>Indicadores, gráficos, categorias, vencimentos e detalhamento.</p>
          </button>
          <button
            onClick={() => setReportType("executive")}
            className="rounded-[13px] border p-3.5 text-left"
            style={reportType === "executive" ? { borderColor: "#73a487", background: "#f1f7ed" } : { borderColor: C.line }}
          >
            <strong style={{ color: C.green }}>PDF executivo</strong>
            <p className="text-xs" style={{ color: C.muted }}>Resumo enxuto para direção/sócios.</p>
          </button>
        </div>

        <label className="flex items-start gap-2.5 rounded-[10px] p-3" style={{ background: "#f7f9f4" }}>
          <input type="checkbox" checked={saveCentral} onChange={(e) => setSaveCentral(e.target.checked)} className="mt-0.5" />
          <span className="text-sm">
            <strong className="block" style={{ color: C.green }}>Salvar também na Central de PDFs/Relatórios</strong>
            <span className="text-xs" style={{ color: C.muted }}>Guarda empresa, período, filtros, data/hora e tipo do relatório.</span>
          </span>
        </label>

        {reports.length > 0 && (
          <div className="mt-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Relatórios salvos recentemente</p>
            <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: C.line }}>
                  <div>
                    <strong className="text-xs" style={{ color: C.green }}>
                      Despesas · {r.reportType === "complete" ? "Completo" : "Executivo"}
                    </strong>
                    <p className="text-[11px]" style={{ color: C.muted }}>{r.periodFrom} a {r.periodTo}</p>
                  </div>
                  <span className="text-[11px]" style={{ color: C.muted }}>{new Date(r.generatedAt).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-[18px] flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Fechar</button>
          <Button disabled={generating} onClick={() => void handleGenerate()}>{generating ? "Gerando..." : "Gerar PDF"}</Button>
        </div>
      </div>
    </div>
  );
}
