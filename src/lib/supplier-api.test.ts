import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const upload = vi.fn();
const createSignedUrl = vi.fn();
const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() };
const from = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...a),
    storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a), createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) },
  },
}));
vi.mock("@/lib/current-company", () => ({ resolveCurrentCompanyId: async () => "11111111-1111-4111-8111-111111111111" }));

import {
  addQuote,
  discardDraft,
  fetchBankDetails,
  fetchExportRows,
  fetchFinanceList,
  fetchFinanceSummary,
  getDraft,
  listFiles,
  listSupplierEvents,
  loadSupplierPermissions,
  safeFileName,
  saveBankDetails,
  saveDraft,
  SUPPLIER_PERMISSIONS,
  uploadSupplierFile,
  validateUpload,
} from "@/lib/supplier-api";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const file = (name: string, type: string, size: number) => ({ name, type, size }) as File;

beforeEach(() => {
  rpc.mockReset();
  upload.mockReset();
  createSignedUrl.mockReset();
  from.mockReset();
  for (const fn of Object.values(query)) fn.mockReset();
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
});

describe("permissões", () => {
  it("consulta as 9 chaves no servidor, pela empresa atual", async () => {
    rpc.mockImplementation(async (_fn: string, args: { p_permission_key: string }) => ({ data: args.p_permission_key === "fornecedores.read", error: null }));
    const perms = await loadSupplierPermissions();
    expect(rpc).toHaveBeenCalledTimes(SUPPLIER_PERMISSIONS.length);
    expect(rpc).toHaveBeenCalledWith("oris360_has_permission", { p_company_id: COMPANY, p_permission_key: "fornecedores.banco.read" });
    expect(perms?.["fornecedores.read"]).toBe(true);
    expect(perms?.["fornecedores.banco.read"]).toBe(false);
  });
  it("erro na consulta de permissão nega (nunca libera por padrão)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "falha" } });
    const perms = await loadSupplierPermissions();
    expect(Object.values(perms ?? {}).every((v) => v === false)).toBe(true);
  });
});

describe("validação prévia de upload", () => {
  it("foto: só JPG/PNG/WebP até 8 MB", () => {
    expect(validateUpload(file("a.png", "image/png", 100), "FOTO")).toBeNull();
    expect(validateUpload(file("a.pdf", "application/pdf", 100), "FOTO")).toMatch(/JPG/);
    expect(validateUpload(file("a.png", "image/png", 9 * 1024 * 1024), "FOTO")).toMatch(/8 MB/);
  });
  it("documento: PDF e imagens até 10 MB", () => {
    expect(validateUpload(file("a.pdf", "application/pdf", 100), "DOCUMENTO")).toBeNull();
    expect(validateUpload(file("a.exe", "application/x-msdownload", 100), "DOCUMENTO")).toMatch(/PDF/);
    expect(validateUpload(file("a.pdf", "application/pdf", 11 * 1024 * 1024), "REFERENCIA")).toMatch(/10 MB/);
    expect(validateUpload(file("a.pdf", "application/pdf", 0), "DOCUMENTO")).toMatch(/vazio/);
  });
  it("nome de arquivo seguro: sem acento, sem barra, sem espaço", () => {
    expect(safeFileName("Contrato Ação 2026 (final).PDF")).toBe("Contrato-Acao-2026-final.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\x\\foto.JPG")).toBe("foto.jpg");
    expect(safeFileName("???.png")).toBe("arquivo.png");
  });
});

describe("envio de arquivo", () => {
  it("sobe para o bucket privado no caminho da empresa e só depois registra no servidor", async () => {
    upload.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: { id: "f1", replayed: false }, error: null });
    const result = await uploadSupplierFile({ supplierId: "s1", kind: "FOTO", file: file("fachada.png", "image/png", 1000), photoKind: "Fachada", primary: true });
    expect(result).toEqual({ ok: true });
    const [path] = upload.mock.calls[0];
    expect(String(path).startsWith(`${COMPANY}/`)).toBe(true);
    expect(upload.mock.calls[0][2]).toMatchObject({ upsert: false, contentType: "image/png" });
    expect(rpc).toHaveBeenCalledWith("register_supplier_file", expect.objectContaining({ p_supplier_id: "s1", p_candidate_id: null, p_kind: "FOTO", p_primary: true, p_photo_kind: "Fachada", p_path: path }));
  });
  it("arquivo inválido nem chega ao storage", async () => {
    const result = await uploadSupplierFile({ supplierId: "s1", kind: "FOTO", file: file("x.pdf", "application/pdf", 10) });
    expect(result.ok).toBe(false);
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("falha no storage não registra vínculo", async () => {
    upload.mockResolvedValue({ error: { message: "x" } });
    const result = await uploadSupplierFile({ supplierId: "s1", kind: "DOCUMENTO", file: file("c.pdf", "application/pdf", 10) });
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("recusa do servidor (sem permissão) vira mensagem clara", async () => {
    upload.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: null, error: { message: "Sem permissão para esta operação de fornecedores" } });
    const result = await uploadSupplierFile({ candidateId: "c1", kind: "REFERENCIA", file: file("c.pdf", "application/pdf", 10) });
    expect(result).toEqual({ ok: false, error: "Você não tem permissão para anexar arquivos." });
  });
  it("lista só arquivos não removidos", async () => {
    query.order.mockResolvedValue({
      data: [
        { id: "1", supplier_id: "s", candidate_id: null, kind: "FOTO", photo_kind: "Fachada", caption: "", is_primary: true, storage_path: "p/1", file_name: "1.png", mime_type: "image/png", size_bytes: "10", uploaded_at: "2026-10-01", removed_at: null },
        { id: "2", supplier_id: "s", candidate_id: null, kind: "FOTO", photo_kind: null, caption: "", is_primary: false, storage_path: "p/2", file_name: "2.png", mime_type: "image/png", size_bytes: 10, uploaded_at: "2026-10-01", removed_at: "2026-10-02" },
      ],
      error: null,
    });
    const files = await listFiles({ supplierId: "s" });
    expect(files).toHaveLength(1);
    expect(files?.[0]).toMatchObject({ id: "1", sizeBytes: 10, isPrimary: true });
    expect(query.eq).toHaveBeenCalledWith("supplier_id", "s");
  });
  it("sem acesso aos arquivos devolve null (indisponível), não lista vazia", async () => {
    query.order.mockResolvedValue({ data: null, error: { message: "negado" } });
    expect(await listFiles({ supplierId: "s" })).toBeNull();
  });
});

