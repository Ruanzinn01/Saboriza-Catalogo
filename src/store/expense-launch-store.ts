import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export type LaunchKind = "stock" | "asset" | "expense" | "salary" | "partner";

export interface ExpenseCategory {
  id: string;
  name: string;
  kind: LaunchKind;
  rateable: boolean;
}

export interface ExpenseCatalogItem {
  id: string;
  name: string;
  code: string;
  categoryId: string | null;
  kind: "asset" | "expense" | "partner";
  unit: string;
  suggestedPrice: number;
  suggestRecurring: boolean;
}

export interface ExpenseRecurrence {
  id: string;
  kind: LaunchKind;
  partyName: string;
  contractLabel: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly" | "custom";
  rawMaterialId: string | null;
  catalogItemId: string | null;
  status: "ATIVA" | "PAUSADA" | "ENCERRADA";
}

export interface RecurrenceInput {
  enabled: boolean;
  frequency: "weekly" | "monthly" | "yearly" | "custom";
  intervalDays?: number;
  dayOfMonth?: number;
  startDate: string;
  endMode: "none" | "date" | "count";
  endDate?: string;
  occurrences?: number;
  variableAmount: boolean;
}

export interface LaunchItemInput {
  kind: LaunchKind;
  categoryId?: string;
  rawMaterialId?: string;
  catalogItemId?: string;
  employeeId?: string;
  nameSnapshot: string;
  description?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  rateable?: boolean;
  contractLabel?: string;
  payrollType?: "salary" | "advance";
  referenceExpenseId?: string;
  breakdown?: { extra: number; discount: number };
  recurrence?: RecurrenceInput;
}

export interface InstallmentInput {
  number: number;
  amount: number;
  dueDate: string;
  scheduledPaymentAt?: string;
  boletoCode?: string;
}

export interface LaunchPayload {
  kind: LaunchKind;
  partyType: "supplier" | "partner" | "employee" | "other";
  partyName: string;
  supplierId?: string;
  partnerId?: string;
  competence: string;
  documentRef?: string;
  documentSeries?: string;
  documentIssueDate?: string;
  documentAccessKey?: string;
  batch?: string;
  expiryDate?: string;
  freight: number;
  discount: number;
  received: boolean;
  paymentMethod?: string;
  paymentCondition?: string;
  scheduled: boolean;
  recipientKey?: string;
  recipientHolder?: string;
  observations?: string;
  duplicateReason?: string;
  items: LaunchItemInput[];
  installments: InstallmentInput[];
  idempotencyKey: string;
}

function toRecurrenceJson(r?: RecurrenceInput) {
  if (!r || !r.enabled) return null;
  return {
    enabled: true,
    frequency: r.frequency,
    interval_days: r.intervalDays ?? null,
    day_of_month: r.dayOfMonth ?? null,
    start_date: r.startDate,
    end_mode: r.endMode,
    end_date: r.endDate ?? null,
    occurrences: r.occurrences ?? null,
    variable_amount: r.variableAmount,
  };
}

function toPayloadJson(p: LaunchPayload) {
  return {
    kind: p.kind,
    party_type: p.partyType,
    party_name: p.partyName,
    supplier_id: p.supplierId ?? null,
    partner_id: p.partnerId ?? null,
    competence: p.competence,
    document_ref: p.documentRef ?? null,
    document_series: p.documentSeries ?? null,
    document_issue_date: p.documentIssueDate ?? null,
    document_access_key: p.documentAccessKey ?? null,
    batch: p.batch ?? null,
    expiry_date: p.expiryDate ?? null,
    freight: p.freight,
    discount: p.discount,
    received: p.received,
    payment_method: p.paymentMethod ?? null,
    payment_condition: p.paymentCondition ?? null,
    scheduled: p.scheduled,
    recipient_key: p.recipientKey ?? null,
    recipient_holder: p.recipientHolder ?? null,
    observations: p.observations ?? null,
    duplicate_reason: p.duplicateReason ?? null,
    idempotency_key: p.idempotencyKey,
    items: p.items.map((i) => ({
      kind: i.kind,
      category_id: i.categoryId ?? null,
      raw_material_id: i.rawMaterialId ?? null,
      catalog_item_id: i.catalogItemId ?? null,
      employee_id: i.employeeId ?? null,
      name_snapshot: i.nameSnapshot,
      description: i.description?.trim() || null,
      unit: i.unit,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      rateable: i.rateable ?? false,
      contract_label: i.contractLabel ?? null,
      payroll_type: i.payrollType ?? null,
      reference_expense_id: i.referenceExpenseId ?? null,
      breakdown: i.breakdown ? { extra: i.breakdown.extra, discount: i.breakdown.discount } : null,
      recurrence: toRecurrenceJson(i.recurrence),
    })),
    installments: p.installments.map((inst) => ({
      number: inst.number,
      amount: inst.amount,
      due_date: inst.dueDate,
      scheduled_payment_at: inst.scheduledPaymentAt ?? null,
      boleto_code: inst.boletoCode ?? null,
    })),
  };
}

