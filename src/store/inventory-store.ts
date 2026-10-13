import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  InventoryCountResult,
  InventoryCountSession,
  InventoryFilter,
  InventoryItem,
  InventoryResultRow,
  InventoryScope,
  InventorySession,
  InventoryState,
} from "@/types/inventory";

// As funções inventory_* ainda não estão em src/types/supabase.ts (regenerar o arquivo exige reaplicar
// o ajuste de company_id em order_adjustment_requests), então a chamada é tipada aqui.
type RpcResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;
const callRpc = (fn: string, args?: Record<string, unknown>): RpcResult =>
  (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => RpcResult)(fn, args);

interface SessionRow {
  id: string;
  unit_id: string;
  unit_name: string;
  modality: InventorySession["modality"];
  scope_kind: InventoryScope;
  competence: string;
  location_label: string;
  reason: string;
  starts_at: string;
  ends_at: string;
  status: InventorySession["status"];
  total: number;
  counted: number;
  divergences: number;
  pending: number;
  recount: number;
  group1_total: number;
  group1_counted: number;
  group2_total: number;
  group2_counted: number;
  can_manage: boolean;
}

interface ItemRow {
  id: string;
  item_type: InventoryItem["itemType"];
  item_id: string;
  group_no: 1 | 2;
  name: string;
  presentation: string;
  kind_label: string;
  sku: string | null;
  image_url: string | null;
  base_unit: string;
  pack_label: string | null;
  state: InventoryState;
}

interface BeginRow {
  token: string;
  name: string;
  presentation: string;
  kind_label: string;
  sku: string | null;
  image_url: string | null;
  base_unit: string;
  pack_label: string | null;
  pack_factor: number | null;
  divisible: boolean;
}

interface ResultRow {
  session_item_id: string;
  name: string;
  sku: string | null;
  round_no: number;
  base_quantity: number;
  expected_balance: number;
  difference: number;
  counted_by_name: string;
  counted_at: string;
}

interface RegisterRow {
  count_id: string;
  round_no: number;
  base_quantity: number;
  expected_balance: number;
  difference: number;
  replayed: boolean;
}

function toSession(row: SessionRow): InventorySession {
  return {
    id: row.id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    modality: row.modality,
    scopeKind: row.scope_kind,
    competence: row.competence,
    locationLabel: row.location_label,
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    total: row.total,
    counted: row.counted,
    divergences: row.divergences,
    pending: row.pending,
    recount: row.recount,
    group1Total: row.group1_total,
    group1Counted: row.group1_counted,
    group2Total: row.group2_total,
    group2Counted: row.group2_counted,
    canManage: row.can_manage,
  };
}

function toItem(row: ItemRow): InventoryItem {
  return {
    id: row.id,
    itemType: row.item_type,
    itemId: row.item_id,
    groupNo: row.group_no,
    name: row.name,
    presentation: row.presentation,
    kindLabel: row.kind_label,
    sku: row.sku ?? "",
    imageUrl: row.image_url ?? "",
    baseUnit: row.base_unit,
    packLabel: row.pack_label,
    state: row.state,
  };
}

function offlineMessage(): string | null {
  return typeof navigator !== "undefined" && navigator.onLine === false
    ? "Sem conexão: a confirmação do inventário está indisponível."
    : null;
}

interface InventoryState_ {
  sessions: InventorySession[];
  sessionsStatus: "idle" | "loading" | "ready" | "error";
  selectedSessionId: string | null;
  items: InventoryItem[];
  itemsStatus: "idle" | "loading" | "ready" | "error";
  filter: InventoryFilter;
  query: string;
  groupFocus: 1 | 2 | null;
  scrollY: number;
  realtimeChannel: RealtimeChannel | null;

  setFilter: (filter: InventoryFilter) => void;
  setQuery: (query: string) => void;
  setGroupFocus: (group: 1 | 2 | null) => void;
  saveScroll: (scrollY: number) => void;
  fetchSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  fetchItems: (sessionId: string) => Promise<void>;
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;

  createSession: (input: {
    unitId: string;
    modality: "SCHEDULED" | "EXTRAORDINARY";
    scopeKind: InventoryScope;
    startsAt: string;
    endsAt: string;
    reason: string;
    locationLabel: string;
  }) => Promise<string | null>;
  closeSession: (sessionId: string) => Promise<string | null>;
  requestRecount: (sessionItemId: string) => Promise<string | null>;
  beginCount: (sessionItemId: string) => Promise<{ data: InventoryCountSession | null; error: string | null }>;
  releaseItem: (sessionItemId: string) => Promise<void>;
  fetchResults: (sessionId: string) => Promise<{ data: InventoryResultRow[]; error: string | null }>;
  registerCount: (input: {
    commandId: string;
    token: string;
    quantity: number;
    unitMode: "BASE" | "PACK";
    zeroConfirmed: boolean;
  }) => Promise<{ data: InventoryCountResult | null; error: string | null }>;
}

