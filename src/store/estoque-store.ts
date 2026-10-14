import { create } from "zustand";
import { fromUntyped, rpcUntyped } from "@/lib/supabase-rpc";
import type {
  AdjustmentStatus,
  DivergenceRow,
  LedgerMovementType,
  LedgerRow,
  LossKind,
  LossRow,
  StockHealth,
  StockItemType,
  StockPolicyRow,
  StockPositionItem,
  StockReturnRow,
} from "@/types/estoque";

interface PositionRow {
  item_type: StockItemType;
  item_id: string;
  sku: string | null;
  name: string;
  category: string | null;
  base_unit: string;
  is_active: boolean;
  physical: number;
  reserved: number;
  available: number;
  incoming: number;
  in_production: number;
  min_stock: number;
  max_stock: number;
  daily_rate: number | null;
  history_days: number;
  coverage_days: number | null;
  net_need: number | null;
  unit_cost: number | null;
  stock_value: number | null;
  excess_qty: number;
  excess_value: number;
  idle_days: number | null;
  health: StockHealth;
  policy_min: number;
  policy_ideal: number;
  policy_max: number;
}

interface ReturnDbRow {
  id: string;
  source: StockReturnRow["source"];
  source_ref: string;
  product_id: string;
  expected_units: number;
  status: StockReturnRow["status"];
  good_units: number | null;
  bad_units: number | null;
  notes: string | null;
  created_at: string;
}

interface LossDbRow {
  id: string;
  item_type: StockItemType;
  item_id: string;
  item_name: string;
  quantity: number;
  kind: LossKind;
  occurred_on: string;
  reason: string;
  unit_cost: number | null;
  total_cost: number | null;
  source: LossRow["source"];
}

interface PolicyDbRow {
  id: string;
  unit_id: string;
  scope: StockPolicyRow["scope"];
  min_days: number;
  ideal_days: number;
  max_days: number;
  justification: string;
  created_at: string;
}

interface LedgerDbRow {
  ledger_id: string;
  item_type: StockItemType;
  item_id: string;
  movement_type: LedgerMovementType;
  quantity: number;
  previous_balance: number | null;
  new_balance: number | null;
  source_kind: string;
  source_id: string | null;
  note: string | null;
  occurred_at: string;
  unit_cost: number | null;
}

interface DivergenceDbRow {
  count_id: string;
  session_item_id: string;
  item_type: StockItemType;
  name: string;
  sku: string | null;
  round_no: number;
  is_latest: boolean;
  base_quantity: number;
  expected_balance: number;
  difference: number;
  counted_by_name: string;
  counted_at: string;
  adjustment_status: AdjustmentStatus;
  resolution_justification: string | null;
}

const toNumber = (value: number | string | null): number | null => (value === null ? null : Number(value));

function toPosition(row: PositionRow): StockPositionItem {
  return {
    itemType: row.item_type,
    itemId: row.item_id,
    sku: row.sku ?? "",
    name: row.name,
    category: row.category ?? "",
    baseUnit: row.base_unit,
    isActive: row.is_active,
    physical: Number(row.physical),
    reserved: Number(row.reserved),
    available: Number(row.available),
    incoming: Number(row.incoming),
    inProduction: Number(row.in_production),
    minStock: Number(row.min_stock),
    maxStock: Number(row.max_stock),
    dailyRate: toNumber(row.daily_rate),
    historyDays: Number(row.history_days),
    coverageDays: toNumber(row.coverage_days),
    netNeed: toNumber(row.net_need),
    unitCost: toNumber(row.unit_cost),
    stockValue: toNumber(row.stock_value),
    excessQty: Number(row.excess_qty),
    excessValue: Number(row.excess_value),
    idleDays: row.idle_days,
    health: row.health,
    policyMin: Number(row.policy_min),
    policyIdeal: Number(row.policy_ideal),
    policyMax: Number(row.policy_max),
  };
}

