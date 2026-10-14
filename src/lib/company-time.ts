export const DEFAULT_COMPANY_TIMEZONE = "America/Sao_Paulo";

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Converte data e hora digitadas no relógio do fuso da empresa para o instante UTC (ISO), independente do fuso do navegador. */
export function zonedDateTimeToIso(date: string, time: string, timeZone: string = DEFAULT_COMPANY_TIMEZONE): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  let guess = wallAsUtc - offsetMinutes(new Date(wallAsUtc), timeZone) * 60000;
  guess = wallAsUtc - offsetMinutes(new Date(guess), timeZone) * 60000;
  return new Date(guess).toISOString();
}

export function formatTimeInZone(iso: string, timeZone: string = DEFAULT_COMPANY_TIMEZONE): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
}

export function formatDateTimeInZone(iso: string, timeZone: string = DEFAULT_COMPANY_TIMEZONE): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone });
}
