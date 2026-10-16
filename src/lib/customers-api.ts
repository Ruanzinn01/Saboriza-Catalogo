import { supabase } from "@/lib/supabase";
import { fromUntyped, rpcUntyped } from "@/lib/supabase-rpc";

// As RPCs/colunas de Clientes V1 ainda não estão em src/types/supabase.ts (a migration está pendente e
// regenerar o arquivo exige reaplicar ajustes), então são chamadas sem tipagem gerada, com retorno tipado aqui.

export type ListCategory = "all" | "active" | "recent" | "old" | "prospect";
export type ListFinance = "all" | "debt" | "clear";
export type ListRegistration = "all" | "active" | "inactive";
export type ListSort = "purchase" | "name" | "debt";
export const PAGE_SIZES = [10, 20, 30, 50] as const;

export interface CustomerListFilters {
  search: string;
  city: string;
  uf: string;
  neighborhood: string;
  sellerId: string;
  promoterId: string;
  finance: ListFinance;
  registration: ListRegistration;
  category: ListCategory;
  sort: ListSort;
  page: number;
  pageSize: number;
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface CustomerListItem {
  id: string;
  display_number: number;
  trade_name: string;
  legal_name: string;
  contact_name: string;
  document: string;
  person_type: "PF" | "PJ";
  phone: string;
  city: string;
  state: string;
  registration_status: "ATIVO" | "INATIVO";
  revision: number;
  has_location: boolean;
  photo_count: number;
  category: Exclude<ListCategory, "all">;
  last_purchase: string | null;
  seller: PersonRef | null;
  promoter: PersonRef | null;
  open_balance: number | null;
  overdue_balance: number | null;
  overdue_count: number | null;
}

export interface CustomerListResult {
  as_of: string;
  finance_available: boolean;
  total: number;
  page: number;
  pages: number;
  page_size: number;
  items: CustomerListItem[];
  summary: { total: number; active: number; recent: number; old: number; prospect: number; with_debt: number | null };
  kpis: { total: number; active: number; prospect: number; with_debt: number | null };
  options: { cities: string[]; states: string[]; sellers: PersonRef[]; promoters: PersonRef[] };
}

export interface CustomerCapabilities {
  member: boolean;
  can_propose_credit: boolean;
  can_manage_limit: boolean;
  can_view_receivables: boolean;
  can_view_credit: boolean;
}

export type ApiResult<T> = { state: "ready"; data: T } | { state: "unavailable" } | { state: "error"; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function friendlyCustomerError(message: string): string {
  if (message.includes("CONFLITO_REVISAO")) return "Este cadastro foi alterado por outra pessoa. Recarregue para ver a versão atual antes de salvar.";
  if (message.includes("DOCUMENTO_DUPLICADO")) return "Já existe um cliente com este documento nesta empresa.";
  if (message.includes("IBGE_INVALIDO")) return "O código do município não confere com a UF. Escolha o município na lista ou busque o CEP.";
  if (message.includes("COMANDO_REUSADO")) return "Esta operação já foi enviada com outros dados. Recarregue e tente de novo.";
  if (message.includes("CLIENTE_COM_HISTORICO")) return "Este cliente tem histórico e não pode ser excluído. Inative o cadastro.";
  if (message.includes("propor condicoes")) return "Você não tem permissão para propor condições comerciais.";
  if (message.includes("sem acesso")) return "Você não tem acesso a este cliente.";
  return message;
}

export async function fetchCustomersList(companyId: string, filters: CustomerListFilters): Promise<ApiResult<CustomerListResult>> {
  const { data, error } = await rpcUntyped("oris360_customers_list", {
    p_company_id: companyId,
    p_search: filters.search.trim() || null,
    p_city: filters.city || null,
    p_uf: filters.uf || null,
    p_neighborhood: filters.neighborhood.trim() || null,
    p_seller: filters.sellerId || null,
    p_promoter: filters.promoterId || null,
    p_finance: filters.finance,
    p_registration: filters.registration,
    p_category: filters.category,
    p_sort: filters.sort,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  });
  if (error) return { state: "error", message: friendlyCustomerError(error.message) };
  if (!isObject(data)) return { state: "unavailable" };
  return { state: "ready", data: data as unknown as CustomerListResult };
}

export async function fetchCustomerCapabilities(companyId: string): Promise<CustomerCapabilities | null> {
  const { data, error } = await rpcUntyped("oris360_customer_capabilities", { p_company_id: companyId });
  if (error || !isObject(data)) return null;
  return data as unknown as CustomerCapabilities;
}

export interface CustomerProfile {
  id: string;
  company_id: string;
  display_number: number;
  revision: number;
  person_type: "PF" | "PJ";
  registration_status: "ATIVO" | "INATIVO";
  inactivation_reason: string | null;
  trade_name: string;
  company_name: string;
  name: string;
  contact_role: string | null;
  phone: string;
  whatsapp_enabled: boolean;
  email: string;
  cnpj: string;
  ie: string;
  ie_exempt: boolean;
  tax_profile: string | null;
  cep: string;
  state: string;
  city: string;
  ibge_code: string | null;
  address: string;
  address_number: string;
  neighborhood: string;
  address_complement: string;
  delivery_reference: string;
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  location_accuracy_m: number | null;
  location_confirmed_at: string | null;
  segment: string | null;
  origin: string | null;
  seller_employee_id: string | null;
  promoter_employee_id: string | null;
  service_notes: string;
  proposed_credit_limit: number;
  preferred_payment_days: string | null;
  preferred_payment_method: string | null;
  credit_analysis_state: "NAO_ANALISADO" | "EM_ANALISE" | "CONFERIDO";
  credit_notes: string;
  created_at: string;
}

export interface CustomerContact {
  id: string;
  name: string;
  role: string | null;
  phone: string;
  whatsapp_enabled: boolean;
  email: string;
}

export type MediaCategory = "FACHADA" | "INTERIOR" | "OUTRA";

export interface CustomerMedia {
  id: string;
  category: MediaCategory;
  caption: string;
  primary_front: boolean;
  storage_path: string;
  created_at: string;
}

export interface CustomerFullProfile {
  customer: CustomerProfile;
  contacts: CustomerContact[];
  media: CustomerMedia[];
  seller: PersonRef | null;
  promoter: PersonRef | null;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCustomerProfile(customerId: string): Promise<ApiResult<CustomerFullProfile | null>> {
  const customerRes = await fromUntyped("customers").select("*").eq("id", customerId).limit(1);
  if (customerRes.error) return { state: "error", message: customerRes.error.message };
  const row = (customerRes.data as Record<string, unknown>[] | null)?.[0];
  if (!row) return { state: "ready", data: null };

  const [contactsRes, mediaRes] = await Promise.all([
    fromUntyped("customer_contacts").select("id, name, role, phone, whatsapp_enabled, email").eq("customer_id", customerId).order("created_at", { ascending: true }),
    fromUntyped("customer_media").select("id, category, caption, primary_front, storage_path, created_at").eq("customer_id", customerId).order("created_at", { ascending: true }),
  ]);
  const ids = [row.seller_employee_id, row.promoter_employee_id].filter((value): value is string => typeof value === "string");
  const people = ids.length ? await fromUntyped("employees").select("id, name").in("id", ids) : { data: [], error: null };
  const peopleRows = (people.data as PersonRef[] | null) ?? [];
  const customer = {
    ...row,
    latitude: numeric(row.latitude),
    longitude: numeric(row.longitude),
    location_accuracy_m: numeric(row.location_accuracy_m),
    proposed_credit_limit: numeric(row.proposed_credit_limit) ?? 0,
  } as unknown as CustomerProfile;
  return {
    state: "ready",
    data: {
      customer,
      contacts: (contactsRes.data as CustomerContact[] | null) ?? [],
      media: (mediaRes.data as CustomerMedia[] | null) ?? [],
      seller: peopleRows.find((p) => p.id === row.seller_employee_id) ?? null,
      promoter: peopleRows.find((p) => p.id === row.promoter_employee_id) ?? null,
    },
  };
}

export async function fetchEmployeeOptions(companyId: string): Promise<PersonRef[]> {
  const { data, error } = await fromUntyped("employees").select("id, name").eq("company_id", companyId).eq("status", "ATIVO").order("name", { ascending: true });
  if (error || !data) return [];
  return data as PersonRef[];
}

export async function saveCustomer(args: {
  commandId: string;
  companyId: string;
  customerId: string | null;
  expectedRevision: number | null;
  data: Record<string, unknown>;
}): Promise<{ ok: true; customerId: string; revision: number; replayed: boolean } | { ok: false; message: string; conflict: boolean }> {
  const { data, error } = await rpcUntyped("oris360_customer_save", {
    p_command_id: args.commandId,
    p_company_id: args.companyId,
    p_customer_id: args.customerId,
    p_expected_revision: args.expectedRevision,
    p_data: args.data,
  });
  if (error) return { ok: false, message: friendlyCustomerError(error.message), conflict: error.message.includes("CONFLITO_REVISAO") };
  const result = data as { customer_id: string; revision: number; replayed: boolean };
  return { ok: true, customerId: result.customer_id, revision: result.revision, replayed: Boolean(result.replayed) };
}

export async function setCustomerStatus(args: {
  commandId: string;
  customerId: string;
  status: "ATIVO" | "INATIVO";
  reason: string;
  expectedRevision: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await rpcUntyped("oris360_customer_set_status", {
    p_command_id: args.commandId,
    p_customer_id: args.customerId,
    p_status: args.status,
    p_reason: args.reason,
    p_expected_revision: args.expectedRevision,
  });
  return error ? { ok: false, message: friendlyCustomerError(error.message) } : { ok: true };
}

export interface OpenTitle {
  id: string;
  order_number: string | null;
  amount: number;
  balance: number;
  partial: boolean;
  due_date: string;
  days_late: number;
  overdue: boolean;
  method: string | null;
}

export interface PaidTitle {
  id: string;
  order_number: string | null;
  amount: number;
  due_date: string;
  paid_date: string;
  days_late: number;
  on_time: boolean;
  method: string | null;
}

export interface ReceivablesView {
  as_of: string;
  since: string;
  open: OpenTitle[];
  paid: PaidTitle[];
  summary: { paid_count: number; on_time_count: number; late_count: number; on_time_percent: number | null };
  open_summary: { overdue_count: number; overdue_amount: number; oldest_days: number; upcoming_count: number; upcoming_amount: number };
}

export async function fetchReceivablesView(customerId: string): Promise<ApiResult<ReceivablesView>> {
  const { data, error } = await rpcUntyped("oris360_customer_receivables", { p_customer_id: customerId, p_months: 12 });
  if (error) return { state: "error", message: error.message };
  if (!isObject(data)) return { state: "unavailable" };
  return { state: "ready", data: data as unknown as ReceivablesView };
}

export type PurchasePeriod = "month" | "six" | "year";

export interface PurchasedProduct {
  position: number;
  product_id: string | null;
  name: string;
  value: number;
  units: number;
  image_url: string | null;
  share: number | null;
}

export interface CommercialSummary {
  as_of: string;
  period: PurchasePeriod;
  from: string;
  total: number;
  count: number;
  series: { key: string; value: number; count: number }[];
  last_order_at: string | null;
  last_billed_purchase: string | null;
  rank: { position: number | null; universe: number; criterion: string };
  products_total: number;
  products: PurchasedProduct[];
}

export async function fetchCommercialSummary(customerId: string, period: PurchasePeriod, productsLimit = 10, productsOffset = 0): Promise<ApiResult<CommercialSummary>> {
  const { data, error } = await rpcUntyped("oris360_customer_commercial_summary", {
    p_customer_id: customerId,
    p_period: period,
    p_products_limit: productsLimit,
    p_products_offset: productsOffset,
  });
  if (error) return { state: "error", message: error.message };
  if (!isObject(data)) return { state: "unavailable" };
  return { state: "ready", data: data as unknown as CommercialSummary };
}

// ---- Fotos -------------------------------------------------------------------------------------

export const MEDIA_BUCKET = "customer-media";
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImageFile(file: { type: string; size: number; name: string }): string | null {
  if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) return `${file.name}: use JPG, PNG ou WebP`;
  if (file.size > MEDIA_MAX_BYTES) return `${file.name}: acima de 8 MB`;
  return null;
}

interface MutableTable {
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  delete: () => { eq: (column: string, value: unknown) => PromiseLike<{ error: { message: string } | null }> };
  update: (row: Record<string, unknown>) => { eq: (column: string, value: unknown) => PromiseLike<{ error: { message: string } | null }> };
}

function mutable(table: string): MutableTable {
  return (supabase.from as unknown as (table: string) => MutableTable)(table);
}

export async function uploadCustomerPhoto(args: {
  customerId: string;
  file: File;
  category: MediaCategory;
  caption: string;
  storagePath?: string;
}): Promise<{ ok: true; storagePath: string } | { ok: false; message: string }> {
  const invalid = validateImageFile(args.file);
  if (invalid) return { ok: false, message: invalid };
  const extension = args.file.type === "image/png" ? "png" : args.file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = args.storagePath ?? `${args.customerId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, args.file, { contentType: args.file.type, upsert: false });
  if (upload.error && !/already exists|Duplicate/i.test(upload.error.message)) return { ok: false, message: upload.error.message };
  const inserted = await mutable("customer_media").insert({
    customer_id: args.customerId,
    category: args.category,
    caption: args.caption,
    storage_path: storagePath,
    mime_type: args.file.type,
    size_bytes: args.file.size,
  });
  if (inserted.error && !/duplicate key|unique/i.test(inserted.error.message)) return { ok: false, message: inserted.error.message };
  return { ok: true, storagePath };
}

export async function updateCustomerMedia(mediaId: string, patch: { category?: MediaCategory; caption?: string }): Promise<string | null> {
  const { error } = await mutable("customer_media").update(patch).eq("id", mediaId);
  return error ? error.message : null;
}

export async function setPrimaryCustomerPhoto(mediaId: string): Promise<string | null> {
  const { error } = await rpcUntyped("oris360_customer_media_set_primary", { p_media_id: mediaId });
  return error ? error.message : null;
}

export async function removeCustomerPhoto(media: { id: string; storage_path: string }): Promise<string | null> {
  const row = await mutable("customer_media").delete().eq("id", media.id);
  if (row.error) return row.error.message;
  await supabase.storage.from(MEDIA_BUCKET).remove([media.storage_path]);
  return null;
}

export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 300);
  if (error || !data) return {};
  const result: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) result[item.path] = item.signedUrl;
  return result;
}
