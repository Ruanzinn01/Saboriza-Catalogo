export interface SupplierExportRow {
  id: string;
  trade_name: string;
  company_name: string;
  document: string;
  person_type: string;
  active: boolean;
  city: string;
  state: string;
  contact: string;
  phone: string;
  email: string;
  buyer: string;
  supply_type: string;
  categories: string;
}

export interface FinanceColumns {
  purchasedCents: number;
  paidCents: number;
  openCents: number;
}

// Texto que começa com = + - @ TAB ou CR é lido como fórmula por planilhas: recebe apóstrofo na frente.
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function reais(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface CsvContext {
  scope: string;
  exportedOn: string;
  periodLabel?: string;
}

// Separador ";" e BOM para abrir direto no Excel em pt-BR. As colunas financeiras só entram quando a pessoa tem a permissão
// (sem ela, `finance` vem undefined e as colunas não existem no arquivo).
export function buildSuppliersCsv(rows: SupplierExportRow[], finance: Map<string, FinanceColumns> | undefined, context: CsvContext): string {
  const header = ["Fornecedor", "Razão social", "Documento", "Pessoa", "Situação", "Cidade", "UF", "Contato", "Telefone", "E-mail", "Comprador", "Tipo de fornecimento", "Categorias"];
  if (finance) header.push("Comprado no período", "Pago no período", "Saldo em aberto");
  const lines = rows.map((row) => {
    const cells: unknown[] = [
      row.trade_name || row.company_name,
      row.company_name,
      row.document,
      row.person_type,
      row.active ? "Ativo" : "Inativo",
      row.city,
      row.state,
      row.contact,
      row.phone,
      row.email,
      row.buyer,
      row.supply_type,
      row.categories,
    ];
    if (finance) {
      const f = finance.get(row.id);
      cells.push(f ? reais(f.purchasedCents) : "", f ? reais(f.paidCents) : "", f ? reais(f.openCents) : "");
    }
    return cells.map(csvCell).join(";");
  });
  const meta = [`Escopo: ${context.scope}`, `Exportado em: ${context.exportedOn}`, context.periodLabel ? `Período: ${context.periodLabel}` : ""].filter(Boolean);
  return "﻿" + [meta.map(csvCell).join(";"), header.map(csvCell).join(";"), ...lines].join("\r\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
