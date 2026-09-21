import { jsPDF } from "jspdf";
import type { ProductionRecord } from "@/types/production";
import type { Product } from "@/types/product";
import type { Settings } from "@/types/settings";

export interface ProductionReportRow {
  code: string;
  name: string;
  packs: number;
  units: number;
  weightKg: number | null;
  confirmedAt: string;
}

export function buildProductionReportRows(
  records: ProductionRecord[],
  productById: Map<string, Product>
): ProductionReportRow[] {
  return records.map((record) => {
    const product = productById.get(record.productId);
    const weightKg = product?.unitWeightGrams ? (product.unitWeightGrams * record.unitsQuantity) / 1000 : null;
    return {
      code: product?.code ?? "-----",
      name: product?.name ?? "-----",
      packs: record.packsQuantity,
      units: record.unitsQuantity,
      weightKg,
      confirmedAt: record.confirmedAt,
    };
  });
}

function formatWeight(kg: number | null) {
  if (kg === null) return "-----";
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}

interface Column {
  x: number;
  width: number;
  label?: string;
  value: string;
  bold?: boolean;
  align?: "left" | "right";
}

function drawRow(doc: jsPDF, x: number, y: number, width: number, height: number, columns: Column[]) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, width, height);

  columns.forEach((col, index) => {
    if (index > 0) doc.line(col.x, y, col.x, y + height);
    const textY = y + height / 2 + 1.1;
    doc.setFontSize(8.5);

    if (col.label) {
      doc.setFont("helvetica", "bold");
      doc.text(col.label, col.x + 2, textY);
      const labelWidth = doc.getTextWidth(`${col.label} `);
      doc.setFont("helvetica", "normal");
      doc.text(col.value, col.x + 2 + labelWidth, textY);
    } else if (col.align === "right") {
      doc.setFont("helvetica", col.bold ? "bold" : "normal");
      doc.text(col.value, col.x + col.width - 2, textY, { align: "right" });
    } else {
      doc.setFont("helvetica", col.bold ? "bold" : "normal");
      doc.text(col.value, col.x + 2, textY);
    }
  });

  return y + height;
}

export function generateProductionPdf(rows: ProductionReportRow[], settings: Settings, periodLabel: string, filtersLabel: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentX = margin;
  const contentWidth = pageWidth - margin * 2;
  const rowH = 6;

  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(settings.factoryName || "Saboriza", contentX, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Relatório de produção", contentX, y + 11);
  y += 16;

  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth / 2, label: "Período:", value: periodLabel },
    { x: contentX + contentWidth / 2, width: contentWidth / 2, label: "Emitido em:", value: new Date().toLocaleString("pt-BR") },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth, label: "Filtros:", value: filtersLabel },
  ]);
  y += 4;

  const colCodeW = 22;
  const colQtyW = 20;
  const colUnitsW = 22;
  const colWeightW = 26;
  const colDateW = 34;
  const colNameW = contentWidth - colCodeW - colQtyW - colUnitsW - colWeightW - colDateW;

  let colX = contentX;
  const positions = [colCodeW, colNameW, colQtyW, colUnitsW, colWeightW, colDateW].map((w) => {
    const x = colX;
    colX += w;
    return x;
  });

  function drawHeader() {
    y = drawRow(doc, contentX, y, contentWidth, rowH, [
      { x: positions[0], width: colCodeW, value: "Código", bold: true },
      { x: positions[1], width: colNameW, value: "Produto", bold: true },
      { x: positions[2], width: colQtyW, value: "Packs", bold: true, align: "right" },
      { x: positions[3], width: colUnitsW, value: "Unidades", bold: true, align: "right" },
      { x: positions[4], width: colWeightW, value: "Peso", bold: true, align: "right" },
      { x: positions[5], width: colDateW, value: "Data", bold: true },
    ]);
  }

  drawHeader();

  let totalUnits = 0;
  let totalWeight = 0;

  rows.forEach((row) => {
    if (y + rowH > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    totalUnits += row.units;
    if (row.weightKg !== null) totalWeight += row.weightKg;
    y = drawRow(doc, contentX, y, contentWidth, rowH, [
      { x: positions[0], width: colCodeW, value: row.code },
      { x: positions[1], width: colNameW, value: row.name },
      { x: positions[2], width: colQtyW, value: String(row.packs), align: "right" },
      { x: positions[3], width: colUnitsW, value: String(row.units), align: "right" },
      { x: positions[4], width: colWeightW, value: formatWeight(row.weightKg), align: "right" },
      { x: positions[5], width: colDateW, value: new Date(row.confirmedAt).toLocaleDateString("pt-BR") },
    ]);
  });

  if (y + 8 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  y = drawRow(doc, contentX, y, contentWidth, 8, [
    { x: contentX, width: colCodeW + colNameW, value: `${rows.length} registro(s)`, bold: true },
    { x: positions[2], width: colQtyW + colUnitsW, value: `${totalUnits} un`, bold: true, align: "right" },
    { x: positions[4], width: colWeightW, value: `${totalWeight.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`, bold: true, align: "right" },
    { x: positions[5], width: colDateW, value: "" },
  ]);

  return doc;
}

function escapeCsvValue(value: string) {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildProductionCsv(rows: ProductionReportRow[]) {
  const header = ["Código", "Produto", "Packs", "Unidades", "Peso (kg)", "Data"];
  const lines = rows.map((row) =>
    [
      row.code,
      row.name,
      String(row.packs),
      String(row.units),
      row.weightKg === null ? "" : row.weightKg.toFixed(2).replace(".", ","),
      new Date(row.confirmedAt).toLocaleDateString("pt-BR"),
    ]
      .map(escapeCsvValue)
      .join(";")
  );
  return "﻿" + [header.join(";"), ...lines].join("\n");
}

export function downloadProductionCsv(rows: ProductionReportRow[], filename: string) {
  const csv = buildProductionCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
