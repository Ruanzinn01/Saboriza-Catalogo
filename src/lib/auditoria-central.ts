import { supabaseUntyped } from "@/lib/supabase-untyped";

export type AuditActorType = "USER" | "SYSTEM" | "INTEGRATION" | "SUPPORT";

export interface AuditCountItem {
  key: string;
  count: number;
}

export interface AuditOverview {
  from: string;
  to: string;
  total: number;
  human_actors: number;
  system_events: number;
  last_event_at: string | null;
  by_event_type: AuditCountItem[];
  by_entity_type: AuditCountItem[];
  by_actor_type: AuditCountItem[];
  by_day: { day: string; count: number }[];
}

export interface AuditListRow {
  id: string;
  occurred_at: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_type: AuditActorType;
  actor_user_id: string | null;
  correlation_id: string;
  has_payload: boolean;
}

export interface AuditListResult {
  total: number;
  limit: number;
  offset: number;
  rows: AuditListRow[];
}

export interface AuditDetail {
  id: string;
  event_type: string;
  schema_version: number;
  occurred_at: string;
  recorded_at: string;
  entity_type: string;
  entity_id: string;
  actor_type: AuditActorType;
  actor_user_id: string | null;
  employee_id: string | null;
  unit_id: string | null;
  correlation_id: string;
  causation_id: string | null;
  idempotency_key: string | null;
  related_count: number;
  payload_redacted: boolean;
  payload: Record<string, unknown> | null;
}

export interface AuditFilters {
  from: string;
  to: string;
  search: string;
  eventType: string;
  entityType: string;
  actorType: string;
}

export const AUDIT_PAGE_SIZES = [10, 25, 50, 100] as const;

export const AUDIT_UNAVAILABLE = {
  modulo: "Módulo: indisponível (audit_events não tem coluna de módulo).",
  nivel: "Nível/severidade: indisponível (sem classificação gravada nos eventos).",
  antesDepois: "Antes/Depois estruturados: indisponíveis (o conteúdo vive no payload livre, visível só com permissão sensível).",
  integridade: "Hash e cadeia de integridade: indisponíveis (sem coluna de hash).",
  motivo: "Motivo: indisponível como campo próprio (pode constar no payload).",
} as const;

export const ACTOR_LABELS: Record<AuditActorType, string> = {
  USER: "Usuário",
  SYSTEM: "Sistema",
  INTEGRATION: "Integração",
  SUPPORT: "Suporte",
};

export function dateInputToIso(value: string, endOfDay: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToDateInput(iso: Date): string {
  const y = iso.getFullYear();
  const m = String(iso.getMonth() + 1).padStart(2, "0");
  const d = String(iso.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultAuditFilters(now: Date = new Date(), days = 30): AuditFilters {
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { from: isoToDateInput(start), to: isoToDateInput(now), search: "", eventType: "", entityType: "", actorType: "" };
}

export function filtersToRpcArgs(filters: AuditFilters, limit: number, page: number) {
  return {
    p_from: dateInputToIso(filters.from, false),
    p_to: dateInputToIso(filters.to, true),
    p_search: filters.search.trim() || null,
    p_event_type: filters.eventType || null,
    p_entity_type: filters.entityType || null,
    p_actor_type: filters.actorType || null,
    p_limit: limit,
    p_offset: Math.max(0, (Math.max(1, page) - 1) * limit),
  };
}

export function totalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, limit)));
}

export function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "-";
}

export function actorLabel(actorType: AuditActorType, userId: string | null): string {
  if (actorType === "USER") return userId ? `Usuário ${shortId(userId)}` : "Usuário (não identificado)";
  return ACTOR_LABELS[actorType] ?? actorType;
}

export function fillDailySeries(series: { day: string; count: number }[], from: string, to: string): { day: string; count: number }[] {
  const byDay = new Map(series.map((item) => [item.day, item.count]));
  const result: { day: string; count: number }[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return series;
  for (let cursor = new Date(start); cursor <= end && result.length < 400; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    result.push({ day, count: byDay.get(day) ?? 0 });
  }
  return result;
}

interface RpcResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = (await supabaseUntyped.rpc(fn, args)) as RpcResponse<T>;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Resposta vazia da auditoria");
  return data;
}

export const auditoriaCentral = {
  overview: (filters: AuditFilters) =>
    call<AuditOverview>("audit_central_overview", {
      p_from: dateInputToIso(filters.from, false),
      p_to: dateInputToIso(filters.to, true),
    }),
  list: (filters: AuditFilters, limit: number, page: number) => call<AuditListResult>("audit_central_list", filtersToRpcArgs(filters, limit, page)),
  detail: (id: string) => call<AuditDetail>("audit_central_detail", { p_id: id }),
};
