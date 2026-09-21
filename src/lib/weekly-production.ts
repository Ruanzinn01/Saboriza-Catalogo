import type { ProductionRecord } from "@/types/production";

export interface WeeklyProductionPoint {
  day: string;
  date: Date;
  units: number;
}

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function buildWeeklyProduction(records: ProductionRecord[], reference = new Date()): WeeklyProductionPoint[] {
  const startOfWeek = new Date(reference);
  const dayOfWeek = startOfWeek.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const points: WeeklyProductionPoint[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + index);
    return { day: WEEKDAY_SHORT[date.getDay()], date, units: 0 };
  });

  for (const record of records) {
    const recordDate = new Date(record.confirmedAt);
    const point = points.find((item) => item.date.toDateString() === recordDate.toDateString());
    if (point) point.units += record.unitsQuantity;
  }

  return points;
}
