import { AlertTriangle } from "lucide-react";
import type { LineAlerts } from "@/lib/production-alerts";
import { formatNumber } from "@/lib/number";

interface ProductionAlertListProps {
  lineAlerts?: LineAlerts;
}

export function ProductionAlertList({ lineAlerts }: ProductionAlertListProps) {
  if (!lineAlerts) return null;
  const { alerts, recipeMissing } = lineAlerts;
  if (!recipeMissing && alerts.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {recipeMissing && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Sem ficha técnica cadastrada: nenhum insumo será descontado.
        </div>
      )}
      {alerts.map((alert) => (
        <div
          key={alert.rawMaterialId}
          className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            alert.available <= 0 ? "bg-red-500/10 text-red-700" : "bg-amber-500/10 text-amber-700"
          }`}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {alert.name}: precisa {formatNumber(alert.needed, 2)} {alert.controlUnit}, tem {formatNumber(alert.available, 2)}
        </div>
      ))}
    </div>
  );
}
