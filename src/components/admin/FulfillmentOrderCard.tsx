import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Clock, MapPin, Phone, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import { AGING_COLORS, agingLevel, daysSince, formatDaysLabel } from "@/lib/separation";
import { useFulfillmentStore } from "@/store/fulfillment-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { FulfillmentOrder } from "@/types/fulfillment";

interface FulfillmentOrderCardProps {
  order: FulfillmentOrder;
  phase: "carregar" | "entregar";
}

export function FulfillmentOrderCard({ order, phase }: FulfillmentOrderCardProps) {
  const navigate = useNavigate();
  const startLoading = useFulfillmentStore((state) => state.startLoading);
  const operatorName = useAdminAuthStore((state) => state.session?.user.user_metadata?.name || state.session?.user.email);
  const [starting, setStarting] = useState(false);

  const days = daysSince(order.loadingQueuedAt ?? order.createdAt);
  const aging = agingLevel(days);
  const isMine = Boolean(order.loadingResponsible) && order.loadingResponsible === operatorName;
  const isTakenByOther = Boolean(order.loadingResponsible) && !isMine;
  const loadedCount = order.items.filter((item) => item.loadedAt).length;
  const totalCount = order.items.length;

  async function handleCarregar() {
    if (starting) return;
    setStarting(true);
    const ok = await startLoading(order.id);
    if (ok) {
      navigate(`/admin/carrega-entrega/carregar/${order.id}`);
      return;
    }
    setStarting(false);
  }

  const header = (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-3 sm:px-5", AGING_COLORS[aging])}>
      <span className="text-base font-extrabold">{order.number}</span>
      <span className="flex items-center gap-1 text-xs font-bold">
        <Clock size={13} /> {formatDaysLabel(days)}
      </span>
    </div>
  );

  if (phase === "entregar") {
    const cityLine = [order.neighborhood, order.city].filter(Boolean).join(", ");
    return (
      <button
        type="button"
        onClick={() => navigate(`/admin/carrega-entrega/entregar/${order.id}`)}
        className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white text-left transition-colors hover:border-forest-700/30 hover:bg-forest-950/[0.02]"
      >
        {header}
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          {(order.address || cityLine) && (
            <div className="flex items-start gap-2 rounded-2xl border border-forest-950/10 p-3 text-sm text-ink-900">
              <MapPin size={16} className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="flex flex-col">
                {order.address && <span className="font-semibold">{order.address}</span>}
                {cityLine && <span className="text-ink-muted">{cityLine}</span>}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Building2 size={15} className="shrink-0 text-ink-muted" />
              {order.companyName || order.customerName}
            </div>
            <span className="text-sm font-bold text-ink-900">{formatCurrency(order.totalAmount)}</span>
          </div>
          {order.customerTradeName && <span className="text-xs text-ink-muted">{order.customerTradeName}</span>}
          {order.customerName && (
            <div className="flex items-center gap-2 text-sm text-ink-700/70">
              <User size={15} className="shrink-0 text-ink-muted" />
              {order.customerName}
            </div>
          )}
          {order.phone && (
            <div className="flex items-center gap-2 text-sm text-ink-700/70">
              <Phone size={15} className="shrink-0 text-ink-muted" />
              {order.phone}
            </div>
          )}
          {order.deliveryCountForCustomer > 0 && (
            <span className="text-xs text-ink-muted">
              {order.deliveryCountForCustomer} {order.deliveryCountForCustomer === 1 ? "entrega realizada" : "entregas realizadas"}
            </span>
          )}
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-green-600 px-4 text-sm font-bold text-white">
            ENTREGUE
          </span>
        </div>
      </button>
    );
  }

  const cardBody = (
    <>
      {header}
      <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Building2 size={15} className="shrink-0 text-ink-muted" />
          {order.companyName || order.customerName}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink-900">
            {loadedCount} de {totalCount} produtos
          </span>
          {order.pendingAdjustments.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Ajuste pendente</span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/10">
          <div
            className="h-full rounded-full bg-forest-700 transition-[width]"
            style={{ width: totalCount > 0 ? `${(loadedCount / totalCount) * 100}%` : "0%" }}
          />
        </div>
        {isTakenByOther && <span className="text-xs font-semibold text-ink-muted">Com {order.loadingResponsible}</span>}
      </div>
    </>
  );

  if (isMine) {
    return (
      <button
        type="button"
        onClick={() => navigate(`/admin/carrega-entrega/carregar/${order.id}`)}
        className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white text-left transition-colors hover:border-forest-700/30 hover:bg-forest-950/[0.02]"
      >
        {cardBody}
        <div className="px-4 pb-4 sm:px-5">
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white">
            Continuar
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
      {cardBody}
      <div className="px-4 pb-4 sm:px-5">
        <button
          type="button"
          disabled={isTakenByOther || starting}
          onClick={() => void handleCarregar()}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-green-600 px-4 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:pointer-events-none disabled:opacity-40"
        >
          {starting ? "CARREGANDO..." : "CARREGAR"}
        </button>
      </div>
    </div>
  );
}