function toLedger(row: LedgerDbRow): LedgerRow {
  return {
    ledgerId: row.ledger_id,
    itemType: row.item_type,
    itemId: row.item_id,
    movementType: row.movement_type,
    quantity: Number(row.quantity),
    previousBalance: toNumber(row.previous_balance),
    newBalance: toNumber(row.new_balance),
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    note: row.note ?? "",
    occurredAt: row.occurred_at,
    unitCost: toNumber(row.unit_cost),
  };
}

function toDivergence(row: DivergenceDbRow): DivergenceRow {
  return {
    countId: row.count_id,
    sessionItemId: row.session_item_id,
    itemType: row.item_type,
    name: row.name,
    sku: row.sku ?? "",
    round: row.round_no,
    isLatest: row.is_latest,
    baseQuantity: Number(row.base_quantity),
    expectedBalance: Number(row.expected_balance),
    difference: Number(row.difference),
    countedByName: row.counted_by_name,
    countedAt: row.counted_at,
    adjustmentStatus: row.adjustment_status,
    justification: row.resolution_justification,
  };
}

export const LEDGER_PAGE_SIZE = 300;

interface EstoqueState {
  position: StockPositionItem[];
  positionStatus: "idle" | "loading" | "ready" | "error";
  ledger: LedgerRow[];
  ledgerStatus: "idle" | "loading" | "ready" | "error";
  ledgerTruncated: boolean;
  divergences: DivergenceRow[];
  divergencesStatus: "idle" | "loading" | "ready" | "error";
  divergencesError: string | null;
  policies: StockPolicyRow[];
  returns: StockReturnRow[];
  losses: LossRow[];

  fetchReturns: () => Promise<void>;
  fetchLosses: () => Promise<void>;
  confirmReturn: (input: { returnId: string; goodUnits: number; notes: string; received: boolean }) => Promise<string | null>;
  registerLoss: (input: { itemType: StockItemType; itemId: string; quantity: number; kind: LossKind; occurredOn: string; reason: string }) => Promise<string | null>;
  fetchPolicies: () => Promise<void>;
  savePolicy: (input: { unitId: string; scope: StockPolicyRow["scope"]; minDays: number; idealDays: number; maxDays: number; justification: string }) => Promise<string | null>;
  fetchPosition: () => Promise<void>;
  fetchLedger: (filters?: { itemType?: StockItemType; itemId?: string; movementTypes?: LedgerMovementType[] }) => Promise<void>;
  fetchDivergences: (sessionId: string) => Promise<void>;
  resolveDivergence: (countId: string, action: "APPROVE" | "DISMISS", justification: string) => Promise<string | null>;
}

