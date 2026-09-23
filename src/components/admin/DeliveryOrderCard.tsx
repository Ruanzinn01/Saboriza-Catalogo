import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { countInstallments, formatInstallments } from "@/lib/installments";
import type { FulfillmentOrder } from "@/types/fulfillment";

interface DeliveryOrderCardProps {
  order: FulfillmentOrder;
}

export function DeliveryOrderCard({ order }: DeliveryOrderCardProps) {
  const navigate = useNavigate();

  const cityLine = [order.neighborhood, [order.city, order.state].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  const fullAddress = [order.address, cityLine].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  const tradeName = order.customerTradeName || order.companyName || order.customerName;
  const legalName = order.companyName && order.companyName !== tradeName ? order.companyName : "";
  const installments = countInstallments(order.paymentTerms);
  const deliveries = order.deliveryCountForCustomer;

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
      <div className="flex items-stretch border-b border-forest-950/10">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-4 sm:px-5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Endereço do pedido</span>
          <span className="text-base font-extrabold leading-snug text-ink-900">{order.address || "Endereço não informado"}</span>
          {cityLine && <span className="text-sm text-ink-muted">{cityLine}</span>}
        </div>
        {fullAddress && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir localização no mapa"
            className="flex min-h-11 min-w-20 shrink-0 flex-col items-center justify-center gap-1 border-l border-forest-950/10 px-3 text-forest-700 transition-colors hover:bg-forest-950/[0.04]"
          >
            <MapPin size={26} />
            <span className="text-[11px] font-bold">Localização</span>
          </a>
        )}
      </div>

      <div className="flex items-stretch border-b border-forest-950/10 bg-gold-500/[0.06]">
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-4 sm:px-5">
          <span className="text-xl font-extrabold leading-tight text-ink-900">{tradeName}</span>
          {legalName && <span className="text-sm text-ink-700/70">{legalName}</span>}
          {order.customerName && order.customerName !== tradeName && (
            <span className="text-sm text-ink-700/70">{order.customerName}</span>
          )}
          {order.phone && <span className="text-sm text-ink-700/70">{order.phone}</span>}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 border-l border-forest-950/10 px-4 py-4 text-right sm:px-5">
          <span className="text-lg font-extrabold text-forest-950">{formatCurrency(order.totalAmount)}</span>
          {installments !== null && <span className="text-xs text-ink-muted">{formatInstallments(installments)}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 px-4 py-3 text-sm text-ink-700/80 sm:px-5">
        <span className="font-mono font-semibold text-ink-900">Pedido #{order.number}</span>
        <span className="text-xs text-ink-muted">
          {deliveries} {deliveries === 1 ? "entrega realizada" : "entregas realizadas"}
        </span>
      </div>

      <div className="px-4 pb-4 sm:px-5">
        <button
          type="button"
          onClick={() => navigate(`/admin/carrega-entrega/entregar/${order.id}`)}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-green-600 px-4 text-base font-extrabold tracking-wide text-white transition-colors hover:bg-green-700"
        >
          ENTREGAR
        </button>
      </div>
    </div>
  );
}
