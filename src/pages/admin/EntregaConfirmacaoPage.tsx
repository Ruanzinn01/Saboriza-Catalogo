import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, FileText, MapPin, PenLine, Plus, Trash2, Wallet } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { SignatureFullscreen } from "@/components/admin/SignatureFullscreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import { formatCurrency } from "@/lib/currency";
import { countInstallments, formatInstallments } from "@/lib/installments";
import { useFulfillmentStore, type DeliveryEr } from "@/store/fulfillment-store";
import {
  DIVERGENCE_REASON_LABELS,
  RECEIVER_ROLES,
  type DeliveryResult,
  type DivergenceInput,
  type DivergenceReason,
  type ReceiverDocType,
} from "@/types/delivery";
import type { FulfillmentOrder } from "@/types/fulfillment";

const SELECT_CLASS =
  "h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none transition-colors focus:border-forest-700";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
      <h2 className="text-base font-extrabold text-forest-950">{title}</h2>
      {children}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-2xl bg-forest-950/5 px-3 py-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-sm font-extrabold text-ink-900">{value}</span>
    </div>
  );
}

function DocumentRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest-950/10 p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950/5 text-forest-950">{icon}</span>
        <span className="text-sm font-bold text-ink-900">{title}</span>
      </div>
      <span className="text-right text-xs font-semibold text-ink-muted">{detail}</span>
    </div>
  );
}

function OrderSummary({ order }: { order: FulfillmentOrder }) {
  const cityLine = [order.neighborhood, [order.city, order.state].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  const fullAddress = [order.address, cityLine].filter(Boolean).join(", ");
  const tradeName = order.customerTradeName || order.companyName || order.customerName;
  const legalName = order.companyName && order.companyName !== tradeName ? order.companyName : "";
  const installments = countInstallments(order.paymentTerms);
  const deliveries = order.deliveryCountForCustomer;

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
      <div className="flex items-stretch border-b border-forest-950/10">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-4">
          <span className="text-base font-extrabold leading-snug text-ink-900">{order.address || "Endereço não informado"}</span>
          {cityLine && <span className="text-sm text-ink-muted">{cityLine}</span>}
        </div>
        {fullAddress && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir localização no mapa"
            className="flex min-h-11 min-w-20 shrink-0 flex-col items-center justify-center gap-1 border-l border-forest-950/10 px-3 text-forest-700 hover:bg-forest-950/[0.04]"
          >
            <MapPin size={24} />
            <span className="text-[11px] font-bold">Ver no mapa</span>
          </a>
        )}
      </div>
      <div className="flex flex-col gap-1 bg-gold-500/[0.06] px-4 py-4">
        <span className="text-xl font-extrabold leading-tight text-ink-900">{tradeName}</span>
        {legalName && <span className="text-sm text-ink-700/70">{legalName}</span>}
        {order.customerName && order.customerName !== tradeName && <span className="text-sm text-ink-700/70">{order.customerName}</span>}
        {order.phone && <span className="text-sm text-ink-700/70">{order.phone}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        <SummaryTile label="Valor do pedido" value={formatCurrency(order.totalAmount)} />
        <SummaryTile label="Boletos/Parcelas" value={installments !== null ? formatInstallments(installments) : "—"} />
        <SummaryTile label="Pedido" value={`#${order.number}`} />
        <SummaryTile label="Neste local" value={`${deliveries} ${deliveries === 1 ? "entrega" : "entregas"}`} />
      </div>
    </div>
  );
}