export const useEstoqueStore = create<EstoqueState>()((set, get) => ({
  position: [],
  positionStatus: "idle",
  ledger: [],
  ledgerStatus: "idle",
  ledgerTruncated: false,
  divergences: [],
  divergencesStatus: "idle",
  divergencesError: null,
  policies: [],
  returns: [],
  losses: [],

  fetchReturns: async () => {
    const [{ data }, productsResult] = await Promise.all([
      fromUntyped("stock_returns").select("*").order("created_at", { ascending: false }).limit(100),
      fromUntyped("products").select("id, name"),
    ]);
    const names = new Map(((productsResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
    set({
      returns: ((data ?? []) as ReturnDbRow[]).map((row) => ({
        id: row.id,
        source: row.source,
        sourceRef: row.source_ref,
        productId: row.product_id,
        productName: names.get(row.product_id) ?? "Produto",
        expectedUnits: Number(row.expected_units),
        status: row.status,
        goodUnits: toNumber(row.good_units),
        badUnits: toNumber(row.bad_units),
        notes: row.notes ?? "",
        createdAt: row.created_at,
      })),
    });
  },

  fetchLosses: async () => {
    const { data } = await fromUntyped("stock_loss_records").select("*").order("occurred_on", { ascending: false }).limit(100);
    set({
      losses: ((data ?? []) as LossDbRow[]).map((row) => ({
        id: row.id,
        itemType: row.item_type,
        itemId: row.item_id,
        itemName: row.item_name,
        quantity: Number(row.quantity),
        kind: row.kind,
        occurredOn: row.occurred_on,
        reason: row.reason,
        unitCost: toNumber(row.unit_cost),
        totalCost: toNumber(row.total_cost),
        source: row.source,
      })),
    });
  },

  confirmReturn: async ({ returnId, goodUnits, notes, received }) => {
    const { error } = await rpcUntyped("confirm_stock_return", { p_return_id: returnId, p_good: goodUnits, p_notes: notes, p_received: received });
    if (error) return error.message;
    await Promise.all([get().fetchReturns(), get().fetchLosses(), get().fetchPosition()]);
    return null;
  },

  registerLoss: async ({ itemType, itemId, quantity, kind, occurredOn, reason }) => {
    const { error } = await rpcUntyped("register_stock_loss", {
      p_item_type: itemType,
      p_item_id: itemId,
      p_quantity: quantity,
      p_kind: kind,
      p_occurred_on: occurredOn,
      p_reason: reason,
    });
    if (error) return error.message;
    await Promise.all([get().fetchLosses(), get().fetchPosition()]);
    return null;
  },

  fetchPolicies: async () => {
    const { data } = await fromUntyped("stock_policies").select("*").order("created_at", { ascending: false }).limit(50);
    set({
      policies: ((data ?? []) as PolicyDbRow[]).map((row) => ({
        id: row.id,
        unitId: row.unit_id,
        scope: row.scope,
        minDays: Number(row.min_days),
        idealDays: Number(row.ideal_days),
        maxDays: Number(row.max_days),
        justification: row.justification,
        createdAt: row.created_at,
      })),
    });
  },

  savePolicy: async ({ unitId, scope, minDays, idealDays, maxDays, justification }) => {
    const { error } = await rpcUntyped("set_stock_policy", {
      p_unit_id: unitId,
      p_scope: scope,
      p_min: minDays,
      p_ideal: idealDays,
      p_max: maxDays,
      p_justification: justification,
    });
    if (error) return error.message;
    await Promise.all([get().fetchPolicies(), get().fetchPosition()]);
    return null;
  },

  fetchPosition: async () => {
    if (get().position.length === 0) set({ positionStatus: "loading" });
    const { data, error } = await rpcUntyped("stock_position");
    if (error) {
      set({ positionStatus: "error" });
      return;
    }
    set({ position: ((data ?? []) as PositionRow[]).map(toPosition), positionStatus: "ready" });
  },

  fetchLedger: async (filters) => {
    set({ ledgerStatus: "loading" });
    let query = fromUntyped("stock_ledger")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(LEDGER_PAGE_SIZE + 1);
    if (filters?.itemType) query = query.eq("item_type", filters.itemType);
    if (filters?.itemId) query = query.eq("item_id", filters.itemId);
    if (filters?.movementTypes && filters.movementTypes.length > 0) query = query.in("movement_type", filters.movementTypes);
    const { data, error } = await query;
    if (error) {
      set({ ledgerStatus: "error" });
      return;
    }
    const rows = ((data ?? []) as LedgerDbRow[]).map(toLedger);
    set({ ledger: rows.slice(0, LEDGER_PAGE_SIZE), ledgerTruncated: rows.length > LEDGER_PAGE_SIZE, ledgerStatus: "ready" });
  },

  fetchDivergences: async (sessionId) => {
    set({ divergencesStatus: "loading", divergencesError: null });
    const { data, error } = await rpcUntyped("inventory_session_results", { p_session_id: sessionId });
    if (error) {
      set({ divergencesStatus: "error", divergencesError: error.message, divergences: [] });
      return;
    }
    set({ divergences: ((data ?? []) as DivergenceDbRow[]).map(toDivergence), divergencesStatus: "ready" });
  },

  resolveDivergence: async (countId, action, justification) => {
    const { error } = await rpcUntyped("inventory_resolve_divergence", {
      p_count_id: countId,
      p_action: action,
      p_justification: justification,
    });
    if (error) return error.message;
    return null;
  },
}));
