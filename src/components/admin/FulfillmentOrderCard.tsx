import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Clock } from "lucide-react";
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

  const cardBody = (
    <>
      <div className={cn("flex items-center justify-between gap-3 px-4 py-3 sm:px-5", AGING_COLORS[aging])}>
        <span className="text-base font-extrabold">{order.number}</span>
        <span className="flex items-center gap-1 text-xs font-bold">
          <Clock size={13} /> {formatDaysLabel(days)}
        </span>
      </div>
      <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Building2 size={15} className="shrink-0 text-ink-muted" />
          {order.companyName || order.customerName}
        </div>
        <span className="text-sm font-bold text-ink-900">{formatCurrency(order.totalAmount)}</span>
        {phase === "carregar" && isTakenByOther && <span className="text-xs font-semibold text-ink-muted">Com {order.loadingResponsible}</span>}
      </div>
    </>
  );

  if (phase === "entregar") {
    return (
      <button
        type="button"
        onClick={() => navigate(`/admin/carrega-entrega/entregar/${order.id}`)}
        className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white text-left transition-colors hover:border-forest-700/30 hover:bg-forest-950/[0.02]"
      >
        {cardBody}
        <div className="px-4 pb-4 sm:px-5">
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white">
            Entregar
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
