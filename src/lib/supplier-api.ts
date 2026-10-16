import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { callRpc, selectFrom } from "@/lib/supplier-rpc";
import type { FinanceRow, FinancialSummary } from "@/lib/supplier-finance";
import type { SupplierExportRow } from "@/lib/supplier-csv";
import type { SupplierContact } from "@/types/supplier";

// Chaves de permissão do domínio (migration 20261016141000). A tela só esconde/mostra; quem autoriza é o servidor.
export const SUPPLIER_PERMISSIONS = [
  "fornecedores.read",
  "fornecedores.manage",
  "fornecedores.categorias",
  "fornecedores.financeiro",
  "fornecedores.anexos",
  "fornecedores.exportar",
  "fornecedores.banco.read",
  "fornecedores.banco.manage",
  "fornecedores.banco.verify",
] as const;

export type SupplierPermission = (typeof SUPPLIER_PERMISSIONS)[number];
export type SupplierPermissions = Record<SupplierPermission, boolean>;

export async function loadSupplierPermissions(): Promise<SupplierPermissions | null> {
  const companyId = await resolveCurrentCompanyId();
  if (!companyId) return null;
  const results = await Promise.all(
    SUPPLIER_PERMISSIONS.map(async (key) => {
      const { data, error } = await callRpc<boolean>("oris360_has_permission", { p_company_id: companyId, p_permission_key: key });
      return [key, error ? false : data === true] as const;
    })
  );
  return Object.fromEntries(results) as SupplierPermissions;
}

export const NO_SUPPLIER_PERMISSIONS: SupplierPermissions = Object.fromEntries(SUPPLIER_PERMISSIONS.map((key) => [key, false])) as SupplierPermissions;

// ---- Contatos adicionais -------------------------------------------------------------------------------------------
export async function fetchSupplierContacts(supplierId: string): Promise<SupplierContact[]> {
  const { data, error } = await selectFrom("supplier_contacts", "name, role, phone, whatsapp, email, position").eq("supplier_id", supplierId).order("position", { ascending: true });
  if (error || !data) return [];
  return (data as { name: string; role: string; phone: string; whatsapp: boolean; email: string }[]).map((row) => ({
    name: row.name,
    role: row.role,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
  }));
}

// ---- Favorecido / banco / Pix --------------------------------------------------------------------------------------
export interface BankDetails {
  exists: boolean;
  masked?: boolean;
  beneficiary_name?: string;
  beneficiary_document?: string;
  bank?: string;
  branch?: string;
  account?: string;
  pix_type?: string;
  pix_key?: string;
  notes?: string;
  verification_status?: "PENDENTE" | "VERIFICADO";
  verified_at?: string | null;
  bank_revision?: number;
}

export type BankInput = Required<Pick<BankDetails, "beneficiary_name" | "beneficiary_document" | "bank" | "branch" | "account" | "pix_type" | "pix_key" | "notes">>;

export const emptyBankInput: BankInput = {
  beneficiary_name: "",
  beneficiary_document: "",
  bank: "",
  branch: "",
  account: "",
  pix_type: "",
  pix_key: "",
  notes: "",
};

export async function fetchBankDetails(supplierId: string, reveal: boolean) {
  return callRpc<BankDetails>("get_supplier_bank_details", { p_supplier_id: supplierId, p_reveal: reveal });
}

export async function saveBankDetails(supplierId: string, input: BankInput) {
  return callRpc<{ exists: boolean; verification_status?: string; bank_revision?: number }>("set_supplier_bank_details", { p_supplier_id: supplierId, p_payload: input });
}

export async function verifyBankDetails(supplierId: string) {
  return callRpc<{ verification_status: string }>("verify_supplier_bank_details", { p_supplier_id: supplierId });
}

// ---- Arquivos e fotos ----------------------------------------------------------------------------------------------
export type SupplierFileKind = "FOTO" | "DOCUMENTO" | "REFERENCIA";

