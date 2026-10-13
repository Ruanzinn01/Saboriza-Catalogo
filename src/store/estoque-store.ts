import { create } from "zustand";
import { fromUntyped, rpcUntyped } from "@/lib/supabase-rpc";
import type {
  AdjustmentStatus,
  DivergenceRow,
  LedgerMovementType,
  LedgerRow,
  StockItemType,
  StockPositionItem,
  StockSituation,
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
  min_stock: number;
  max_stock: number;
  avg_cost: number | null;
  stock_value: number | null;
  situation: StockSituation;
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
    minStock: Number(row.min_stock),
    maxStock: Number(row.max_stock),
    avgCost: toNumber(row.avg_cost),
    stockValue: toNumber(row.stock_value),
    situation: row.situation,
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
