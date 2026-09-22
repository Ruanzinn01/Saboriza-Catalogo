import { create } from "zustand";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { AdjustmentRequest, SeparationItem, SeparationOrder } from "@/types/separation";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  company_name: string;
  total_units: number;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NEW" | "IN_REVIEW";
  separation_queued_at: string | null;
  separation_started_at: string | null;
  separation_finished_at: string | null;
  separation_responsible: string | null;
  separation_started_by: string | null;
  separation_completed_by: string | null;
}

interface ItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  presentation: string;
  weight_volume: string;
  total_units: number;
  separated_at: string | null;
}

interface ProductRow {
  id: string;
  image_url: string;
  code: string | null;
  gtin: string;
}

interface AdjustmentRow {
  id: string;
  order_id: string;
  order_item_id: string | null;
  message: string;
  status: "pending" | "resolved";
  created_by: string | null;
  created_at: string;
}

function currentOperatorName(): string {
  const session = useAdminAuthStore.getState().session;
  return (session?.user.user_metadata?.name as string | undefined) || session?.user.email || "Operador";
}

function buildOrders(orderRows: OrderRow[], itemRows: ItemRow[], productRows: ProductRow[], adjustmentRows: AdjustmentRow[]): SeparationOrder[] {
  const productsById = new Map(productRows.map((product) => [product.id, product]));
  return orderRows.map((row) => {
    const items: SeparationItem[] = itemRows
      .filter((item) => item.order_id === row.id)
      .map((item) => {
        const product = item.product_id ? productsById.get(item.product_id) : undefined;
        return {
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          presentation: item.presentation,
          weightVolume: item.weight_volume,
          imageUrl: product?.image_url ?? "",
          code: product?.code ?? null,
          gtin: product?.gtin || null,
          totalUnits: item.total_units,
          separatedAt: item.separated_at,
        };
      });
    const pendingAdjustments: AdjustmentRequest[] = adjustmentRows
      .filter((adjustment) => adjustment.order_id === row.id && adjustment.status === "pending")
      .map((adjustment) => ({
        id: adjustment.id,
        orderId: adjustment.order_id,
        orderItemId: adjustment.order_item_id,
        message: adjustment.message,
        status: adjustment.status,
        createdBy: adjustment.created_by,
        createdAt: adjustment.created_at,
      }));

    return {
      id: row.id,
      number: row.order_number,
      createdAt: row.created_at,
      customerName: row.customer_name,
      companyName: row.company_name,
      totalUnits: row.total_units,
      status: row.status as SeparationOrder["status"],
      queuedAt: row.separation_queued_at,
      startedAt: row.separation_started_at,
      finishedAt: row.separation_finished_at,
      responsible: row.separation_responsible,
      startedBy: row.separation_started_by,
      completedBy: row.separation_completed_by,
      items,
      pendingAdjustments,
    };
  });
}

async function loadOrdersWithDetails(statuses: OrderRow["status"][], limit?: number) {
  let query = supabase.from("orders").select("*").in("status", statuses).order("created_at", { ascending: statuses.includes("CONFIRMED") });
  if (limit) query = query.limit(limit);
  const { data: orderRows, error: orderError } = await query;
  if (orderError || !orderRows) throw orderError;

  const orderIds = orderRows.map((row) => row.id);
  if (orderIds.length === 0) return { orderRows: orderRows as OrderRow[], itemRows: [] as ItemRow[], productRows: [] as ProductRow[], adjustmentRows: [] as AdjustmentRow[] };

  const [{ data: itemRows, error: itemError }, { data: adjustmentRows, error: adjustmentError }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, order_id, product_id, product_name, presentation, weight_volume, total_units, separated_at")
      .in("order_id", orderIds),
    supabase
      .from("order_adjustment_requests")
      .select("id, order_id, order_item_id, message, status, created_by, created_at")
      .in("order_id", orderIds),
  ]);
  if (itemError || !itemRows) throw itemError;
  if (adjustmentError || !adjustmentRows) throw adjustmentError;

  const productIds = [...new Set(itemRows.map((item) => item.product_id).filter((id): id is string => Boolean(id)))];
  const { data: productRows, error: productError } =
    productIds.length > 0
      ? await supabase.from("products").select("id, image_url, code, gtin").in("id", productIds)
      : { data: [] as ProductRow[], error: null };
  if (productError) throw productError;

  return { orderRows: orderRows as OrderRow[], itemRows: itemRows as ItemRow[], productRows: (productRows ?? []) as ProductRow[], adjustmentRows: adjustmentRows as AdjustmentRow[] };
}

interface SeparationState {
  queue: SeparationOrder[];
  queueStatus: "idle" | "loading" | "ready" | "error";
  history: SeparationOrder[];
  historyStatus: "idle" | "loading" | "ready" | "error";
  unseenOrderIds: Set<string>;
  realtimeChannel: RealtimeChannel | null;

  fetchQueue: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;
  markSeen: (orderId: string) => void;

  acceptOrder: (orderId: string) => Promise<boolean>;
  releaseOrder: (orderId: string) => Promise<void>;
  confirmItem: (orderId: string, itemId: string) => Promise<void>;
  undoItem: (orderId: string, itemId: string) => Promise<void>;
  requestAdjustment: (orderId: string, itemId: string | null, message: string) => Promise<void>;
  resolveAdjustment: (adjustmentId: string) => Promise<void>;
  finalizeOrder: (orderId: string) => Promise<boolean>;
}