describe("banco/Pix, rascunho, cotação, eventos e financeiro (chamadas ao servidor)", () => {
  it("banco: pede mascarado por padrão e só envia o que a pessoa digitou", async () => {
    rpc.mockResolvedValue({ data: { exists: true, masked: true }, error: null });
    await fetchBankDetails("s1", false);
    expect(rpc).toHaveBeenCalledWith("get_supplier_bank_details", { p_supplier_id: "s1", p_reveal: false });
    await saveBankDetails("s1", { beneficiary_name: "T", beneficiary_document: "", bank: "", branch: "", account: "", pix_type: "", pix_key: "k", notes: "" });
    expect(rpc).toHaveBeenLastCalledWith("set_supplier_bank_details", { p_supplier_id: "s1", p_payload: expect.objectContaining({ pix_key: "k" }) });
  });
  it("rascunho: envia versão esperada e alvo", async () => {
    rpc.mockResolvedValue({ data: { version: 2 }, error: null });
    await saveDraft({ supplierId: null, candidateId: "c1" }, 1, { form: {} });
    expect(rpc).toHaveBeenCalledWith("save_supplier_draft", { p_supplier_id: null, p_candidate_id: "c1", p_expected_version: 1, p_payload: { form: {} } });
    await getDraft({ supplierId: "s1", candidateId: null });
    expect(rpc).toHaveBeenLastCalledWith("get_supplier_draft", { p_supplier_id: "s1", p_candidate_id: null });
    await discardDraft({ supplierId: null, candidateId: null });
    expect(rpc).toHaveBeenLastCalledWith("discard_supplier_draft", { p_supplier_id: null, p_candidate_id: null });
  });
  it("conflito de versão do rascunho chega como erro identificável", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "CONFLITO_REVISAO: o rascunho foi alterado em outra aba" } });
    const result = await saveDraft({ supplierId: null, candidateId: null }, 0, {});
    expect(result.error?.startsWith("CONFLITO_REVISAO")).toBe(true);
  });
  it("cotação: converte para centavos já calculados e não cria nada financeiro (só RPC de avaliação)", async () => {
    rpc.mockResolvedValue({ data: { id: "q1" }, error: null });
    await addQuote("c1", { item: "Farinha", unit: "kg", quantity: 100, priceCents: 450, freightCents: 18000, validUntil: "", source: "e-mail" });
    expect(rpc).toHaveBeenCalledWith("add_candidate_quote", { p_candidate_id: "c1", p_payload: { item: "Farinha", unit: "kg", quantity: 100, price_cents: 450, freight_cents: 18000, valid_until: null, source: "e-mail" } });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("eventos: lê só nomes de campos e ordena do mais novo", async () => {
    query.limit.mockResolvedValue({ data: [{ event_type: "supplier.updated", occurred_at: "2026-10-01T10:00:00Z", entity_revision: 2, payload: { fields: ["city"] } }, { event_type: "supplier.created", occurred_at: "2026-09-01", entity_revision: 1, payload: null }], error: null });
    const events = await listSupplierEvents("s1");
    expect(events).toEqual([
      { eventType: "supplier.updated", occurredAt: "2026-10-01T10:00:00Z", revision: 2, fields: ["city"] },
      { eventType: "supplier.created", occurredAt: "2026-09-01", revision: 1, fields: [] },
    ]);
    expect(query.order).toHaveBeenCalledWith("occurred_at", { ascending: false });
  });
  it("financeiro e exportação: parâmetros do período e dos ids", async () => {
    rpc.mockResolvedValue({ data: { rows: [] }, error: null });
    await fetchFinanceList("2025-11-01", "2026-10-14");
    expect(rpc).toHaveBeenLastCalledWith("list_suppliers_financial", { p_from: "2025-11-01", p_to: "2026-10-14" });
    await fetchFinanceSummary("s1", null, null);
    expect(rpc).toHaveBeenLastCalledWith("supplier_financial_summary", { p_supplier_id: "s1", p_from: null, p_to: null });
    await fetchExportRows(["a", "b"]);
    expect(rpc).toHaveBeenLastCalledWith("list_suppliers_export", { p_ids: ["a", "b"] });
  });
  it("fonte financeira indisponível volta como erro, nunca como zero", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    const result = await fetchFinanceList(null, null);
    expect(result).toEqual({ data: null, error: "timeout" });
  });
});