export interface SupplierFile {
  id: string;
  supplierId: string | null;
  candidateId: string | null;
  kind: SupplierFileKind;
  photoKind: "Fachada" | "Interior" | "Outra" | null;
  caption: string;
  isPrimary: boolean;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_TYPES = [...PHOTO_TYPES, "application/pdf"];
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 12;

// Validação prévia no navegador (o servidor confere o tipo e o tamanho REAIS do arquivo guardado).
export function validateUpload(file: { name: string; type: string; size: number }, kind: SupplierFileKind): string | null {
  const allowed = kind === "FOTO" ? PHOTO_TYPES : DOCUMENT_TYPES;
  if (!allowed.includes(file.type)) return kind === "FOTO" ? "Foto deve ser JPG, PNG ou WebP." : "Aceitamos PDF, JPG, PNG ou WebP.";
  if (file.size <= 0) return "O arquivo está vazio.";
  if (file.size > (kind === "FOTO" ? MAX_PHOTO_BYTES : MAX_DOCUMENT_BYTES)) return kind === "FOTO" ? "Foto acima de 8 MB." : "Arquivo acima de 10 MB.";
  return null;
}

export function safeFileName(raw: string): string {
  const name = raw.split(/[\\/]/).pop() ?? raw;
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "arquivo";
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  return ext ? `${base}.${ext}` : base;
}

interface FileRow {
  id: string;
  supplier_id: string | null;
  candidate_id: string | null;
  kind: SupplierFileKind;
  photo_kind: "Fachada" | "Interior" | "Outra" | null;
  caption: string;
  is_primary: boolean;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | string;
  uploaded_at: string;
  removed_at: string | null;
}

export function fileFromRow(row: FileRow): SupplierFile {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    candidateId: row.candidate_id,
    kind: row.kind,
    photoKind: row.photo_kind,
    caption: row.caption,
    isPrimary: row.is_primary,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    uploadedAt: row.uploaded_at,
  };
}

export async function listFiles(target: { supplierId?: string; candidateId?: string }): Promise<SupplierFile[] | null> {
  const column = target.supplierId ? "supplier_id" : "candidate_id";
  const value = target.supplierId ?? target.candidateId ?? "";
  const { data, error } = await selectFrom("supplier_files", "*").eq(column, value).order("uploaded_at", { ascending: false });
  if (error) return null;
  return ((data as FileRow[]) ?? []).filter((row) => row.removed_at === null).map(fileFromRow);
}

export async function uploadSupplierFile(params: {
  supplierId?: string;
  candidateId?: string;
  kind: SupplierFileKind;
  file: File;
  caption?: string;
  photoKind?: "Fachada" | "Interior" | "Outra";
  primary?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const invalid = validateUpload(params.file, params.kind);
  if (invalid) return { ok: false, error: invalid };
  const companyId = await resolveCurrentCompanyId();
  if (!companyId) return { ok: false, error: "Não foi possível identificar a empresa." };
  const path = `${companyId}/${crypto.randomUUID()}-${safeFileName(params.file.name)}`;
  const uploaded = await supabase.storage.from("supplier-files").upload(path, params.file, { contentType: params.file.type, upsert: false });
  if (uploaded.error) return { ok: false, error: "Não foi possível enviar o arquivo. Tente de novo." };
  const registered = await callRpc("register_supplier_file", {
    p_supplier_id: params.supplierId ?? null,
    p_candidate_id: params.candidateId ?? null,
    p_kind: params.kind,
    p_path: path,
    p_file_name: params.file.name,
    p_mime: params.file.type,
    p_size: params.file.size,
    p_caption: params.caption ?? "",
    p_photo_kind: params.photoKind ?? null,
    p_primary: params.primary ?? false,
  });
  if (registered.error) return { ok: false, error: registered.error.includes("Sem permiss") ? "Você não tem permissão para anexar arquivos." : registered.error };
  return { ok: true };
}

export async function removeFile(fileId: string) {
  return callRpc<null>("remove_supplier_file", { p_id: fileId });
}

// URL assinada de curta duração (60 s); contrato, banco e documento nunca ficam em URL pública.
export async function signedFileUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("supplier-files").createSignedUrl(path, 60);
  return error || !data ? null : data.signedUrl;
}

// ---- Cotações da avaliação -------------------------------------------------------------------------------------------
export interface CandidateQuote {
  id: string;
  item: string;
  unit: string;
  quantity: number;
  priceCents: number;
  freightCents: number;
  validUntil: string | null;
  source: string;
  quotedOn: string;
}