export const useSeparationStore = create<SeparationState>()((set, get) => ({
  queue: [],
  queueStatus: "idle",
  history: [],
  historyStatus: "idle",
  unseenOrderIds: new Set(),
  realtimeChannel: null,

  fetchQueue: async () => {
    set({ queueStatus: "loading" });
    try {
      const { orderRows, itemRows, productRows, adjustmentRows } = await loadOrdersWithDetails(["CONFIRMED"]);
      set({ queue: buildOrders(orderRows, itemRows, productRows, adjustmentRows), queueStatus: "ready" });
    } catch {
      toast.error("Não foi possível carregar a fila do Separa Confere");
      set({ queueStatus: "error" });
    }
  },

  fetchHistory: async () => {
    set({ historyStatus: "loading" });
    try {
      const { orderRows, itemRows, productRows, adjustmentRows } = await loadOrdersWithDetails(["COMPLETED", "CANCELLED"], 100);
      const history = buildOrders(orderRows, itemRows, productRows, adjustmentRows).sort((a, b) => {
        const aTime = new Date(a.finishedAt ?? a.createdAt).getTime();
        const bTime = new Date(b.finishedAt ?? b.createdAt).getTime();
        return bTime - aTime;
      });
      set({ history, historyStatus: "ready" });
    } catch {
      toast.error("Não foi possível carregar o histórico");
      set({ historyStatus: "error" });
    }
  },

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const channel = supabase
      .channel("separa-confere-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const newRow = payload.new as Partial<OrderRow> | undefined;
        const oldRow = payload.old as Partial<OrderRow> | undefined;
        if (newRow?.status === "CONFIRMED" && oldRow?.status !== "CONFIRMED") {
          set((state) => ({ unseenOrderIds: new Set(state.unseenOrderIds).add(newRow.id as string) }));
        }
        get().fetchQueue();
      })
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

  markSeen: (orderId) => {
    set((state) => {
      const next = new Set(state.unseenOrderIds);
      next.delete(orderId);
      return { unseenOrderIds: next };
    });
  },

  acceptOrder: async (orderId) => {
    const name = currentOperatorName();
    const nowOrder = get().queue.find((order) => order.id === orderId);
    const isFirstAccept = !nowOrder?.startedAt;
    const { data, error } = await supabase
      .from("orders")
      .update({
        separation_responsible: name,
        ...(isFirstAccept ? { separation_started_at: new Date().toISOString(), separation_started_by: name } : {}),
      })
      .eq("id", orderId)
      .is("separation_responsible", null)
      .select("id")
      .maybeSingle();

    if (error) {
      toast.error("Não foi possível aceitar o pedido");
      return false;
    }
    if (!data) {
      toast.error("Esse pedido já foi assumido por outro usuário");
      await get().fetchQueue();
      return false;
    }
    get().markSeen(orderId);
    await get().fetchQueue();
    return true;
  },

  releaseOrder: async (orderId) => {
    const { error } = await supabase.from("orders").update({ separation_responsible: null }).eq("id", orderId);
    if (error) {
      toast.error("Não foi possível liberar a separação");
      return;
    }
    toast.success("Separação liberada");
    await get().fetchQueue();
  },

  confirmItem: async (orderId, itemId) => {
    const { data, error } = await supabase
      .from("order_items")
      .update({ separated_at: new Date().toISOString() })
      .eq("id", itemId)
      .is("separated_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível confirmar o item");
      return;
    }
    await get().fetchQueue();
  },

  undoItem: async (orderId, itemId) => {
    const { data, error } = await supabase.from("order_items").update({ separated_at: null }).eq("id", itemId).select("id").maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível desfazer a confirmação");
      return;
    }
    await get().fetchQueue();
  },

  requestAdjustment: async (orderId, itemId, message) => {
    const { error } = await supabase.from("order_adjustment_requests").insert({
      order_id: orderId,
      order_item_id: itemId,
      message,
      created_by: currentOperatorName(),
    });
    if (error) {
      toast.error("Não foi possível registrar o ajuste");
      return;
    }
    toast.success("Ajuste solicitado");
    await get().fetchQueue();
  },

  resolveAdjustment: async (adjustmentId) => {
    const { data, error } = await supabase
      .from("order_adjustment_requests")
      .update({ status: "resolved", resolved_by: currentOperatorName() })
      .eq("id", adjustmentId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível marcar o ajuste como resolvido");
      return;
    }
    toast.success("Ajuste marcado como resolvido");
    await get().fetchQueue();
  },

  finalizeOrder: async (orderId) => {
    const { data: items, error: itemsError } = await supabase.from("order_items").select("id, separated_at").eq("order_id", orderId);
    if (itemsError) {
      toast.error("Não foi possível verificar os itens do pedido");
      return false;
    }
    if (items.some((item) => !item.separated_at)) {
      toast.error("Ainda existem itens pendentes de separação");
      return false;
    }
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from("order_adjustment_requests")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "pending");
    if (adjustmentsError) {
      toast.error("Não foi possível verificar os ajustes do pedido");
      return false;
    }
    if (adjustments.length > 0) {
      toast.error("Existe ajuste pendente para esse pedido");
      return false;
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "COMPLETED",
        separation_finished_at: new Date().toISOString(),
        separation_completed_by: currentOperatorName(),
      })
      .eq("id", orderId)
      .eq("status", "CONFIRMED")
      .select("id")
      .maybeSingle();

    if (error) {
      toast.error("Não foi possível finalizar a conferência");
      return false;
    }
    if (!data) {
      toast.success("Conferência já estava finalizada");
      await get().fetchQueue();
      return true;
    }
    toast.success("Conferência finalizada");
    await get().fetchQueue();
    return true;
  },
}));
