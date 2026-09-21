import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Factory } from "lucide-react";
import { useProductionStore } from "@/store/production-store";
import { buildWeeklyProduction } from "@/lib/weekly-production";

export function ProductionSummaryCard() {
  const records = useProductionStore((state) => state.records);
  const fetchRecords = useProductionStore((state) => state.fetchRecords);

  useEffect(() => {
    if (records.length === 0) fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weeklyData = useMemo(() => buildWeeklyProduction(records), [records]);
  const totalWeek = weeklyData.reduce((sum, point) => sum + point.units, 0);
  const max = Math.max(...weeklyData.map((point) => point.units), 1);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
            <Factory size={18} />
          </span>
          <p className="text-sm font-bold text-forest-950">Produção da semana</p>
        </div>
        <Link to="/admin/producao" className="text-xs font-semibold text-forest-700 hover:underline">
          Ver tudo
        </Link>
      </div>
      <p className="text-2xl font-extrabold text-forest-950">{totalWeek} un</p>
      <div className="flex h-10 items-end gap-1">
        {weeklyData.map((point) => (
          <div key={point.day} className="flex-1 rounded-t bg-forest-700/60" style={{ height: `${(point.units / max) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}
