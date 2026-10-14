import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { normalizeText } from "@/lib/inventory";
import { useCatalogStore } from "@/store/catalog-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import type { ControlUnit } from "@/types/raw-material";

export type PurchaseItemType = "PRODUCT" | "RAW_MATERIAL";
export type PurchaseUsage = "MATERIAL" | "RESALE";

export interface PurchaseCatalogItem {
  itemType: PurchaseItemType;
  itemId: string;
  sku: string;
  name: string;
  brand: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  usage: PurchaseUsage;
  gtin: string;
  supplierCode: string;
  currentStock: number;
  avgCost: number;
  lastPurchaseCost: number | null;
  lastPurchaseDate: string | null;
  salePrice: number | null;
  targetMarginPct: number | null;
  imageUrl: string;
  tracksLots: boolean;
}

export interface PurchaseDraftSummary {
  id: string;
  supplierLabel: string;
  documentRef: string;
  version: number;
  updatedAt: string;
  createdBy: string;
}

export interface LaunchItemRow {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  landedUnitCost: number | null;
  receivedAt: string | null;
  returnedQuantity: number;
  itemType: PurchaseItemType | null;
}

export const DRAFT_CONFLICT = "CONFLITO_RASCUNHO";

function toCatalogItem(row: {
  item_type: string;
  item_id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category_id: string | null;
  category_name: string | null;
  unit: string;
  usage: string;
  gtin: string | null;
  supplier_code: string | null;
  current_stock: number;
  avg_cost: number;
  last_purchase_cost: number | null;
  last_purchase_date: string | null;
  sale_price: number | null;
  target_margin_pct: number | null;
  image_url: string | null;
  tracks_lots: boolean;
}): PurchaseCatalogItem {
  return {
    itemType: row.item_type as PurchaseItemType,
    itemId: row.item_id,
    sku: row.sku ?? "",
    name: row.name,
    brand: row.brand ?? "",
    categoryId: row.category_id ?? "",
    categoryName: row.category_name ?? "",
    unit: row.unit,
    usage: row.usage === "RESALE" ? "RESALE" : "MATERIAL",
    gtin: row.gtin ?? "",
    supplierCode: row.supplier_code ?? "",
    currentStock: Number(row.current_stock),
    avgCost: Number(row.avg_cost),
    lastPurchaseCost: row.last_purchase_cost === null ? null : Number(row.last_purchase_cost),
    lastPurchaseDate: row.last_purchase_date,
    salePrice: row.sale_price === null ? null : Number(row.sale_price),
    targetMarginPct: row.target_margin_pct === null ? null : Number(row.target_margin_pct),
    imageUrl: row.image_url ?? "",
    tracksLots: row.tracks_lots,
  };
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface QuickItemInput {
  usage: PurchaseUsage;
  name: string;
  categoryName: string;
  unit: string;
  gtin: string;
  supplierId: string | null;
  supplierCode: string;
  brand: string;
  presentation: string;
}

interface PurchaseState {
  catalog: PurchaseCatalogItem[];
  catalogStatus: "idle" | "loading" | "ready" | "error";
  productCategories: { id: string; name: string }[];
  drafts: PurchaseDraftSummary[];

  fetchCatalog: (supplierId: string | null) => Promise<void>;
  fetchProductCategories: () => Promise<void>;
  fetchDrafts: () => Promise<void>;
  saveDraft: (input: {
    draftId: string | null;
    version: number;
    supplierLabel: string;
    documentRef: string;
    payload: unknown;
  }) => Promise<{ draftId: string; version: number } | { error: string; conflict: boolean }>;
  loadDraft: (draftId: string) => Promise<{ payload: unknown; version: number } | null>;
  closeDraft: (draftId: string, status: "DONE" | "DISCARDED") => Promise<void>;
  createProductCategory: (name: string) => Promise<{ id: string; name: string } | string>;
  createQuickItem: (input: QuickItemInput) => Promise<{ item: PurchaseCatalogItem } | { error: string }>;
  saveSupplierCode: (supplierId: string, itemType: PurchaseItemType, itemId: string, code: string) => Promise<string | null>;
  setLotTracking: (itemType: PurchaseItemType, itemId: string, enabled: boolean) => Promise<string | null>;
  fetchLaunchItems: (launchId: string) => Promise<LaunchItemRow[]>;
  confirmReceipt: (launchId: string) => Promise<string | null>;
  returnItems: (
    launchId: string,
    lines: { launchItemId: string; quantity: number }[],
    reason: string
  ) => Promise<{ returnedValue: number; appliedToOpen: number; creditCreated: number } | { error: string }>;
}

export const usePurchaseStore = create<PurchaseState>()((set, get) => ({
  catalog: [],
  catalogStatus: "idle",
  productCategories: [],
  drafts: [],

  fetchCatalog: async (supplierId) => {
    if (get().catalog.length === 0) set({ catalogStatus: "loading" });
    const { data, error } = await supabase.rpc("purchase_catalog", supplierId ? { p_supplier_id: supplierId } : {});
    if (error) {
      set({ catalogStatus: "error" });
      return;
    }
    set({ catalog: (data ?? []).map(toCatalogItem), catalogStatus: "ready" });
  },

  fetchProductCategories: async () => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const { data } = await supabase.from("categories").select("id, name").eq("company_id", companyId).eq("is_active", true).order("name");
    set({ productCategories: (data ?? []).map((row) => ({ id: row.id, name: row.name })) });
  },

  fetchDrafts: async () => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const { data } = await supabase
      .from("purchase_drafts")
      .select("id, supplier_label, document_ref, version, updated_at, created_by")
      .eq("company_id", companyId)
      .eq("status", "OPEN")
      .order("updated_at", { ascending: false });
    set({
      drafts: (data ?? []).map((row) => ({
        id: row.id,
        supplierLabel: row.supplier_label,
        documentRef: row.document_ref,
        version: row.version,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
      })),
    });
  },

  saveDraft: async ({ draftId, version, supplierLabel, documentRef, payload }) => {
    const { data, error } = await supabase.rpc("save_purchase_draft", {
      p_draft_id: draftId as string,
      p_expected_version: version,
      p_supplier_label: supplierLabel,
      p_document_ref: documentRef,
      p_payload: payload as never,
    });
    if (error) return { error: error.message, conflict: error.message.includes(DRAFT_CONFLICT) };
    const row = data?.[0];
    if (!row) return { error: "Não foi possível salvar o rascunho", conflict: false };
    return { draftId: row.draft_id, version: row.version };
  },

  loadDraft: async (draftId) => {
    const { data } = await supabase.from("purchase_drafts").select("payload, version, status").eq("id", draftId).maybeSingle();
    if (!data || data.status !== "OPEN") return null;
    return { payload: data.payload, version: data.version };
  },

  closeDraft: async (draftId, status) => {
    await supabase.rpc("close_purchase_draft", { p_draft_id: draftId, p_status: status });
    await get().fetchDrafts();
  },

  // Categoria de produto: reaproveita a existente (nome normalizado) em vez de criar duplicata.
  createProductCategory: async (name) => {
    const clean = name.trim();
    if (clean === "") return "Informe o nome da categoria";
    const existing = get().productCategories.find((category) => normalizeText(category.name) === normalizeText(clean));
    if (existing) return existing;
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { data: last } = await supabase.from("categories").select("sort_order").eq("company_id", companyId).order("sort_order", { ascending: false }).limit(1);
    const baseSlug = slugify(clean) || "categoria";
    const { data, error } = await supabase
      .from("categories")
      .insert({
        company_id: companyId,
        name: clean,
        slug: `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
        tagline: "",
        sort_order: (last?.[0]?.sort_order ?? 0) + 1,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (error || !data) return "Não foi possível criar a categoria";
    await get().fetchProductCategories();
    await useCatalogStore.getState().fetchCatalog();
    return { id: data.id, name: data.name };
  },

  createQuickItem: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return { error: "Não foi possível identificar a empresa" };
    const gtin = input.gtin.replace(/\D/g, "");

    if (gtin !== "") {
      const clash = get().catalog.find((item) => item.gtin === gtin);
      if (clash) return { error: `Este código de barras já pertence a "${clash.name}" (${clash.sku}).` };
    }

    let itemType: PurchaseItemType;
    let itemId: string;

    if (input.usage === "RESALE") {
      const category = get().productCategories.find((c) => normalizeText(c.name) === normalizeText(input.categoryName));
      if (!category) return { error: "Selecione uma categoria existente ou crie uma nova." };
      const { data, error } = await supabase
        .from("products")
        .insert({
          company_id: companyId,
          name: input.name.trim(),
          category_id: category.id,
          presentation: input.presentation.trim(),
          weight_volume: "",
          pack_quantity: 1,
          packaging_type: "Outro",
          unit_price: 0,
          brand: input.brand.trim(),
          gtin,
          nature: "RESALE",
          is_active: true,
          target_margin_pct: null,
        })
        .select("id")
        .single();
      if (error || !data) return { error: "Não foi possível cadastrar o produto de revenda." };
      itemType = "PRODUCT";
      itemId = data.id;
      await useCatalogStore.getState().fetchCatalog();
    } else {
      const created = await useRawMaterialsStore.getState().createMaterial({
        name: input.name.trim(),
        description: "",
        category: input.categoryName.trim(),
        controlUnit: input.unit as ControlUnit,
        imageUrl: "",
        purchaseUnitLabel: "",
        purchaseUnitFactor: 1,
        minStock: 0,
        maxStock: 0,
        minPurchaseQty: 0,
        defaultReorderQty: 0,
        purchaseMultiple: 0,
        leadTimeDays: 0,
        costBasis: "avg_cost",
        manualCost: 0,
        primarySupplierId: input.supplierId,
        gtin,
        isActive: true,
      });
      if (!created) return { error: "Não foi possível cadastrar o insumo." };
      itemType = "RAW_MATERIAL";
      itemId = created.id;
    }

    if (input.supplierId && input.supplierCode.trim() !== "") {
      await get().saveSupplierCode(input.supplierId, itemType, itemId, input.supplierCode.trim());
    }
    await get().fetchCatalog(input.supplierId);
    const item = get().catalog.find((candidate) => candidate.itemId === itemId);
    return item ? { item } : { error: "Item cadastrado, mas não encontrado no catálogo. Atualize a página." };
  },

  saveSupplierCode: async (supplierId, itemType, itemId, code) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const clean = code.trim();
    if (clean === "") {
      await supabase.from("item_supplier_codes").delete().eq("supplier_id", supplierId).eq("item_type", itemType).eq("item_id", itemId);
      return null;
    }
    const { error } = await supabase
      .from("item_supplier_codes")
      .upsert(
        { company_id: companyId, supplier_id: supplierId, item_type: itemType, item_id: itemId, code: clean },
        { onConflict: "company_id,supplier_id,item_type,item_id" }
      );
    if (error) return error.code === "23505" ? "Este código já está vinculado a outro item deste fornecedor." : error.message;
    return null;
  },

  setLotTracking: async (itemType, itemId, enabled) => {
    const { error } = await supabase.rpc("set_item_lot_tracking", { p_item_type: itemType, p_item_id: itemId, p_enabled: enabled });
    if (error) return error.message;
    await get().fetchCatalog(null);
    return null;
  },

  fetchLaunchItems: async (launchId) => {
    const { data } = await supabase
      .from("expense_launch_items")
      .select("id, name_snapshot, unit, quantity, unit_price, landed_unit_cost, received_at, returned_quantity, raw_material_id, product_id")
      .eq("launch_id", launchId)
      .eq("kind", "stock")
      .order("created_at");
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name_snapshot,
      unit: row.unit,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      landedUnitCost: row.landed_unit_cost === null ? null : Number(row.landed_unit_cost),
      receivedAt: row.received_at,
      returnedQuantity: Number(row.returned_quantity),
      itemType: row.product_id ? "PRODUCT" : row.raw_material_id ? "RAW_MATERIAL" : null,
    }));
  },

  confirmReceipt: async (launchId) => {
    const { error } = await supabase.rpc("confirm_launch_receipt", { p_launch_id: launchId });
    return error ? error.message : null;
  },

  returnItems: async (launchId, lines, reason) => {
    const { data, error } = await supabase.rpc("return_launch_items", {
      p_launch_id: launchId,
      p_lines: lines.map((line) => ({ launch_item_id: line.launchItemId, quantity: line.quantity })),
      p_reason: reason,
    });
    if (error) return { error: error.message };
    const row = data?.[0];
    return { returnedValue: Number(row?.returned_value ?? 0), appliedToOpen: Number(row?.applied_to_open ?? 0), creditCreated: Number(row?.credit_created ?? 0) };
  },
}));
