import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { AGING_COLORS, agingLevel, daysSince, formatDaysLabel } from "@/lib/separation";
import { useSeparationStore } from "@/store/separation-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { SeparationOrder } from "@/types/separation";

interface SeparationOrderCardProps {
  order: SeparationOrder;
}

export function SeparationOrderCard({ order }: SeparationOrderCardProps) {
  const navigate = useNavigate();
  const acceptOrder = useSeparationStore((state) => state.acceptOrder);
  const operatorName = useAdminAuthStore((state) => state.session?.user.user_metadata?.name || state.session?.user.email);
  const [accepting, setAccepting] = useState(false);

  const separatedCount = order.items.filter((item) => item.separatedAt).length;
  const totalCount = order.items.length;
  const days = daysSince(order.queuedAt ?? order.createdAt);
  const aging = agingLevel(days);
  const isMine = Boolean(order.responsible) && order.responsible === operatorName;
  const isTakenByOther = Boolean(order.responsible) && !isMine;

  async function handleAccept() {
    if (accepting) return;
    setAccepting(true);
    const ok = await acceptOrder(order.id);
    if (ok) {
      navigate(`/admin/separa-confere/${order.id}`);
      return;
    }
    setAccepting(false);
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink-900">
            {separatedCount} de {totalCount} produtos
          </span>
          {order.pendingAdjustments.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Ajuste pendente</span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/10">
          <div
            className="h-full rounded-full bg-forest-700 transition-[width]"
            style={{ width: totalCount > 0 ? `${(separatedCount / totalCount) * 100}%` : "0%" }}
          />
        </div>
        {isTakenByOther && <span className="text-xs font-semibold text-ink-muted">Com {order.responsible}</span>}
      </div>
    </>
  );

  if (isMine) {
    return (
      <button
        type="button"
        onClick={() => navigate(`/admin/separa-confere/${order.id}`)}
        className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white text-left transition-colors hover:border-forest-700/30 hover:bg-forest-950/[0.02]"
      >
        {cardBody}
        <div className="px-4 pb-4 sm:px-5">
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white">
            Separar
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
          disabled={isTakenByOther || accepting}
          onClick={handleAccept}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-green-600 px-4 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:pointer-events-none disabled:opacity-40"
        >
          {accepting ? "ACEITANDO..." : "ACEITAR"}
        </button>
      </div>
    </div>
  );
}
