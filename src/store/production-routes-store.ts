import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { ProductionPlan, ProductionRoute, ProductionRouteStage } from "@/types/production-floor";

function routeFromRow(row: { id: string; product_id: string; version: number; status: string; created_at: string }): ProductionRoute {
  return {
    id: row.id,
    productId: row.product_id,
    version: row.version,
    status: row.status as ProductionRoute["status"],
    createdAt: row.created_at,
  };
}

function stageFromRow(row: { id: string; route_id: string; sequence_order: number; name: string }): ProductionRouteStage {
  return { id: row.id, routeId: row.route_id, sequenceOrder: row.sequence_order, name: row.name };
}

function planFromRow(row: {
  id: string;
  product_id: string;
  planned_date: string;
  planned_packs: number;
  status: string;
  production_release_id: string | null;
  created_at: string;
}): ProductionPlan {
  return {
    id: row.id,
    productId: row.product_id,
    plannedDate: row.planned_date,
    plannedPacks: row.planned_packs,
    status: row.status as ProductionPlan["status"],
    productionReleaseId: row.production_release_id,
    createdAt: row.created_at,
  };
}

interface ProductionRoutesState {
  routes: ProductionRoute[];
  stages: ProductionRouteStage[];
  plans: ProductionPlan[];
  fetchRoutes: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  publishRoute: (productId: string, stageNames: string[]) => Promise<boolean>;
  createPlan: (productId: string, plannedDate: string, plannedPacks: number) => Promise<boolean>;
}

export const useProductionRoutesStore = create<ProductionRoutesState>()((set, get) => ({
  routes: [],
  stages: [],
  plans: [],

  fetchRoutes: async () => {
    const { data: routes } = await supabase.from("production_routes").select("*").order("version", { ascending: false });
    if (routes) set({ routes: routes.map(routeFromRow) });
    const routeIds = (routes ?? []).map((r) => r.id);
    if (routeIds.length === 0) {
      set({ stages: [] });
      return;
    }
    const { data: stages } = await supabase
      .from("production_route_stages")
      .select("*")
      .in("route_id", routeIds)
      .order("sequence_order", { ascending: true });
    if (stages) set({ stages: stages.map(stageFromRow) });
  },

  fetchPlans: async () => {
    const { data } = await supabase.from("production_plans").select("*").order("planned_date", { ascending: true });
    if (data) set({ plans: data.map(planFromRow) });
  },

  publishRoute: async (productId, stageNames) => {
    const clean = stageNames.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) {
      toast.error("Informe ao menos uma etapa");
      return false;
    }
    const { error } = await supabase.rpc("publish_production_route", { p_product_id: productId, p_stage_names: clean });
    if (error) {
      toast.error(error.message ?? "Não foi possível publicar a rota");
      return false;
    }
    await get().fetchRoutes();
    toast.success("Rota publicada. Execuções em andamento continuam na versão anterior.");
    return true;
  },

  createPlan: async (productId, plannedDate, plannedPacks) => {
    if (plannedPacks <= 0) {
      toast.error("Informe uma quantidade válida");
      return false;
    }
    const { error } = await supabase
      .from("production_plans")
      .insert({ product_id: productId, planned_date: plannedDate, planned_packs: plannedPacks });
    if (error) {
      toast.error("Não foi possível criar o plano");
      return false;
    }
    await get().fetchPlans();
    toast.success("Plano de produção criado");
    return true;
  },
}));
