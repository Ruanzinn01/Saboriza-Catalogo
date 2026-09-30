import { create } from "zustand";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { FloorExecution, ProductionRelease } from "@/types/production-floor";

function releaseFromRow(row: {
  id: string;
  product_id: string;
  requested_packs: number;
  requested_units: number;
  reason: string | null;
  note: string | null;
  urgent_demand_id: string | null;
  origin: string;
  created_at: string;
}): ProductionRelease {
  return {
    id: row.id,
    productId: row.product_id,
    requestedPacks: row.requested_packs,
    requestedUnits: row.requested_units,
    reason: row.reason,
    note: row.note,
    urgentDemandId: row.urgent_demand_id,
    origin: row.origin as ProductionRelease["origin"],
    createdAt: row.created_at,
  };
}

function executionFromRow(row: {
  id: string;
  product_id: string;
  production_release_id: string | null;
  route_id: string | null;
  route_version: number | null;
  route_version_label: string;
  status: string;
  target_quantity: number;
  operational_quantity: number;
  assumed_by_employee_id: string | null;
  assumed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  production_record_id: string | null;
  created_at: string;
  updated_at: string;
}): FloorExecution {
  return {
    id: row.id,
    productId: row.product_id,
    productionReleaseId: row.production_release_id,
    routeId: row.route_id,
    routeVersion: row.route_version,
    routeVersionLabel: row.route_version_label,
    status: row.status as FloorExecution["status"],
    targetQuantity: row.target_quantity,
    operationalQuantity: row.operational_quantity,
    assumedByEmployeeId: row.assumed_by_employee_id,
    assumedAt: row.assumed_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    productionRecordId: row.production_record_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface FloorState {
  releases: ProductionRelease[];
  executions: FloorExecution[];
  realtimeChannel: RealtimeChannel | null;
  fetchAll: () => Promise<void>;
  createRelease: (
    productId: string,
    packsQuantity: number,
    reason: string,
    note: string,
    urgentDemandId: string | null,
    idempotencyKey: string,
    planId?: string | null
  ) => Promise<boolean>;
  assumeExecution: (executionId: string, employeeId: string) => Promise<boolean>;
  advanceQuantity: (executionId: string, delta: number) => Promise<boolean>;
  completeExecution: (executionId: string) => Promise<boolean>;
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;
}

export const useFloorStore = create<FloorState>()((set, get) => ({
  releases: [],
  executions: [],
  realtimeChannel: null,

  fetchAll: async () => {
    const [releasesRes, executionsRes] = await Promise.all([
      supabase.from("production_releases").select("*").order("created_at", { ascending: false }),
      supabase.from("floor_executions").select("*").order("created_at", { ascending: false }),
    ]);
    if (!releasesRes.error && releasesRes.data) set({ releases: releasesRes.data.map(releaseFromRow) });
    if (!executionsRes.error && executionsRes.data) set({ executions: executionsRes.data.map(executionFromRow) });
  },

  createRelease: async (productId, packsQuantity, reason, note, urgentDemandId, idempotencyKey, planId) => {
    if (packsQuantity <= 0) {
      toast.error("Informe uma quantidade válida");
      return false;
    }
    const { data, error } = await supabase
      .rpc("create_production_release", {
        p_product_id: productId,
        p_packs_quantity: packsQuantity,
        p_reason: reason || undefined,
        p_note: note || undefined,
        p_urgent_demand_id: urgentDemandId ?? undefined,
        p_idempotency_key: idempotencyKey,
        p_plan_id: planId ?? undefined,
      })
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível liberar a produção. Confirme se o produto tem rota de produção ativa.");
      return false;
    }
    await get().fetchAll();
    toast.success("Produção liberada. Já apareceu no Chão de Fábrica.");
    return true;
  },

  assumeExecution: async (executionId, employeeId) => {
    const { data, error } = await supabase
      .rpc("floor_assume_execution", { p_floor_execution_id: executionId, p_employee_id: employeeId })
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível assumir a execução");
      return false;
    }
    set((state) => ({ executions: state.executions.map((e) => (e.id === executionId ? executionFromRow(data as never) : e)) }));
    toast.success("Execução assumida");
    return true;
  },

  advanceQuantity: async (executionId, delta) => {
    const { data, error } = await supabase
      .rpc("floor_advance_quantity", { p_floor_execution_id: executionId, p_quantity_delta: delta })
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível avançar a quantidade");
      return false;
    }
    set((state) => ({ executions: state.executions.map((e) => (e.id === executionId ? executionFromRow(data as never) : e)) }));
    return true;
  },

  completeExecution: async (executionId) => {
    const { data, error } = await supabase.rpc("floor_complete_execution", { p_floor_execution_id: executionId }).single();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível concluir a execução");
      return false;
    }
    set((state) => ({ executions: state.executions.map((e) => (e.id === executionId ? executionFromRow(data as never) : e)) }));
    toast.success("Execução concluída. Pronta pra confirmação no Produziu Registra.");
    return true;
  },

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const channel = supabase
      .channel("chao-de-fabrica")
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_executions" }, () => get().fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "production_releases" }, () => get().fetchAll())
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
}));
