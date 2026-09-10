import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/currency";
import { calculateLineTotal } from "@/lib/pricing";
import type { Order } from "@/types/order";
import type { Settings } from "@/types/settings";

const LOGO_URL = "/brand/logo-saboriza-transparente.png";

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
    if (index > 0) {
      doc.line(col.x, y, col.x, y + height);
    }
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

export async function generateOrderPdf(order: Order, settings: Settings): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentX = margin;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Cabecalho: nome da fabrica + numero do pedido a esquerda, logo a direita
  const headerHeight = 26;
  doc.rect(contentX, y, contentWidth, headerHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(settings.factoryName || "Saboriza", contentX + contentWidth * 0.35, y + 11, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Pedido Nº ${order.number.replace("#", "")}`, contentX + contentWidth * 0.35, y + 18, { align: "center" });

  const logoDataUrl = await loadImageAsDataUrl(LOGO_URL);
  if (logoDataUrl) {
    const logoSize = 20;
    doc.addImage(logoDataUrl, "PNG", contentX + contentWidth - logoSize - 3, y + 3, logoSize, logoSize);
  }
  y += headerHeight;

  // Bloco Representada (dados da Saboriza)
  const rowH = 6;
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth, label: "Representada:", value: settings.legalName || settings.factoryName },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth, label: "CNPJ:", value: settings.cnpj || "-----" },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth, label: "Telefone:", value: settings.whatsappDisplay },
  ]);

  // Bloco Cliente
  const halfX = contentX + contentWidth / 2;
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth / 2, label: "Cliente:", value: order.customer.company },
    { x: halfX, width: contentWidth / 2, label: "Nome Fantasia:", value: order.customer.tradeName || "-----" },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth / 2, label: "CNPJ:", value: order.customer.cnpj || "-----" },
    { x: halfX, width: contentWidth / 2, label: "Inscrição Estadual:", value: order.customer.ie || "-----" },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth, label: "Endereço:", value: order.customer.address || "-----" },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth / 2, label: "Bairro:", value: order.customer.neighborhood || "-----" },
    { x: halfX, width: contentWidth / 2, label: "CEP:", value: order.customer.cep || "-----" },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth / 2, label: "Cidade:", value: order.customer.city || "-----" },
    { x: halfX, width: contentWidth / 2, label: "Estado:", value: order.customer.state || "-----" },
  ]);
  y = drawRow(doc, contentX, y, contentWidth, rowH, [
    { x: contentX, width: contentWidth / 2, label: "Telefone:", value: order.customer.phone },
    { x: halfX, width: contentWidth / 2, label: "E-mail:", value: order.customer.email || "-----" },
  ]);

  // Tabela de itens
  const colIndexW = 8;
  const colQtyW = 18;
  const colUnitW = 16;
  const colPriceW = 26;
  const colSubtotalW = 26;

  const headerRowH = 6;
  const productColW = contentWidth - colIndexW - colQtyW - colUnitW - colPriceW - colSubtotalW;
  let colX = contentX;
  const positions = [colIndexW, productColW, colQtyW, colUnitW, colPriceW, colSubtotalW].map((w) => {
    const x = colX;
    colX += w;
    return x;
  });

  y = drawRow(doc, contentX, y, contentWidth, headerRowH, [
    { x: positions[0], width: colIndexW, value: "#", bold: true },
    { x: positions[1], width: productColW, value: "Produto", bold: true },
    { x: positions[2], width: colQtyW, value: "Qtde.", bold: true },
    { x: positions[3], width: colUnitW, value: "Unidade", bold: true },
    { x: positions[4], width: colPriceW, value: "Preço", bold: true, align: "right" },
    { x: positions[5], width: colSubtotalW, value: "Subtotal", bold: true, align: "right" },
  ]);

  order.items.forEach((item, index) => {
    const units = item.packs * item.packQuantity;
    const lineTotal = calculateLineTotal(item.unitPrice, item.packQuantity, item.packs);
    const productLabel = `${item.name} — ${item.presentation} · ${item.weight}`;
    y = drawRow(doc, contentX, y, contentWidth, headerRowH, [
      { x: positions[0], width: colIndexW, value: String(index + 1) },
      { x: positions[1], width: productColW, value: productLabel },
      { x: positions[2], width: colQtyW, value: String(units) },
      { x: positions[3], width: colUnitW, value: "Un" },
      { x: positions[4], width: colPriceW, value: formatCurrency(item.unitPrice), align: "right" },
      { x: positions[5], width: colSubtotalW, value: formatCurrency(lineTotal), align: "right" },
    ]);
  });

  // Subtotal / desconto (só quando houver cupom aplicado)
  if (order.discountAmount > 0) {
    y = drawRow(doc, contentX, y, contentWidth, rowH, [
      { x: contentX, width: contentWidth - colSubtotalW, value: "Subtotal:", align: "right" },
      { x: contentX + contentWidth - colSubtotalW, width: colSubtotalW, value: formatCurrency(order.subtotal), align: "right" },
    ]);
    y = drawRow(doc, contentX, y, contentWidth, rowH, [
      { x: contentX, width: contentWidth - colSubtotalW, value: `Desconto (${order.couponCode}):`, align: "right" },
      {
        x: contentX + contentWidth - colSubtotalW,
        width: colSubtotalW,
        value: `- ${formatCurrency(order.discountAmount)}`,
        align: "right",
      },
    ]);
  }

  // Valor total
  const totalRowH = 8;
  y = drawRow(doc, contentX, y, contentWidth, totalRowH, [
    { x: contentX, width: contentWidth - colSubtotalW, value: "Valor total:", bold: true, align: "right" },
    { x: contentX + contentWidth - colSubtotalW, width: colSubtotalW, value: formatCurrency(order.total), bold: true, align: "right" },
  ]);

  // Rodape: condicao de pagamento + data de emissao
  const footerRowH = 10;
  const issueDate = new Date(order.createdAt).toLocaleDateString("pt-BR");
  y = drawRow(doc, contentX, y, contentWidth, footerRowH, [
    { x: contentX, width: contentWidth / 2, label: "Condição de Pagamento:", value: order.paymentTerms || "-----" },
    { x: halfX, width: contentWidth / 2, label: "Data de Emissão:", value: issueDate },
  ]);

  return doc;
}
