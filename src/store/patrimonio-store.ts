import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export type AssetStatus = "ATIVO" | "BAIXADO";

export interface AssetUnit {
  id: string;
  modelName: string;
  category: string;
  acquisitionValue: number;
  estimatedCurrentValue: number | null;
  acquisitionDate: string | null;
  status: AssetStatus;
  responsibleId: string | null;
  responsibleName: string | null;
  expenseId: string | null;
  expenseDescription: string | null;
}

export interface AssetMovement {
  id: string;
  assetUnitId: string;
  type: string;
  notes: string | null;
  responsibleEmployeeId: string | null;
  createdAt: string;
}

export interface NewAssetInput {
  modelName: string;
  category: string;
  acquisitionValue: number;
  acquisitionDate?: string;
  responsibleId?: string;
  expenseId?: string;
  quantity?: number;
}

export interface FormationCategory {
  categoryId: string;
  balance: number;
}

const FORMATION_CATEGORIES = ["Expositores", "Máquinas", "Equipamentos", "Móveis", "Instalações", "Reforma/Benfeitoria", "Veículos em preparação"];

interface PatrimonioState {
  assets: AssetUnit[];
  movements: AssetMovement[];
  formationBalances: FormationCategory[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  fetchFormationBalances: () => Promise<void>;
  createAsset: (input: NewAssetInput) => Promise<string | null>;
  writeOffAsset: (id: string, reason: string) => Promise<string | null>;
  transferResponsible: (id: string, newResponsibleId: string, reason: string) => Promise<string | null>;
  appropriateFromFormation: (input: {
    categoryId: string;
    modelName: string;
    amount: number;
    quantity?: number;
    responsibleId?: string;
    acquisitionDate?: string;
  }) => Promise<string | null>;
}

export const usePatrimonioStore = create<PatrimonioState>((set, get) => ({
  assets: [],
  movements: [],
  formationBalances: [],
  status: "idle",

  fetchFormationBalances: async () => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const results = await Promise.all(
      FORMATION_CATEGORIES.map(async (categoryId) => {
        const { data } = await supabase.rpc("get_formation_balance", { p_company_id: companyId, p_category_id: categoryId });
        return { categoryId, balance: typeof data === "number" ? data : 0 };
      })
    );
    set({ formationBalances: results.filter((r) => r.balance > 0) });
  },

  appropriateFromFormation: async (input) => {
    const { error } = await supabase.rpc("appropriate_asset_from_formation", {
      p_category_id: input.categoryId,
      p_model_name: input.modelName,
      p_amount: input.amount,
      p_quantity: input.quantity ?? 1,
      p_responsible_id: input.responsibleId ?? undefined,
      p_acquisition_date: input.acquisitionDate ?? undefined,
    });
    if (error) return error.message;
    await Promise.all([get().fetchAll(), get().fetchFormationBalances()]);
    return null;
  },

  fetchAll: async () => {
    set({ status: "loading" });

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const [{ data: rows, error }, { data: movementRows }] = await Promise.all([
      supabase
        .from("asset_units")
        .select(
          "id, acquisition_value, estimated_current_value, acquisition_date, status, current_responsible_id, expense_id, asset_models(name, category), employees(name), expenses(description)"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("asset_movements")
        .select("id, asset_unit_id, type, notes, responsible_employee_id, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);

    if (error) {
      set({ status: "error" });
      return;
    }

    set({
      assets: (rows ?? []).map((a) => {
        const model = a.asset_models as unknown as { name: string; category: string } | null;
        const employee = a.employees as unknown as { name: string } | null;
        const expense = a.expenses as unknown as { description: string } | null;
        return {
          id: a.id,
          modelName: model?.name ?? "-----",
          category: model?.category ?? "OUTRO",
          acquisitionValue: a.acquisition_value,
          estimatedCurrentValue: a.estimated_current_value,
          acquisitionDate: a.acquisition_date,
          status: a.status as AssetStatus,
          responsibleId: a.current_responsible_id,
          responsibleName: employee?.name ?? null,
          expenseId: a.expense_id,
          expenseDescription: expense?.description ?? null,
        };
      }),
      movements: (movementRows ?? []).map((m) => ({
        id: m.id,
        assetUnitId: m.asset_unit_id,
        type: m.type,
        notes: m.notes,
        responsibleEmployeeId: m.responsible_employee_id,
        createdAt: m.created_at,
      })),
      status: "ready",
    });
  },

  createAsset: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";

    const { data: model, error: modelError } = await supabase
      .from("asset_models")
      .insert({ name: input.modelName, category: input.category, company_id: companyId })
      .select("id")
      .single();
    if (modelError) return modelError.message;

    const quantity = Math.max(1, input.quantity ?? 1);
    const units = Array.from({ length: quantity }, () => ({
      company_id: companyId,
      asset_model_id: model.id,
      acquisition_value: input.acquisitionValue,
      acquisition_date: input.acquisitionDate || null,
      current_responsible_id: input.responsibleId || null,
      expense_id: input.expenseId || null,
    }));

    const { error: unitError } = await supabase.from("asset_units").insert(units);
    if (unitError) return unitError.message;

    await get().fetchAll();
    return null;
  },

  writeOffAsset: async (id, reason) => {
    const { error: updateError } = await supabase.from("asset_units").update({ status: "BAIXADO" }).eq("id", id);
    if (updateError) return updateError.message;

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error: movementError } = await supabase.from("asset_movements").insert({
      company_id: companyId,
      asset_unit_id: id,
      type: "BAIXA",
      notes: reason,
    });
    if (movementError) return movementError.message;

    await get().fetchAll();
    return null;
  },

  transferResponsible: async (id, newResponsibleId, reason) => {
    const { error: updateError } = await supabase.from("asset_units").update({ current_responsible_id: newResponsibleId }).eq("id", id);
    if (updateError) return updateError.message;

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error: movementError } = await supabase.from("asset_movements").insert({
      company_id: companyId,
      asset_unit_id: id,
      type: "TRANSFERENCIA_RESPONSAVEL",
      notes: reason,
      responsible_employee_id: newResponsibleId,
    });
    if (movementError) return movementError.message;

    await get().fetchAll();
    return null;
  },
}));
