import { create } from "zustand";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { AdjustmentRequest } from "@/types/separation";
import { generateDeliveryReceiptPdf } from "@/lib/delivery-receipt-pdf";
import { useSettingsStore } from "@/store/settings-store";
import type { DeliveryFormData } from "@/types/delivery";
import type { FulfillmentItem, FulfillmentOrder } from "@/types/fulfillment";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string;
  customer_trade_name: string;
  company_name: string;
  phone: string;
  customer_address: string;
  customer_neighborhood: string;
  customer_city: string;
  customer_state: string;
  total_amount: number;
  payment_terms: string;
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
  total_price: number;
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

function buildOrders(
  orderRows: OrderRow[],
  itemRows: ItemRow[],
  productRows: ProductRow[],
  adjustmentRows: AdjustmentRow[],
  deliveryCountByCustomer: Map<string, number> = new Map()
): FulfillmentOrder[] {
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
          packPrice: item.packs_quantity > 0 ? Math.round((item.total_price / item.packs_quantity) * 100) / 100 : 0,
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
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerTradeName: row.customer_trade_name,
      companyName: row.company_name,
      phone: row.phone,
      address: row.customer_address,
      neighborhood: row.customer_neighborhood,
      city: row.customer_city,
      state: row.customer_state,
      totalAmount: row.total_amount,
      paymentTerms: row.payment_terms ?? "",
      deliveryCountForCustomer: row.customer_id ? (deliveryCountByCustomer.get(row.customer_id) ?? 0) : 0,
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
      .select("id, order_id, product_id, product_name, presentation, weight_volume, total_units, packs_quantity, pack_quantity, total_price, loaded_at")
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
  reserveDeliveryEr: (orderId: string) => Promise<DeliveryEr | null>;
  submitDelivery: (order: FulfillmentOrder, form: DeliveryFormData, signature: Blob, er: DeliveryEr) => Promise<boolean>;
}

export interface DeliveryEr {
  erCode: string;
  registeredAt: Date;
}

function isAlreadyStored(error: { message?: string; statusCode?: string } | null): boolean {
  return Boolean(error) && (error?.statusCode === "409" || /already exists|duplicate/i.test(error?.message ?? ""));
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

      const customerIds = [...new Set((orderRows as OrderRow[]).map((row) => row.customer_id).filter((id): id is string => Boolean(id)))];
      const deliveryCountByCustomer = new Map<string, number>();
      if (customerIds.length > 0) {
        const { data: pastDeliveries } = await supabase.from("orders").select("customer_id").eq("status", "FINALIZADO").in("customer_id", customerIds);
        (pastDeliveries ?? []).forEach((row) => {
          if (!row.customer_id) return;
          deliveryCountByCustomer.set(row.customer_id, (deliveryCountByCustomer.get(row.customer_id) ?? 0) + 1);
        });
      }

      set({
        deliveryQueue: buildOrders(orderRows as OrderRow[], itemRows, productRows, adjustmentRows, deliveryCountByCustomer),
        deliveryQueueStatus: "ready",
      });
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
          .select("id, order_id, product_id, product_name, presentation, weight_volume, total_units, packs_quantity, pack_quantity, total_price, loaded_at")
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

  reserveDeliveryEr: async (orderId) => {
    const { data, error } = await supabase.rpc("reserve_delivery_er", { p_order_id: orderId });
    const row = data?.[0];
    if (error || !row) {
      toast.error(error?.message || "Não foi possível iniciar o registro da entrega");
      return null;
    }
    return { erCode: row.er_code, registeredAt: new Date(row.reserved_at) };
  },

  submitDelivery: async (order, form, signature, er) => {
    const settingsStore = useSettingsStore.getState();
    if (!settingsStore.settings) await settingsStore.fetchSettings();

    let receipt: Blob;
    try {
      receipt = await generateDeliveryReceiptPdf({
        order,
        settings: useSettingsStore.getState().settings,
        erCode: er.erCode,
        registeredAt: er.registeredAt,
        operator: currentOperatorName(),
        form,
        signature,
      });
    } catch {
      toast.error("Não foi possível gerar o comprovante");
      return false;
    }

    const signaturePath = `${order.id}/${er.erCode}.png`;
    const pdfPath = `${order.id}/${er.erCode}.pdf`;
    const { error: signatureError } = await supabase.storage.from("delivery-signatures").upload(signaturePath, signature, { contentType: "image/png" });
    if (signatureError && !isAlreadyStored(signatureError)) {
      toast.error("Não foi possível salvar a assinatura");
      return false;
    }
    const { error: pdfError } = await supabase.storage.from("delivery-receipts").upload(pdfPath, receipt, { contentType: "application/pdf" });
    if (pdfError && !isAlreadyStored(pdfError)) {
      toast.error("Não foi possível salvar o comprovante");
      return false;
    }

    const { error } = await supabase.rpc("finalize_delivery", {
      p_order_id: order.id,
      p_er_code: er.erCode,
      p_result: form.result,
      p_receiver_name: form.receiverName,
      p_doc_type: form.docType,
      p_doc: form.doc,
      p_role: form.role,
      p_notes: form.notes,
      p_signature_path: signaturePath,
      p_pdf_path: pdfPath,
      p_items: form.divergences.map((item) => ({
        order_item_id: item.orderItemId,
        packs_not_delivered: item.packsNotDelivered,
        reason: item.reason,
        reason_detail: item.reasonDetail,
      })),
    });
    if (error) {
      toast.error(error.message || "Não foi possível confirmar a entrega");
      return false;
    }

    toast.success(form.result === "PARTIAL" ? `Entrega parcial registrada (${er.erCode})` : `Entrega confirmada (${er.erCode})`);
    await get().fetchDeliveryQueue();
    return true;
  },
}));
