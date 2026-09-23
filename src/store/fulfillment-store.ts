import { create } from "zustand";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { FulfillmentOrder } from "@/types/fulfillment";

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

function currentOperatorName(): string {
  const session = useAdminAuthStore.getState().session;
  return (session?.user.user_metadata?.name as string | undefined) || session?.user.email || "Operador";
}

function buildOrder(row: OrderRow): FulfillmentOrder {
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
  };
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
  finishLoading: (orderId: string) => Promise<void>;
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
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "COMPLETED")
      .is("loading_finished_at", null)
      .order("loading_queued_at", { ascending: true });
    if (error || !data) {
      toast.error("Não foi possível carregar a fila de carregamento");
      set({ loadingQueueStatus: "error" });
      return;
    }
    set({ loadingQueue: (data as OrderRow[]).map(buildOrder), loadingQueueStatus: "ready" });
  },

  fetchDeliveryQueue: async () => {
    set({ deliveryQueueStatus: "loading" });
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "COMPLETED")
      .not("loading_finished_at", "is", null)
      .is("delivery_confirmed_at", null)
      .order("loading_finished_at", { ascending: true });
    if (error || !data) {
      toast.error("Não foi possível carregar a fila de entrega");
      set({ deliveryQueueStatus: "error" });
      return;
    }
    set({ deliveryQueue: (data as OrderRow[]).map(buildOrder), deliveryQueueStatus: "ready" });
  },

  fetchOrder: async (orderId) => {
    set({ currentOrderStatus: "loading" });
    const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (error || !data) {
      set({ currentOrder: null, currentOrderStatus: "error" });
      return;
    }
    set({ currentOrder: buildOrder(data as OrderRow), currentOrderStatus: "ready" });
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
    const { data, error } = await supabase
      .from("orders")
      .update({ loading_responsible: name, loading_started_at: new Date().toISOString(), loading_started_by: name })
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

  finishLoading: async (orderId) => {
    const { data, error } = await supabase
      .from("orders")
      .update({ loading_finished_at: new Date().toISOString(), loading_completed_by: currentOperatorName() })
      .eq("id", orderId)
      .is("loading_finished_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível finalizar o carregamento");
      return;
    }
    toast.success("Carregamento finalizado");
    await get().fetchLoadingQueue();
    if (get().currentOrder?.id === orderId) await get().fetchOrder(orderId);
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
