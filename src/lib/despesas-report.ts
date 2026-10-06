import { jsPDF } from "jspdf";
import type { Expense } from "@/store/despesas-store";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type DespesasReportType = "complete" | "executive";

interface ReportInput {
  companyName: string;
  periodLabel: string;
  type: DespesasReportType;
  kpis: { total: number; pago: number; aPagar: number; agendado: number; atrasado: number };
  byOrigin: { label: string; total: number }[];
  composition: { label: string; total: number; count: number }[];
  rows: Expense[];
}

const STATUS_LABEL: Record<string, string> = { ABERTO: "Em aberto", AGENDADO: "Agendado", PAGO: "Pago", ATRASADO: "Atrasado", BLOQUEADO: "Bloqueado" };

export function buildDespesasReport(input: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 14;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.companyName, marginX, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(`Despesas — ${input.type === "complete" ? "Relatório completo" : "Relatório executivo"}`, marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Período: ${input.periodLabel}`, marginX, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Indicadores", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const kpiLines = [
    `Total: ${brl(input.kpis.total)}`,
    `Pago: ${brl(input.kpis.pago)}`,
    `A pagar: ${brl(input.kpis.aPagar)}`,
    `Agendado: ${brl(input.kpis.agendado)}`,
    `Atrasado: ${brl(input.kpis.atrasado)}`,
  ];
  kpiLines.forEach((line) => {
    doc.text(line, marginX, y);
    y += 5;
  });
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Despesas por origem", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  input.byOrigin.forEach((o) => {
    doc.text(`${o.label}: ${brl(o.total)}`, marginX, y);
    y += 5;
  });
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Composição", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  input.composition.forEach((c) => {
    doc.text(`${c.label}: ${brl(c.total)} (${c.count})`, marginX, y);
    y += 5;
  });
  y += 5;

  if (input.type === "complete") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Lançamentos do período", marginX, y);
    y += 6;
    doc.setFontSize(8.5);

    input.rows.forEach((e) => {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.text(e.description.slice(0, 55), marginX, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${STATUS_LABEL[e.status] ?? e.status} · ${brl(e.amount)}`, 150, y, { align: "left" });
      y += 4.5;
      doc.setTextColor(120);
      doc.text(`${e.category} · venc. ${e.dueDate ?? "-----"}`, marginX, y);
      doc.setTextColor(0);
      y += 5.5;
    });
  }

  return doc;
}
