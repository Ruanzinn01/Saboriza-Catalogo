import { jsPDF } from "jspdf";
import type { NextExpiry, StockItem } from "@/lib/stock-insights";
import { situationLabel, stockValue } from "@/lib/stock-insights";
import type { Settings } from "@/types/settings";

export interface StockReportRow {
  code: string;
  name: string;
  group: string;
  controlUnit: string;
  currentStock: number;
  minStock: number;
  situation: string;
  unitCost: number;
  totalValue: number;
  nextBatch: string;
  nextExpiry: string;
  lastMovement: string;
}

export function buildStockReportRows(
  items: StockItem[],
  nextExpiryByMaterial: Map<string, NextExpiry>,
  lastMovementByItem: Map<string, string | null>
): StockReportRow[] {
  return items.map((item) => {
    const lastMovementAt = lastMovementByItem.get(item.id) ?? null;
    const nextExpiry = item.kind === "material" ? nextExpiryByMaterial.get(item.id) : undefined;
    return {
      code: item.code,
      name: item.name,
      group: item.groupLabel,
      controlUnit: item.controlUnit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      situation: situationLabel(item),
      unitCost: item.unitCost,
      totalValue: stockValue(item),
      nextBatch: nextExpiry?.batch || "-----",
      nextExpiry: nextExpiry ? new Date(`${nextExpiry.expiryDate}T00:00:00`).toLocaleDateString("pt-BR") : "-----",
      lastMovement: lastMovementAt ? new Date(lastMovementAt).toLocaleDateString("pt-BR") : "-----",
    };
  });
}

interface Column {
  x: number;
  width: number;
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
    doc.setFontSize(7.5);
    doc.setFont("helvetica", col.bold ? "bold" : "normal");
    const textY = y + height / 2 + 1;
    if (col.align === "right") {
      doc.text(col.value, col.x + col.width - 2, textY, { align: "right" });
    } else {
      doc.text(col.value, col.x + 2, textY);
    }
  });
  return y + height;
}

export function generateStockPdf(rows: StockReportRow[], settings: Settings, filtersLabel: string) {
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
  doc.text(`Relatório de estoque — emitido em ${new Date().toLocaleString("pt-BR")}`, contentX, y + 11);
  doc.setFontSize(8);
  doc.text(`Filtros aplicados: ${filtersLabel}`, contentX, y + 16);
  y += 22;

  const widths = { code: 16, name: 30, group: 18, stock: 16, min: 12, situation: 16, cost: 15, value: 18, batch: 14, expiry: 17, lastMovement: 18 };
  let colX = contentX;
  const positions = Object.values(widths).map((w) => {
    const x = colX;
    colX += w;
    return x;
  });

  function header() {
    y = drawRow(doc, contentX, y, contentWidth, rowH, [
      { x: positions[0], width: widths.code, value: "Código", bold: true },
      { x: positions[1], width: widths.name, value: "Item", bold: true },
      { x: positions[2], width: widths.group, value: "Grupo", bold: true },
      { x: positions[3], width: widths.stock, value: "Estoque", bold: true, align: "right" },
      { x: positions[4], width: widths.min, value: "Mínimo", bold: true, align: "right" },
      { x: positions[5], width: widths.situation, value: "Situação", bold: true },
      { x: positions[6], width: widths.cost, value: "Custo", bold: true, align: "right" },
      { x: positions[7], width: widths.value, value: "Valor total", bold: true, align: "right" },
      { x: positions[8], width: widths.batch, value: "Lote", bold: true },
      { x: positions[9], width: widths.expiry, value: "Validade", bold: true },
      { x: positions[10], width: widths.lastMovement, value: "Últ. mov.", bold: true },
    ]);
  }

  header();
  let totalValue = 0;

  rows.forEach((row) => {
    if (y + rowH > pageHeight - margin) {
      doc.addPage();
      y = margin;
      header();
    }
    totalValue += row.totalValue;
    y = drawRow(doc, contentX, y, contentWidth, rowH, [
      { x: positions[0], width: widths.code, value: row.code },
      { x: positions[1], width: widths.name, value: row.name },
      { x: positions[2], width: widths.group, value: row.group },
      { x: positions[3], width: widths.stock, value: `${row.currentStock} ${row.controlUnit}`, align: "right" },
      { x: positions[4], width: widths.min, value: String(row.minStock), align: "right" },
      { x: positions[5], width: widths.situation, value: row.situation },
      { x: positions[6], width: widths.cost, value: row.unitCost.toFixed(2), align: "right" },
      { x: positions[7], width: widths.value, value: row.totalValue.toFixed(2), align: "right" },
      { x: positions[8], width: widths.batch, value: row.nextBatch },
      { x: positions[9], width: widths.expiry, value: row.nextExpiry },
      { x: positions[10], width: widths.lastMovement, value: row.lastMovement },
    ]);
  });

  y = drawRow(doc, contentX, y, contentWidth, 8, [
    { x: contentX, width: contentWidth - widths.value - widths.batch - widths.expiry - widths.lastMovement, value: `${rows.length} item(ns)`, bold: true },
    { x: positions[7], width: widths.value, value: totalValue.toFixed(2), bold: true, align: "right" },
    { x: positions[8], width: widths.batch, value: "" },
    { x: positions[9], width: widths.expiry, value: "" },
    { x: positions[10], width: widths.lastMovement, value: "" },
  ]);

  return doc;
}

function escapeCsv(value: string) {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildStockCsv(rows: StockReportRow[]) {
  const header = ["Código", "Item", "Grupo", "Unidade", "Estoque", "Mínimo", "Situação", "Custo médio", "Valor total", "Lote", "Validade", "Última movimentação"];
  const lines = rows.map((row) =>
    [
      row.code,
      row.name,
      row.group,
      row.controlUnit,
      String(row.currentStock),
      String(row.minStock),
      row.situation,
      row.unitCost.toFixed(2).replace(".", ","),
      row.totalValue.toFixed(2).replace(".", ","),
      row.nextBatch,
      row.nextExpiry,
      row.lastMovement,
    ]
      .map(escapeCsv)
      .join(";")
  );
  return "﻿" + [header.join(";"), ...lines].join("\n");
}

export function downloadStockCsv(rows: StockReportRow[], filename: string) {
  const blob = new Blob([buildStockCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