function DivergenceEditor({
  order,
  divergences,
  onChange,
}: {
  order: FulfillmentOrder;
  divergences: DivergenceInput[];
  onChange: (next: DivergenceInput[]) => void;
}) {
  const usedIds = new Set(divergences.map((item) => item.orderItemId));
  const available = order.items.filter((item) => !usedIds.has(item.id));

  function update(index: number, patch: Partial<DivergenceInput>) {
    onChange(divergences.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function selectProduct(index: number, orderItemId: string) {
    const item = order.items.find((candidate) => candidate.id === orderItemId);
    if (!item) return;
    update(index, {
      orderItemId: item.id,
      productName: item.productName,
      presentation: item.presentation,
      packQuantity: item.packQuantity,
      packsOrdered: item.packsQuantity,
      packsNotDelivered: Math.min(divergences[index].packsNotDelivered, item.packsQuantity) || 1,
      packPrice: item.packPrice,
    });
  }

  function addDivergence() {
    const item = available[0];
    if (!item) return;
    onChange([
      ...divergences,
      {
        orderItemId: item.id,
        productName: item.productName,
        presentation: item.presentation,
        packQuantity: item.packQuantity,
        packsOrdered: item.packsQuantity,
        packsNotDelivered: 1,
        packPrice: item.packPrice,
        reason: "missing",
        reasonDetail: "",
      },
    ]);
  }

  const totalNotDelivered = divergences.reduce((sum, item) => sum + item.packPrice * item.packsNotDelivered, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">Informe só o que divergiu, em pacotes/caixas. Os demais itens são considerados entregues.</p>
      {divergences.map((item, index) => {
        const selectable = order.items.filter((candidate) => candidate.id === item.orderItemId || !usedIds.has(candidate.id));
        return (
          <div key={item.orderItemId} className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 p-3">
            <div className="flex items-start gap-2">
              <select
                aria-label="Produto"
                className={SELECT_CLASS}
                value={item.orderItemId}
                onChange={(e) => selectProduct(index, e.target.value)}
              >
                {selectable.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.productName}
                    {candidate.presentation ? ` - ${candidate.presentation}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Remover divergência"
                onClick={() => onChange(divergences.filter((_, i) => i !== index))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-600 hover:bg-red-50"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <SummaryTile label="Composição" value={`Pacote c/${item.packQuantity}`} />
              <SummaryTile label="Pedido" value={`${item.packsOrdered} pct`} />
              <SummaryTile label="Preço pacote" value={formatCurrency(item.packPrice)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-900">Não entregue (pacotes)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Diminuir"
                  disabled={item.packsNotDelivered <= 1}
                  onClick={() => update(index, { packsNotDelivered: item.packsNotDelivered - 1 })}
                  className="h-11 w-11 rounded-xl border border-ink-900/15 text-lg font-bold disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-8 text-center text-base font-extrabold">{item.packsNotDelivered}</span>
                <button
                  type="button"
                  aria-label="Aumentar"
                  disabled={item.packsNotDelivered >= item.packsOrdered}
                  onClick={() => update(index, { packsNotDelivered: item.packsNotDelivered + 1 })}
                  className="h-11 w-11 rounded-xl border border-ink-900/15 text-lg font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <SummaryTile label="Valor não entregue" value={formatCurrency(item.packPrice * item.packsNotDelivered)} />
              <SummaryTile label="Valor entregue" value={formatCurrency(item.packPrice * (item.packsOrdered - item.packsNotDelivered))} />
            </div>
            <select
              aria-label="Motivo"
              className={SELECT_CLASS}
              value={item.reason}
              onChange={(e) => update(index, { reason: e.target.value as DivergenceReason })}
            >
              {(Object.keys(DIVERGENCE_REASON_LABELS) as DivergenceReason[]).map((reason) => (
                <option key={reason} value={reason}>
                  {DIVERGENCE_REASON_LABELS[reason]}
                </option>
              ))}
            </select>
            {item.reason === "other" && (
              <Input
                placeholder="Descreva o motivo"
                maxLength={120}
                value={item.reasonDetail}
                onChange={(e) => update(index, { reasonDetail: e.target.value })}
              />
            )}
          </div>
        );
      })}
      <Button variant="outline" disabled={available.length === 0} onClick={addDivergence}>
        <Plus size={16} /> Adicionar produto divergente
      </Button>
      {divergences.length > 0 && (
        <p className="text-sm font-bold text-ink-900">Total não entregue: {formatCurrency(totalNotDelivered)}</p>
      )}
    </div>
  );
}

export function EntregaConfirmacaoPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const order = useFulfillmentStore((state) => state.currentOrder);
  const orderStatus = useFulfillmentStore((state) => state.currentOrderStatus);
  const fetchOrder = useFulfillmentStore((state) => state.fetchOrder);
  const reserveDeliveryEr = useFulfillmentStore((state) => state.reserveDeliveryEr);
  const submitDelivery = useFulfillmentStore((state) => state.submitDelivery);

  const [result, setResult] = useState<DeliveryResult>("COMPLETE");
  const [divergences, setDivergences] = useState<DivergenceInput[]>([]);
  const [receiverName, setReceiverName] = useState("");
  const [docType, setDocType] = useState<ReceiverDocType>("CPF");
  const [doc, setDoc] = useState("");
  const [docTouched, setDocTouched] = useState(false);
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signingOpen, setSigningOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const erRef = useRef<DeliveryEr | null>(null);

  useEffect(() => {
    if (orderId) fetchOrder(orderId);
  }, [orderId, fetchOrder]);

  useEffect(() => {
    if (!signature) {
      setSignaturePreview(null);
      return;
    }
    const url = URL.createObjectURL(signature);
    setSignaturePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [signature]);

  const docValid = docType === "CPF" ? isValidCpf(doc) : doc.trim().length >= 4;
  const divergencesValid =
    result === "COMPLETE" ||
    (divergences.length > 0 && divergences.every((item) => item.reason !== "other" || item.reasonDetail.trim().length > 0));
  const effectiveRole = role === "Outro" ? customRole.trim() : role;
  const canConfirm = useMemo(
    () => receiverName.trim().length >= 3 && docValid && signature !== null && divergencesValid && !confirming,
    [receiverName, docValid, signature, divergencesValid, confirming]
  );

  if (!order || order.id !== orderId) {
    return orderStatus === "loading" || orderStatus === "idle" ? (
      <AdminState variant="loading" message="Carregando pedido..." />
    ) : (
      <AdminState variant="empty" message="Pedido não encontrado." />
    );
  }

  if (order.status !== "COMPLETED" || order.deliveryConfirmedAt) {
    return <AdminState variant="empty" message="Este pedido já teve a entrega registrada." />;
  }

  const currentOrder = order;

  async function handleConfirm() {
    if (!signature || !canConfirm) return;
    setConfirming(true);
    try {
      if (!erRef.current) erRef.current = await reserveDeliveryEr(currentOrder.id);
      if (!erRef.current) return;
      const ok = await submitDelivery(
        currentOrder,
        {
          result,
          receiverName,
          docType,
          doc,
          role: effectiveRole,
          notes,
          divergences: result === "PARTIAL" ? divergences : [],
        },
        signature,
        erRef.current
      );
      if (ok) navigate("/admin/carrega-entrega");
    } catch {
      toast.error("Não foi possível registrar a entrega");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Confirmar entrega" description={`Pedido ${currentOrder.number}`} back={{ to: "/admin/carrega-entrega", label: "Voltar" }} />

      <OrderSummary order={currentOrder} />

      <Section title="Como foi realizada a entrega?">
        <div role="radiogroup" className="flex flex-col gap-2">
          {(
            [
              { key: "COMPLETE", title: "Entrega completa", hint: "Todos os itens foram entregues" },
              { key: "PARTIAL", title: "Entrega parcial", hint: "Alguns itens não foram entregues" },
            ] as { key: DeliveryResult; title: string; hint: string }[]
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={result === option.key}
              onClick={() => setResult(option.key)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-2 text-left transition-colors",
                result === option.key ? "border-forest-700 bg-forest-700 text-cream-50" : "border-forest-950/15 bg-white text-ink-900"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  result === option.key ? "border-cream-50 bg-cream-50 text-forest-700" : "border-ink-900/30"
                )}
              >
                {result === option.key && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-extrabold">{option.title}</span>
                <span className={cn("text-xs", result === option.key ? "text-cream-50/80" : "text-ink-muted")}>{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
        {result === "PARTIAL" && <DivergenceEditor order={currentOrder} divergences={divergences} onChange={setDivergences} />}
      </Section>

      <Section title="Documentos do pedido">
        <DocumentRow icon={<FileText size={18} />} title="Nota fiscal" detail="Não vinculada" />
        <DocumentRow
          icon={<Wallet size={18} />}
          title="Forma de pagamento"
          detail={currentOrder.paymentTerms || "Não informada"}
        />
      </Section>

      <Section title="Quem está recebendo?">
        <Input
          label="Nome completo do recebedor *"
          autoComplete="off"
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Documento *</span>
          <div className="grid grid-cols-2 gap-2">
            {(["CPF", "RG"] as ReceiverDocType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setDocType(type);
                  setDoc("");
                  setDocTouched(false);
                }}
                className={cn(
                  "min-h-11 rounded-xl border text-sm font-bold transition-colors",
                  docType === type ? "border-forest-700 bg-forest-700 text-cream-50" : "border-ink-900/15 bg-white text-ink-900"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <Input
          label={`Número do ${docType} *`}
          inputMode={docType === "CPF" ? "numeric" : "text"}
          autoComplete="off"
          value={doc}
          onChange={(e) => setDoc(docType === "CPF" ? formatCpf(e.target.value) : e.target.value)}
          onBlur={() => setDocTouched(true)}
          error={docTouched && doc.length > 0 && !docValid ? (docType === "CPF" ? "CPF inválido" : "RG inválido") : undefined}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Cargo / Função (opcional)</span>
          <select className={SELECT_CLASS} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Não informar</option>
            {RECEIVER_ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {role === "Outro" && (
          <Input placeholder="Qual cargo/função?" maxLength={40} value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
        )}
      </Section>

      <Section title="Assinatura do responsável *">
        <button
          type="button"
          onClick={() => setSigningOpen(true)}
          className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-ink-900/20 bg-white"
        >
          {signaturePreview ? (
            <img src={signaturePreview} alt="Assinatura do responsável" className="h-full w-full object-contain p-2" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-sm text-ink-muted">
              <PenLine size={22} />
              Toque para assinar
            </span>
          )}
        </button>
        {signature && (
          <button
            type="button"
            onClick={() => setSignature(null)}
            className="flex min-h-11 items-center gap-2 self-start rounded-xl px-3 text-xs font-bold text-ink-muted hover:bg-ink-900/5"
          >
            <Trash2 size={14} /> Limpar assinatura
          </button>
        )}
      </Section>

      <Section title="Observações (opcional)">
        <textarea
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Alguma observação sobre a entrega..."
          className="w-full rounded-xl border border-ink-900/15 bg-white p-3 text-sm text-ink-900 outline-none focus:border-forest-700"
        />
      </Section>

      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={!canConfirm} onClick={() => void handleConfirm()}>
          {confirming ? "Registrando..." : "CONFIRMAR ENTREGA"}
        </Button>
        <Button size="lg" variant="outline" disabled={confirming} onClick={() => navigate("/admin/carrega-entrega")}>
          Voltar
        </Button>
      </div>

      {signingOpen && (
        <SignatureFullscreen
          onCancel={() => setSigningOpen(false)}
          onConfirm={(blob) => {
            setSignature(blob);
            setSigningOpen(false);
          }}
        />
      )}
    </div>
  );
}
