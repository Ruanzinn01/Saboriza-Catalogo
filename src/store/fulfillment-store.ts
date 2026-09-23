import { create } from "zustand";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { AdjustmentRequest } from "@/types/separation";
import type { FulfillmentItem, FulfillmentOrder } from "@/types/fulfillment";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  company_name: string;
  total_amount: number;
  status: "COMPLETED" | "FINALIZADO" | "CONFIRMED" | "NEW" | "IN_REVIEW" | "CANCELLED";
  loading_queued_at: string | null;
  loading_started_at: string | null;
  loading_finished_at: string | null;
  loading_responsible: string | null;
  loading_started_by: string | null;
  loading_completed_by: string | null;
  delivery_confirmed_at: string | null;
  delivery_confirmed_by: string | null;
  delivery_signature_url: string | null;
}

interface ItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  presentation: string;
  weight_volume: string;
  total_units: number;
  packs_quantity: number;
  pack_quantity: number;
  loaded_at: string | null;
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

function buildOrders(orderRows: OrderRow[], itemRows: ItemRow[], productRows: ProductRow[], adjustmentRows: AdjustmentRow[]): FulfillmentOrder[] {
  const productsById = new Map(productRows.map((product) => [product.id, product]));
  return orderRows.map((row) => {
    const items: FulfillmentItem[] = itemRows
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
          packsQuantity: item.packs_quantity,
          packQuantity: item.pack_quantity,
          loadedAt: item.loaded_at,
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
      totalAmount: row.total_amount,
      status: row.status as FulfillmentOrder["status"],
      loadingQueuedAt: row.loading_queued_at,
      loadingStartedAt: row.loading_started_at,
      loadingFinishedAt: row.loading_finished_at,
      loadingResponsible: row.loading_responsible,
      loadingStartedBy: row.loading_started_by,
      loadingCompletedBy: row.loading_completed_by,
      deliveryConfirmedAt: row.delivery_confirmed_at,
      deliveryConfirmedBy: row.delivery_confirmed_by,
      deliverySignatureUrl: row.delivery_signature_url,
      items,
      pendingAdjustments,
    };
  });
}