interface ExpenseLaunchState {
  categories: ExpenseCategory[];
  catalogItems: ExpenseCatalogItem[];
  recurrences: ExpenseRecurrence[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  createCategory: (name: string, kind: LaunchKind, rateable: boolean) => Promise<string | null>;
  updateCategoryName: (id: string, name: string) => Promise<string | null>;
  deleteCategory: (id: string) => Promise<string | null>;
  setCategoryRate: (id: string, rateable: boolean) => Promise<string | null>;
  createCatalogItem: (input: { name: string; kind: "asset" | "expense" | "partner"; categoryId: string; unit: string; suggestedPrice: number; suggestRecurring: boolean }) => Promise<string | null>;
  updateCatalogItemName: (id: string, name: string) => Promise<string | null>;
  deleteCatalogItem: (id: string) => Promise<string | null>;
  findCommitment: (kind: LaunchKind, partyName: string, contractLabel: string, rawMaterialId?: string, catalogItemId?: string) => ExpenseRecurrence | null;
  createLaunch: (payload: LaunchPayload) => Promise<{ launchId: string | null; error: string | null }>;
}

export const useExpenseLaunchStore = create<ExpenseLaunchState>((set, get) => ({
  categories: [],
  catalogItems: [],
  recurrences: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const [{ data: catRows }, { data: itemRows }, { data: recRows }] = await Promise.all([
      supabase.from("expense_categories").select("id, name, kind, rateable").eq("company_id", companyId).eq("active", true).order("name"),
      supabase.from("expense_catalog_items").select("id, name, code, category_id, kind, unit, suggested_price, suggest_recurring").eq("company_id", companyId).eq("active", true).order("name"),
      supabase.from("expense_recurrences").select("id, kind, party_name, contract_label, amount, frequency, raw_material_id, catalog_item_id, status").eq("company_id", companyId).eq("status", "ATIVA"),
    ]);

    set({
      categories: (catRows ?? []).map((c) => ({ id: c.id, name: c.name, kind: c.kind as LaunchKind, rateable: c.rateable })),
      catalogItems: (itemRows ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        code: i.code,
        categoryId: i.category_id,
        kind: i.kind as ExpenseCatalogItem["kind"],
        unit: i.unit,
        suggestedPrice: i.suggested_price,
        suggestRecurring: i.suggest_recurring,
      })),
      recurrences: (recRows ?? []).map((r) => ({
        id: r.id,
        kind: r.kind as LaunchKind,
        partyName: r.party_name,
        contractLabel: r.contract_label,
        amount: r.amount,
        frequency: r.frequency as ExpenseRecurrence["frequency"],
        rawMaterialId: r.raw_material_id,
        catalogItemId: r.catalog_item_id,
        status: r.status as ExpenseRecurrence["status"],
      })),
      status: "ready",
    });
  },

  createCategory: async (name, kind, rateable) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error } = await supabase.from("expense_categories").insert({ company_id: companyId, name, kind, rateable });
    if (error) return error.code === "23505" ? "Categoria já cadastrada" : error.message;
    await get().fetchAll();
    return null;
  },

  updateCategoryName: async (id, name) => {
    const { error } = await supabase.from("expense_categories").update({ name }).eq("id", id);
    if (error) return error.code === "23505" ? "Categoria já cadastrada" : error.message;
    await get().fetchAll();
    return null;
  },

  deleteCategory: async (id) => {
    const { error } = await supabase.from("expense_categories").update({ active: false }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  setCategoryRate: async (id, rateable) => {
    const { error } = await supabase.from("expense_categories").update({ rateable }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  createCatalogItem: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const code = `CAD-${String(get().catalogItems.length + 1).padStart(4, "0")}`;
    const { error } = await supabase.from("expense_catalog_items").insert({
      company_id: companyId,
      name: input.name,
      code,
      category_id: input.categoryId,
      kind: input.kind,
      unit: input.unit,
      suggested_price: input.suggestedPrice,
      suggest_recurring: input.suggestRecurring,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  updateCatalogItemName: async (id, name) => {
    const { error } = await supabase.from("expense_catalog_items").update({ name }).eq("id", id);
    if (error) return error.code === "23505" ? "Item já cadastrado" : error.message;
    await get().fetchAll();
    return null;
  },

  deleteCatalogItem: async (id) => {
    const { error } = await supabase.from("expense_catalog_items").update({ active: false }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  findCommitment: (kind, partyName, contractLabel, rawMaterialId, catalogItemId) => {
    return (
      get().recurrences.find(
        (r) =>
          r.kind === kind &&
          r.partyName === partyName &&
          r.contractLabel === contractLabel &&
          (rawMaterialId ? r.rawMaterialId === rawMaterialId : catalogItemId ? r.catalogItemId === catalogItemId : false)
      ) ?? null
    );
  },

  createLaunch: async (payload) => {
    const { data, error } = await supabase.rpc("create_expense_launch", { p_payload: toPayloadJson(payload) });
    if (error) return { launchId: null, error: error.message };
    return { launchId: data as string, error: null };
  },
}));
