import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/currency";
import { formatCpf } from "@/lib/cpf";
import { countInstallments, formatInstallments } from "@/lib/installments";
import { DIVERGENCE_REASON_LABELS, type DeliveryFormData } from "@/types/delivery";
import type { FulfillmentOrder } from "@/types/fulfillment";
import type { Settings } from "@/types/settings";

const DECLARATION =
  "Declaro o recebimento das mercadorias relacionadas ao Pedido acima, nas condições registradas neste comprovante, bem como a conferência dos documentos apresentados no ato da entrega.";

interface ReceiptInput {
  order: FulfillmentOrder;
  settings: Settings | null;
  erCode: string;
  registeredAt: Date;
  operator: string;
  form: DeliveryFormData;
  signature: Blob;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function generateDeliveryReceiptPdf(input: ReceiptInput): Promise<Blob> {
  const { order, settings, erCode, registeredAt, operator, form, signature } = input;
  const isPartial = form.result === "PARTIAL";
  const signatureUrl = await blobToDataUrl(signature);
  const signatureSize = await imageSize(signatureUrl);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - margin * 2;
  let y = margin;

  function ensureSpace(height: number) {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function heading(text: string) {
    ensureSpace(9);
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(10, 42, 31);
    doc.text(text.toUpperCase(), margin, y + 3);
    doc.setDrawColor(10, 42, 31);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 4.5, margin + width, y + 4.5);
    y += 8;
    doc.setTextColor(0);
  }

  function field(label: string, value: string) {
    if (!value) return;
    doc.setFontSize(9);
    const labelText = `${label}: `;
    doc.setFont("helvetica", "bold");
    const labelWidth = doc.getTextWidth(labelText);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, width - labelWidth) as string[];
    ensureSpace(lines.length * 4.2 + 0.8);
    doc.setFont("helvetica", "bold");
    doc.text(labelText, margin, y + 3);
    doc.setFont("helvetica", "normal");
    doc.text(lines, margin + labelWidth, y + 3);
    y += lines.length * 4.2 + 0.8;
  }

  const issuer = settings?.legalName || settings?.factoryName || "Saboriza";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(issuer, margin, y + 5);
  doc.setFontSize(11);
  doc.text(isPartial ? "COMPROVANTE DE ENTREGA PARCIAL" : "COMPROVANTE DE ENTREGA", pageWidth - margin, y + 5, { align: "right" });
  y += 9;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${erCode}  |  Pedido ${order.number}`, pageWidth - margin, y + 2, { align: "right" });
  doc.text(registeredAt.toLocaleString("pt-BR"), margin, y + 2);
  y += 5;

  heading("Cliente e local de entrega");
  field("Nome Fantasia", order.customerTradeName || order.companyName || order.customerName);
  if (order.companyName && order.companyName !== order.customerTradeName) field("Razão Social", order.companyName);
  field("Endereço", [order.address, order.neighborhood, [order.city, order.state].filter(Boolean).join(" - ")].filter(Boolean).join(", "));
  field("Contato", [order.customerName, order.phone].filter(Boolean).join(" - "));

  heading("Valores e documentos");
  field("Valor do Pedido", formatCurrency(order.totalAmount));
  field("Forma de pagamento", order.paymentTerms);
  const installments = countInstallments(order.paymentTerms);
  if (installments !== null) field("Parcelas", formatInstallments(installments));
  field("NF-e", "Não vinculada ao pedido");

  heading("Operação");
  field("Data/hora do registro", registeredAt.toLocaleString("pt-BR"));
  field("Entregador", operator);
  field("Resultado", isPartial ? "ENTREGA PARCIAL" : "ENTREGA COMPLETA");

  heading("Recebedor");
  field("Nome", form.receiverName.trim());
  field(form.docType, form.docType === "CPF" ? formatCpf(form.doc) : form.doc.trim());
  field("Cargo/Função", form.role);

  if (isPartial) {
    heading("Divergências (pacotes/caixas)");
    let totalNotDelivered = 0;
    form.divergences.forEach((item) => {
      const notDeliveredValue = item.packPrice * item.packsNotDelivered;
      totalNotDelivered += notDeliveredValue;
      const title = `${item.productName}${item.presentation ? ` - ${item.presentation}` : ""} (pacote c/${item.packQuantity})`;
      field("Produto", title);
      const reason = DIVERGENCE_REASON_LABELS[item.reason] + (item.reasonDetail.trim() ? ` - ${item.reasonDetail.trim()}` : "");
      field(
        "Pedido / Não entregue",
        `${item.packsOrdered} / ${item.packsNotDelivered} pacote(s) a ${formatCurrency(item.packPrice)} = ${formatCurrency(notDeliveredValue)} não entregue; ${formatCurrency(item.packPrice * (item.packsOrdered - item.packsNotDelivered))} entregue`
      );
      field("Motivo", reason);
      y += 1.5;
    });
    field("Total não entregue", formatCurrency(totalNotDelivered));
    field("Total entregue", formatCurrency(Math.max(order.totalAmount - totalNotDelivered, 0)));
  }

  if (form.notes.trim()) {
    heading("Observação");
    field("Texto", form.notes.trim());
  }

  heading("Declaração e assinatura");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  const declarationLines = doc.splitTextToSize(`"${DECLARATION}"`, width) as string[];
  ensureSpace(declarationLines.length * 4 + 40);
  doc.text(declarationLines, margin, y + 3);
  y += declarationLines.length * 4 + 4;

  const maxWidth = 80;
  const maxHeight = 30;
  const ratio = signatureSize.width / signatureSize.height;
  let drawWidth = maxWidth;
  let drawHeight = drawWidth / ratio;
  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * ratio;
  }
  doc.addImage(signatureUrl, "PNG", margin, y, drawWidth, drawHeight);
  y += drawHeight + 1;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + maxWidth, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${form.receiverName.trim()} - ${form.docType} ${form.docType === "CPF" ? formatCpf(form.doc) : form.doc.trim()}`, margin, y + 4);
  y += 8;

  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(`${erCode} | Pedido vinculado permanentemente: ${order.id}`, margin, pageHeight - 8);

  return doc.output("blob");
}
