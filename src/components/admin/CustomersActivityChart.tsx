import type { Customer } from "@/types/customer";
import type { Order } from "@/types/order";

const ACTIVE_WINDOW_DAYS = 90;
const RADIUS = 54;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface CustomersActivityChartProps {
  customers: Customer[];
  orders: Order[];
}

export function CustomersActivityChart({ customers, orders }: CustomersActivityChartProps) {
  const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const recentCustomerIds = new Set(
    orders.filter((order) => order.customerId && new Date(order.createdAt).getTime() >= cutoff).map((order) => order.customerId as string)
  );

  const total = customers.length;
  const activeCount = customers.filter((customer) => recentCustomerIds.has(customer.id)).length;
  const inactiveCount = total - activeCount;
  const activePct = total === 0 ? 0 : activeCount / total;

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-forest-950/10 bg-white p-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
        <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-90">
          <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--color-ink-900)" strokeOpacity="0.08" strokeWidth={STROKE} />
          {total > 0 && (
            <circle
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              stroke="var(--color-forest-600)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - activePct)}
            />
          )}
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-extrabold text-forest-950">{total}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/50">Clientes</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Carteira de clientes</p>
          <p className="text-sm text-ink-700/60">Ativos = pelo menos 1 pedido nos últimos {ACTIVE_WINDOW_DAYS} dias.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-forest-600" />
            <span className="text-ink-900">Ativos</span>
            <span className="font-bold text-ink-900">{activeCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-900/20" />
            <span className="text-ink-900">Inativos</span>
            <span className="font-bold text-ink-900">{inactiveCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