async function loadOrderDetails(orderRows: OrderRow[]) {
  const orderIds = orderRows.map((row) => row.id);
  if (orderIds.length === 0) return { itemRows: [] as ItemRow[], productRows: [] as ProductRow[], adjustmentRows: [] as AdjustmentRow[] };

  const [{ data: itemRows, error: itemError }, { data: adjustmentRows, error: adjustmentError }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, order_id, product_id, product_name, presentation, weight_volume, total_units, packs_quantity, pack_quantity, loaded_at")
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

  return { itemRows: itemRows as ItemRow[], productRows: (productRows ?? []) as ProductRow[], adjustmentRows: adjustmentRows as AdjustmentRow[] };
}

interface FulfillmentState {
  loadingQueue: FulfillmentOrder[];
  loadingQueueStatus: "idle" | "loading" | "ready" | "error";
  deliveryQueue: FulfillmentOrder[];
  deliveryQueueStatus: "idle" | "loading" | "ready" | "error";
  currentOrder: FulfillmentOrder | null;
  currentOrderStatus: "idle" | "loading" | "ready" | "error";
  realtimeChannel: RealtimeChannel | null;

  fetchLoadingQueue: () => Promise<void>;
  fetchDeliveryQueue: () => Promise<void>;
  fetchOrder: (orderId: string) => Promise<void>;
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;

  startLoading: (orderId: string) => Promise<boolean>;
  releaseLoading: (orderId: string) => Promise<void>;
  confirmLoadingItem: (orderId: string, itemId: string) => Promise<void>;
  undoLoadingItem: (orderId: string, itemId: string) => Promise<void>;
  requestAdjustment: (orderId: string, itemId: string | null, message: string) => Promise<void>;
  resolveAdjustment: (adjustmentId: string) => Promise<void>;
  confirmDelivery: (orderId: string, signatureBlob: Blob) => Promise<boolean>;
}

export const useFulfillmentStore = create<FulfillmentState>()((set, get) => ({
  loadingQueue: [],
  loadingQueueStatus: "idle",
  deliveryQueue: [],
  deliveryQueueStatus: "idle",
  currentOrder: null,
  currentOrderStatus: "idle",
  realtimeChannel: null,

  fetchLoadingQueue: async () => {
    set({ loadingQueueStatus: "loading" });
    try {
      const { data: orderRows, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "COMPLETED")
        .is("loading_finished_at", null)
        .order("loading_queued_at", { ascending: true });
      if (error || !orderRows) throw error;
      const { itemRows, productRows, adjustmentRows } = await loadOrderDetails(orderRows as OrderRow[]);
      set({ loadingQueue: buildOrders(orderRows as OrderRow[], itemRows, productRows, adjustmentRows), loadingQueueStatus: "ready" });
    } catch {
      toast.error("Não foi possível carregar a fila de carregamento");
      set({ loadingQueueStatus: "error" });
    }
  },

  fetchDeliveryQueue: async () => {
    set({ deliveryQueueStatus: "loading" });
    try {
      const { data: orderRows, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "COMPLETED")
        .not("loading_finished_at", "is", null)
        .is("delivery_confirmed_at", null)
        .order("loading_finished_at", { ascending: true });
      if (error || !orderRows) throw error;
      const { itemRows, productRows, adjustmentRows } = await loadOrderDetails(orderRows as OrderRow[]);
      set({ deliveryQueue: buildOrders(orderRows as OrderRow[], itemRows, productRows, adjustmentRows), deliveryQueueStatus: "ready" });
    } catch {
      toast.error("Não foi possível carregar a fila de entrega");
      set({ deliveryQueueStatus: "error" });
    }
  },

  fetchOrder: async (orderId) => {
    set({ currentOrderStatus: "loading" });
    const { data: orderRow, error: orderError } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (orderError || !orderRow) {
      set({ currentOrder: null, currentOrderStatus: "error" });
      return;
    }
    try {
      const [{ data: itemRows, error: itemError }, { data: adjustmentRows, error: adjustmentError }] = await Promise.all([
        supabase
          .from("order_items")
          .select("id, order_id, product_id, product_name, presentation, weight_volume, total_units, packs_quantity, pack_quantity, loaded_at")
          .eq("order_id", orderId),
        supabase
          .from("order_adjustment_requests")
          .select("id, order_id, order_item_id, message, status, created_by, created_at")
          .eq("order_id", orderId),
      ]);
      if (itemError || !itemRows) throw itemError;
      if (adjustmentError || !adjustmentRows) throw adjustmentError;

      const productIds = [...new Set(itemRows.map((item) => item.product_id).filter((id): id is string => Boolean(id)))];
      const { data: productRows, error: productError } =
        productIds.length > 0
          ? await supabase.from("products").select("id, image_url, code, gtin").in("id", productIds)
          : { data: [] as ProductRow[], error: null };
      if (productError) throw productError;

      const [order] = buildOrders([orderRow as OrderRow], itemRows as ItemRow[], (productRows ?? []) as ProductRow[], adjustmentRows as AdjustmentRow[]);
      set({ currentOrder: order, currentOrderStatus: "ready" });
    } catch {
      toast.error("Não foi possível carregar o pedido");
      set({ currentOrder: null, currentOrderStatus: "error" });
    }
  },

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const channel = supabase
      .channel("carrega-entrega-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        get().fetchLoadingQueue();
        get().fetchDeliveryQueue();
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

  startLoading: async (orderId) => {
    const name = currentOperatorName();
    const current = get().loadingQueue.find((order) => order.id === orderId);
    const isFirstStart = !current?.loadingStartedAt;
    const { data, error } = await supabase
      .from("orders")
      .update({
        loading_responsible: name,
        ...(isFirstStart ? { loading_started_at: new Date().toISOString(), loading_started_by: name } : {}),
      })
      .eq("id", orderId)
      .is("loading_responsible", null)
      .select("id")
      .maybeSingle();
    if (error) {
      toast.error("Não foi possível iniciar o carregamento");
      return false;
    }
    if (!data) {
      toast.error("Esse pedido já está sendo carregado por outro usuário");
      await get().fetchLoadingQueue();
      return false;
    }
    await get().fetchLoadingQueue();
    return true;
  },

  releaseLoading: async (orderId) => {
    const { error } = await supabase.from("orders").update({ loading_responsible: null }).eq("id", orderId);
    if (error) {
      toast.error("Não foi possível liberar o carregamento");
      return;
    }
    toast.success("Carregamento liberado");
    await get().fetchLoadingQueue();
    if (get().currentOrder?.id === orderId) await get().fetchOrder(orderId);
  },

  confirmLoadingItem: async (orderId, itemId) => {
    const { data, error } = await supabase
      .from("order_items")
      .update({ loaded_at: new Date().toISOString() })
      .eq("id", itemId)
      .is("loaded_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível confirmar o item");
      return;
    }

    const [{ data: remainingItems }, { data: pendingAdjustments }] = await Promise.all([
      supabase.from("order_items").select("id").eq("order_id", orderId).is("loaded_at", null),
      supabase.from("order_adjustment_requests").select("id").eq("order_id", orderId).eq("status", "pending"),
    ]);
    if ((remainingItems?.length ?? 0) === 0 && (pendingAdjustments?.length ?? 0) === 0) {
      await supabase
        .from("orders")
        .update({ loading_finished_at: new Date().toISOString(), loading_completed_by: currentOperatorName() })
        .eq("id", orderId)
        .is("loading_finished_at", null);
    }

    await get().fetchLoadingQueue();
    if (get().currentOrder?.id === orderId) await get().fetchOrder(orderId);
  },

  undoLoadingItem: async (orderId, itemId) => {
    const { data, error } = await supabase.from("order_items").update({ loaded_at: null }).eq("id", itemId).select("id").maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível desfazer a confirmação");
      return;
    }
    await get().fetchLoadingQueue();
    if (get().currentOrder?.id === orderId) await get().fetchOrder(orderId);
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
    await get().fetchLoadingQueue();
    if (get().currentOrder?.id === orderId) await get().fetchOrder(orderId);
  },

  resolveAdjustment: async (adjustmentId) => {
    const orderId = get().currentOrder?.pendingAdjustments.find((adjustment) => adjustment.id === adjustmentId)?.orderId;
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
    await get().fetchLoadingQueue();
    if (orderId && get().currentOrder?.id === orderId) await get().fetchOrder(orderId);
  },

  confirmDelivery: async (orderId, signatureBlob) => {
    const path = `${orderId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from("delivery-signatures").upload(path, signatureBlob, { contentType: "image/png" });
    if (uploadError) {
      toast.error("Não foi possível salvar a assinatura");
      return false;
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "FINALIZADO",
        delivery_confirmed_at: new Date().toISOString(),
        delivery_confirmed_by: currentOperatorName(),
        delivery_signature_url: path,
      })
      .eq("id", orderId)
      .eq("status", "COMPLETED")
      .select("id")
      .maybeSingle();

    if (error) {
      toast.error("Não foi possível confirmar a entrega");
      return false;
    }
    if (!data) {
      toast.success("Entrega já estava confirmada");
      await get().fetchDeliveryQueue();
      return true;
    }
    toast.success("Entrega confirmada");
    await get().fetchDeliveryQueue();
    return true;
  },
}));