export const useInventoryStore = create<InventoryState_>()((set, get) => ({
  sessions: [],
  sessionsStatus: "idle",
  selectedSessionId: null,
  items: [],
  itemsStatus: "idle",
  filter: "pendentes",
  query: "",
  groupFocus: null,
  scrollY: 0,
  realtimeChannel: null,

  setFilter: (filter) => set({ filter }),
  setQuery: (query) => set({ query }),
  setGroupFocus: (groupFocus) => set({ groupFocus }),
  saveScroll: (scrollY) => set({ scrollY }),

  fetchSessions: async () => {
    if (get().sessions.length === 0) set({ sessionsStatus: "loading" });
    const { data, error } = await callRpc("inventory_list_sessions");
    if (error) {
      set({ sessionsStatus: "error" });
      return;
    }
    const sessions = ((data ?? []) as SessionRow[]).map(toSession);
    const current = get().selectedSessionId;
    const open = sessions.filter((session) => session.status === "OPEN");
    const nextSelected =
      current && sessions.some((session) => session.id === current) ? current : (open[0]?.id ?? null);
    set({ sessions, sessionsStatus: "ready", selectedSessionId: nextSelected });
    if (nextSelected && (nextSelected !== current || get().itemsStatus === "idle")) await get().fetchItems(nextSelected);
  },

  selectSession: async (sessionId) => {
    set({ selectedSessionId: sessionId, items: [], itemsStatus: "idle", groupFocus: null });
    await get().fetchItems(sessionId);
  },

  fetchItems: async (sessionId) => {
    if (get().items.length === 0) set({ itemsStatus: "loading" });
    const { data, error } = await callRpc("inventory_session_items", { p_session_id: sessionId });
    if (get().selectedSessionId !== sessionId) return;
    if (error) {
      set({ itemsStatus: "error" });
      return;
    }
    set({ items: ((data ?? []) as ItemRow[]).map(toItem), itemsStatus: "ready" });
  },

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const refresh = () => {
      void get().fetchSessions();
      const sessionId = get().selectedSessionId;
      if (sessionId) void get().fetchItems(sessionId);
    };
    const channel = supabase
      .channel("separa-confere-inventario")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_session_items" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_sessions" }, refresh)
      .subscribe();
    set({ realtimeChannel: channel });
  },

  unsubscribeRealtime: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ realtimeChannel: null });
    }
  },

  createSession: async (input) => {
    const offline = offlineMessage();
    if (offline) return offline;
    const { error } = await callRpc("inventory_create_session", {
      p_unit_id: input.unitId,
      p_modality: input.modality,
      p_scope_kind: input.scopeKind,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_reason: input.reason,
      p_location_label: input.locationLabel,
    });
    if (error) return error.message;
    set({ itemsStatus: "idle", items: [], selectedSessionId: null });
    await get().fetchSessions();
    return null;
  },

  closeSession: async (sessionId) => {
    const offline = offlineMessage();
    if (offline) return offline;
    const { error } = await callRpc("inventory_close_session", { p_session_id: sessionId });
    if (error) return error.message;
    await get().fetchSessions();
    await get().fetchItems(sessionId);
    return null;
  },

  requestRecount: async (sessionItemId) => {
    const offline = offlineMessage();
    if (offline) return offline;
    const { error } = await callRpc("inventory_request_recount", { p_session_item_id: sessionItemId });
    if (error) return error.message;
    const sessionId = get().selectedSessionId;
    if (sessionId) await get().fetchItems(sessionId);
    return null;
  },

  beginCount: async (sessionItemId) => {
    const offline = offlineMessage();
    if (offline) return { data: null, error: offline };
    const { data, error } = await callRpc("inventory_begin_count", { p_session_item_id: sessionItemId });
    if (error) return { data: null, error: error.message };
    const row = ((data ?? []) as BeginRow[])[0];
    if (!row) return { data: null, error: "Item não encontrado" };
    return {
      data: {
        token: row.token,
        name: row.name,
        presentation: row.presentation,
        kindLabel: row.kind_label,
        sku: row.sku ?? "",
        imageUrl: row.image_url ?? "",
        baseUnit: row.base_unit,
        packLabel: row.pack_label,
        packFactor: row.pack_factor === null ? null : Number(row.pack_factor),
        divisible: row.divisible,
      },
      error: null,
    };
  },

  releaseItem: async (sessionItemId) => {
    await callRpc("inventory_release_item", { p_session_item_id: sessionItemId });
  },

  fetchResults: async (sessionId) => {
    const { data, error } = await callRpc("inventory_session_results", { p_session_id: sessionId });
    if (error) return { data: [], error: error.message };
    return {
      data: ((data ?? []) as ResultRow[]).map((row) => ({
        sessionItemId: row.session_item_id,
        name: row.name,
        sku: row.sku ?? "",
        round: row.round_no,
        baseQuantity: Number(row.base_quantity),
        expectedBalance: Number(row.expected_balance),
        difference: Number(row.difference),
        countedByName: row.counted_by_name,
        countedAt: row.counted_at,
      })),
      error: null,
    };
  },

  registerCount: async ({ commandId, token, quantity, unitMode, zeroConfirmed }) => {
    const offline = offlineMessage();
    if (offline) return { data: null, error: offline };
    const { data, error } = await callRpc("inventory_register_count", {
      p_command_id: commandId,
      p_token: token,
      p_quantity: quantity,
      p_unit_mode: unitMode,
      p_zero_confirmed: zeroConfirmed,
    });
    if (error) return { data: null, error: error.message };
    const row = ((data ?? []) as RegisterRow[])[0];
    if (!row) return { data: null, error: "Não foi possível confirmar o registro" };
    // Só depois da persistência: atualiza lista e progresso a partir do servidor.
    const sessionId = get().selectedSessionId;
    if (sessionId) await Promise.all([get().fetchItems(sessionId), get().fetchSessions()]);
    return {
      data: {
        countId: row.count_id,
        round: row.round_no,
        baseQuantity: Number(row.base_quantity),
        expectedBalance: Number(row.expected_balance),
        difference: Number(row.difference),
        replayed: row.replayed,
      },
      error: null,
    };
  },
}));
