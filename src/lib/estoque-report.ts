import { HEALTH_LABEL, ITEM_TYPE_PLURAL, MOVEMENT_LABEL } from "@/lib/estoque";
import type { LedgerMovementType, ReportData, ReportItem, StockPositionItem } from "@/types/estoque";

export function escapeHtml(value: unknown): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (char) => map[char] ?? char);
}

export function positionToReportItems(items: StockPositionItem[]): ReportItem[] {
  return items.map((item) => ({
    item_type: item.itemType,
    sku: item.sku,
    name: item.name,
    category: item.category,
    base_unit: item.baseUnit,
    physical: item.physical,
    reserved: item.reserved,
    available: item.available,
    incoming: item.incoming,
    in_production: item.inProduction,
    unit_cost: item.unitCost,
    stock_value: item.stockValue,
    coverage_days: item.coverageDays,
    net_need: item.netNeed,
    health: item.health,
  }));
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function reportTotals(items: ReportItem[]) {
  return {
    value: items.reduce((sum, item) => sum + (item.stock_value ?? 0), 0),
    withoutCost: items.filter((item) => item.stock_value === null && item.physical > 0).length,
  };
}

function policyLabel(policy: ReportData["policy"]): string {
  if (!policy) return "padrão do sistema (30/45/60 dias)";
  const part = (label: string, p?: { min_days: number; ideal_days: number; max_days: number }) =>
    p ? `${label} ${num(p.min_days)}/${num(p.ideal_days)}/${num(p.max_days)} dias` : "";
  return [part("Produtos", policy.product), part("Matérias-primas", policy.raw_material)].filter(Boolean).join(" · ");
}

// Relatório imprimível/PDF: contexto de empresa, unidade, período, data de geração e política usada (PRD, relatórios e fechamento).
export function buildReportHtml(data: ReportData): string {
  const totals = reportTotals(data.items);
  const rows = data.items
    .map(
      (item) =>
        `<tr><td><b>${escapeHtml(item.name)}</b><br><small>${escapeHtml(item.sku)}</small></td><td>${escapeHtml(ITEM_TYPE_PLURAL[item.item_type])}</td><td>${num(item.physical)} ${escapeHtml(item.base_unit)}</td><td>${num(item.reserved)}</td><td>${num(item.available)}</td><td>${item.stock_value === null ? "Sem custo" : brl(item.stock_value)}</td><td>${item.coverage_days === null ? "—" : num(item.coverage_days) + " dias"}</td><td>${escapeHtml(HEALTH_LABEL[item.health])}</td></tr>`
    )
    .join("");
  const need = data.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${num(item.incoming)} ${escapeHtml(item.base_unit)}</td><td>${num(item.in_production)} ${escapeHtml(item.base_unit)}</td><td>${item.net_need === null ? "Sem base" : num(item.net_need) + " " + escapeHtml(item.base_unit)}</td></tr>`
    )
    .join("");
  const moves = data.movements.length
    ? data.movements
        .map((m) => `<tr><td>${escapeHtml(MOVEMENT_LABEL[m.type as LedgerMovementType] ?? m.type)}</td><td>${m.count}</td><td>${num(m.quantity)}</td></tr>`)
        .join("")
    : "<tr><td colspan=3>Sem movimentos no período.</td></tr>";
  const counted = data.inventory.reduce((sum, s) => sum + s.counted, 0);
  const divergences = data.inventory.reduce((sum, s) => sum + s.divergences, 0);
  const planned = data.inventory.reduce((sum, s) => sum + s.items, 0);
  const accuracyText = counted > 0 ? `${num(((counted - divergences) / counted) * 100)}%` : "sem contagens";
  const lossText = data.losses
    ? `Perdas no período: ${data.losses.count} (${brl(data.losses.total_cost)}${data.losses.unknown_cost > 0 ? `, ${data.losses.unknown_cost} sem custo conhecido` : ""}) · retornos aguardando conferência: ${data.losses.awaiting_returns}`
    : "Sem dados de perdas.";

  return `<h2>${escapeHtml(data.title)}</h2>
<p>${escapeHtml(data.company)} · ${escapeHtml(data.unit)} · ${escapeHtml(data.periodLabel)} · gerado em ${escapeHtml(data.generatedAt)}${data.closed ? " · <b>fotografia de fechamento (imutável)</b>" : " · posição parcial, ainda sujeita a alteração"}</p>
<p><b>Valor físico a custo:</b> ${brl(totals.value)} · <b>Itens:</b> ${data.items.length}${totals.withoutCost > 0 ? ` (${totals.withoutCost} com saldo e sem custo conhecido)` : ""} · <b>Política de cobertura:</b> ${escapeHtml(policyLabel(data.policy))}</p>
<table><thead><tr><th>Item</th><th>Tipo</th><th>Físico</th><th>Reservado</th><th>Disponível</th><th>Valor a custo</th><th>Cobertura</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table>
<h3>Critérios</h3>
<p>Cobertura = disponível ÷ demanda média. Disponível = físico − reservado. A reposição desconta abastecimento confirmado e produção em aberto. Matérias-primas e insumos usam consumo produtivo; produtos usam saídas por pedido separado. Valor em estoque é avaliação a custo (custo médio ponderado) e não equivale a caixa.</p>
<h3>Cobertura e reposição</h3>
<table><thead><tr><th>Item</th><th>A receber</th><th>Em produção</th><th>Reposição líquida</th></tr></thead><tbody>${need}</tbody></table>
<h3>Movimentações do período</h3>
<table><thead><tr><th>Tipo</th><th>Ocorrências</th><th>Quantidade líquida</th></tr></thead><tbody>${moves}</tbody></table>
<h3>Inventário</h3>
<p>Itens previstos: ${planned} · contados: ${counted} · divergências na primeira contagem: ${divergences} · acuracidade: ${accuracyText}. Contagem realizada e acuracidade são medidas diferentes.</p>
<h3>Retornos, perdas e exceções</h3>
<p>${escapeHtml(lossText)}</p>`;
}

// CSV com BOM e ponto e vírgula (abre direto no Excel em pt-BR).
export function buildReportCsv(items: ReportItem[]): string {
  const header = ["Código", "Produto", "Tipo", "Unidade", "Físico", "Reservado", "Disponível", "Custo unitário", "Valor", "Cobertura (dias)", "Situação"];
  const lines = items.map((item) => [
    item.sku,
    item.name,
    ITEM_TYPE_PLURAL[item.item_type],
    item.base_unit,
    item.physical,
    item.reserved,
    item.available,
    item.unit_cost ?? "",
    item.stock_value ?? "",
    item.coverage_days === null ? "" : Math.round(item.coverage_days * 10) / 10,
    HEALTH_LABEL[item.health],
  ]);
  const cell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
  return "﻿" + [header, ...lines].map((row) => row.map(cell).join(";")).join("\r\n");
}