export async function listQuotes(candidateId: string): Promise<CandidateQuote[]> {
  const { data, error } = await selectFrom("supplier_candidate_quotes", "*").eq("candidate_id", candidateId).order("quoted_on", { ascending: false });
  if (error || !data) return [];
  return (data as { id: string; item: string; unit: string; quantity: number | string; price_cents: number | string; freight_cents: number | string; valid_until: string | null; source: string; quoted_on: string }[]).map((row) => ({
    id: row.id,
    item: row.item,
    unit: row.unit,
    quantity: Number(row.quantity),
    priceCents: Number(row.price_cents),
    freightCents: Number(row.freight_cents),
    validUntil: row.valid_until,
    source: row.source,
    quotedOn: row.quoted_on,
  }));
}

export async function addQuote(candidateId: string, quote: { item: string; unit: string; quantity: number; priceCents: number; freightCents: number; validUntil: string; source: string }) {
  return callRpc<{ id: string }>("add_candidate_quote", {
    p_candidate_id: candidateId,
    p_payload: {
      item: quote.item,
      unit: quote.unit,
      quantity: quote.quantity,
      price_cents: quote.priceCents,
      freight_cents: quote.freightCents,
      valid_until: quote.validUntil || null,
      source: quote.source,
    },
  });
}

// ---- Eventos / histórico ---------------------------------------------------------------------------------------------
export interface SupplierEvent {
  eventType: string;
  occurredAt: string;
  revision: number | null;
  fields: string[];
}

export const EVENT_LABELS: Record<string, string> = {
  "supplier.created": "Cadastro criado",
  "supplier.updated": "Cadastro alterado",
  "supplier.categories_changed": "Categorias alteradas",
  "supplier.bank_details_changed": "Dados bancários alterados (valores não são exibidos)",
  "supplier.bank_details_verified": "Dados bancários conferidos",
  "media.changed": "Arquivo ou foto alterado",
  "supplier_candidate.registered": "Avaliação registrada",
  "supplier_candidate.updated": "Avaliação alterada",
  "supplier_candidate.contact_recorded": "Contato registrado",
  "supplier_candidate.converted": "Avaliação cadastrada como fornecedor",
};

export async function listSupplierEvents(supplierId: string): Promise<SupplierEvent[] | null> {
  const { data, error } = await selectFrom("supplier_events", "event_type, occurred_at, entity_revision, payload").eq("entity_id", supplierId).order("occurred_at", { ascending: false }).limit(50);
  if (error) return null;
  return ((data as { event_type: string; occurred_at: string; entity_revision: number | null; payload: { fields?: string[] } | null }[]) ?? []).map((row) => ({
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    revision: row.entity_revision,
    fields: row.payload?.fields ?? [],
  }));
}

// ---- Rascunho persistente --------------------------------------------------------------------------------------------
export interface DraftTarget {
  supplierId: string | null;
  candidateId: string | null;
}

export async function saveDraft(target: DraftTarget, expectedVersion: number, payload: Record<string, unknown>) {
  return callRpc<{ version: number }>("save_supplier_draft", {
    p_supplier_id: target.supplierId,
    p_candidate_id: target.candidateId,
    p_expected_version: expectedVersion,
    p_payload: payload,
  });
}

export async function getDraft(target: DraftTarget) {
  return callRpc<{ payload: Record<string, unknown>; version: number; updated_at: string } | null>("get_supplier_draft", {
    p_supplier_id: target.supplierId,
    p_candidate_id: target.candidateId,
  });
}

export async function discardDraft(target: DraftTarget) {
  return callRpc<null>("discard_supplier_draft", { p_supplier_id: target.supplierId, p_candidate_id: target.candidateId });
}

// ---- Posição financeira ----------------------------------------------------------------------------------------------
export interface FinanceList {
  as_of: string;
  timezone: string;
  rows: FinanceRow[];
}

export async function fetchFinanceList(from: string | null, to: string | null) {
  return callRpc<FinanceList>("list_suppliers_financial", { p_from: from, p_to: to });
}

export async function fetchFinanceSummary(supplierId: string, from: string | null, to: string | null) {
  return callRpc<FinancialSummary>("supplier_financial_summary", { p_supplier_id: supplierId, p_from: from, p_to: to });
}

export async function fetchExportRows(ids: string[]) {
  return callRpc<{ exported_at: string; rows: SupplierExportRow[] }>("list_suppliers_export", { p_ids: ids });
}
