import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args), from: (...args: unknown[]) => from(...args), storage: { from: vi.fn() } },
}));

import {
  fetchCommercialSummary,
  fetchCustomersList,
  fetchReceivablesView,
  friendlyCustomerError,
  saveCustomer,
  setCustomerStatus,
  validateImageFile,
} from "./customers-api";
import { DEFAULT_FILTERS } from "./customers-list";

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("fetchCustomersList", () => {
  it("manda filtros vazios como null e o escopo da empresa", async () => {
    rpc.mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    const result = await fetchCustomersList("company-1", { ...DEFAULT_FILTERS, search: "  ", city: "Salvador", sellerId: "s1", finance: "debt", page: 2, pageSize: 20 });
    expect(result.state).toBe("ready");
    expect(rpc).toHaveBeenCalledWith("oris360_customers_list", {
      p_company_id: "company-1", p_search: null, p_city: "Salvador", p_uf: null, p_neighborhood: null, p_seller: "s1", p_promoter: null,
      p_finance: "debt", p_registration: "all", p_category: "all", p_sort: "purchase", p_page: 2, p_page_size: 20,
    });
  });

  it("falha do servidor é erro (não vira lista vazia) e resposta nula é indisponível", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "sem acesso a empresa" } });
    expect(await fetchCustomersList("c", DEFAULT_FILTERS)).toEqual({ state: "error", message: "Você não tem acesso a este cliente." });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await fetchCustomersList("c", DEFAULT_FILTERS)).state).toBe("unavailable");
  });
});

describe("leituras financeiras e comerciais", () => {
  it("sem permissão (null) é 'unavailable', nunca zero", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await fetchReceivablesView("c1")).state).toBe("unavailable");
    expect((await fetchCommercialSummary("c1", "six")).state).toBe("unavailable");
  });

  it("repassa período e paginação de produtos", async () => {
    rpc.mockResolvedValue({ data: { products: [], series: [] }, error: null });
    await fetchCommercialSummary("c1", "year", 10, 20);
    expect(rpc).toHaveBeenCalledWith("oris360_customer_commercial_summary", { p_customer_id: "c1", p_period: "year", p_products_limit: 10, p_products_offset: 20 });
  });
});

describe("comandos de escrita", () => {
  it("salvar envia command_id e revisão esperada e devolve retry como replayed", async () => {
    rpc.mockResolvedValue({ data: { customer_id: "x", revision: 4, replayed: true }, error: null });
    const result = await saveCustomer({ commandId: "cmd-1", companyId: "co", customerId: "x", expectedRevision: 3, data: { trade_name: "A" } });
    expect(result).toEqual({ ok: true, customerId: "x", revision: 4, replayed: true });
    expect(rpc).toHaveBeenCalledWith("oris360_customer_save", { p_command_id: "cmd-1", p_company_id: "co", p_customer_id: "x", p_expected_revision: 3, p_data: { trade_name: "A" } });
  });

  it("conflito de revisão é sinalizado e com texto amigável", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "CONFLITO_REVISAO: o cadastro foi alterado" } });
    const result = await saveCustomer({ commandId: "c", companyId: "co", customerId: "x", expectedRevision: 1, data: {} });
    expect(result).toMatchObject({ ok: false, conflict: true });
    expect(result.ok === false && result.message).toMatch(/outra pessoa/);
  });

  it("inativar manda motivo e revisão", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    expect(await setCustomerStatus({ commandId: "c", customerId: "x", status: "INATIVO", reason: "encerrou", expectedRevision: 2 })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("oris360_customer_set_status", { p_command_id: "c", p_customer_id: "x", p_status: "INATIVO", p_reason: "encerrou", p_expected_revision: 2 });
  });
});

describe("mensagens e fotos", () => {
  it("traduz erros conhecidos e mantém os desconhecidos", () => {
    expect(friendlyCustomerError("DOCUMENTO_DUPLICADO: x")).toMatch(/este documento/);
    expect(friendlyCustomerError("IBGE_INVALIDO: x")).toMatch(/município/);
    expect(friendlyCustomerError("algo inesperado")).toBe("algo inesperado");
  });

  it("valida tipo e tamanho da foto (o servidor valida de novo)", () => {
    expect(validateImageFile({ type: "image/gif", size: 10, name: "a.gif" })).toMatch(/JPG, PNG ou WebP/);
    expect(validateImageFile({ type: "image/jpeg", size: 9 * 1024 * 1024, name: "b.jpg" })).toMatch(/8 MB/);
    expect(validateImageFile({ type: "image/webp", size: 1000, name: "c.webp" })).toBeNull();
  });
});
