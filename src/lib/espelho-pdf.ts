import { jsPDF } from "jspdf";

export interface EspelhoContent {
  company: string | null;
  employee: { name: string; code: string; cpf_masked: string | null; role: string | null };
  competence: string;
  timezone: string;
  version: number;
  issued_at: string;
  revision: { number: number; status: string; cutoff_date: string; as_of: string; reason: string | null };
  totals: { worked_minutes: number; normal_minutes: number; extra_minutes: number; late_minutes: number; worked_days: number; pending_days: number };
  days: {
    date: string;
    worked_minutes: number;
    extra_minutes: number;
    late_minutes: number;
    inconsistency: string | null;
    punches: { type: string; time: string; origin: string }[];
  }[];
  adjustments: { id: string; kind: string; date: string; reason: string; before: string | null; after: string | null; at: string }[];
}

const PUNCH_SHORT: Record<string, string> = { ENTRADA: "Ent", INTERVALO: "Int", RETORNO: "Ret", SAIDA: "Saí" };
const KIND_LABEL: Record<string, string> = {
  CORRECT_TIME: "Horário corrigido",
  VOID_PUNCH: "Batida anulada",
  RESTORE_PUNCH: "Batida restaurada",
  ADD_PUNCH: "Batida adicionada",
  VOID_ADDED: "Batida adicionada anulada",
};

export function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? "-" : ""}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, "0")}`;
}

function brDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function buildEspelhoPdf(c: EspelhoContent): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 14;
  const pageBottom = 285;
  let y = 18;

  const ensure = (space: number) => {
    if (y + space > pageBottom) {
      doc.addPage();
      y = 18;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(c.company ?? "Empresa", marginX, y);
  y += 7;
  doc.setFontSize(12);
  doc.text("Espelho de Ponto", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`${c.employee.name} · matrícula ${c.employee.code}${c.employee.cpf_masked ? ` · CPF ${c.employee.cpf_masked}` : ""}`, marginX, y);
  y += 5;
  doc.text(`Competência ${c.competence.slice(0, 7).split("-").reverse().join("/")} · fuso ${c.timezone}`, marginX, y);
  y += 5;
  doc.text(
    `Revisão ${c.revision.number} (${c.revision.status}) · apuração até ${brDay(c.revision.cutoff_date)} · versão do Espelho ${c.version} · emitido em ${new Date(c.issued_at).toLocaleString("pt-BR")}`,
    marginX,
    y
  );
  y += 5;
  if (c.revision.reason) {
    doc.text(`Motivo da retificação: ${c.revision.reason}`, marginX, y);
    y += 5;
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Totais", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    `Trabalhado ${formatMinutes(c.totals.worked_minutes)} · Normal ${formatMinutes(c.totals.normal_minutes)} · Extra ${formatMinutes(c.totals.extra_minutes)} · Atrasos ${formatMinutes(c.totals.late_minutes)} · Ocorrências ${c.totals.pending_days}`,
    marginX,
    y
  );
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Dia", marginX, y);
  doc.text("Batidas (* = ajustada ou adicionada)", marginX + 24, y);
  doc.text("Trab.", marginX + 130, y);
  doc.text("Extra", marginX + 150, y);
  doc.text("Atraso", marginX + 166, y);
  y += 2;
  doc.line(marginX, y, 196, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  c.days.forEach((d) => {
    const punches = d.punches.map((p) => `${PUNCH_SHORT[p.type] ?? p.type} ${p.time}${p.origin !== "BATIDA" ? "*" : ""}`).join("  ");
    const lines = doc.splitTextToSize(punches || "-", 100) as string[];
    ensure(lines.length * 4 + 3);
    doc.text(brDay(d.date), marginX, y);
    doc.text(lines, marginX + 24, y);
    doc.text(formatMinutes(d.worked_minutes), marginX + 130, y);
    doc.text(d.extra_minutes > 0 ? formatMinutes(d.extra_minutes) : "-", marginX + 150, y);
    doc.text(d.late_minutes > 0 ? formatMinutes(d.late_minutes) : "-", marginX + 166, y);
    y += lines.length * 4;
    if (d.inconsistency) {
      doc.setTextColor(180, 40, 40);
      doc.text(`Ocorrência: ${d.inconsistency}`, marginX + 24, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
    }
    y += 1.5;
  });

  if (c.adjustments.length > 0) {
    ensure(14);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Ajustes realizados na competência", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    c.adjustments.forEach((a) => {
      const text = `${brDay(a.date)} · ${KIND_LABEL[a.kind] ?? a.kind}${a.before ? ` · de ${a.before}` : ""}${a.after ? ` para ${a.after}` : ""} · motivo: ${a.reason}`;
      const lines = doc.splitTextToSize(text, 180) as string[];
      ensure(lines.length * 4 + 2);
      doc.text(lines, marginX, y);
      y += lines.length * 4 + 1;
    });
  }

  ensure(14);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("Documento emitido sobre uma revisão autorizada da apuração. A retificação gera nova versão e preserva a anterior.", marginX, y);
  return doc;
}
