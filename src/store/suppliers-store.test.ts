import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
const from = vi.fn();
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));
vi.mock("@/lib/current-company", () => ({ resolveCurrentCompanyId: async () => "c1" }));
vi.mock("sonner", () => ({ toast }));

import { emptySupplierForm } from "@/lib/supplier-form";
import { useSuppliersStore } from "@/store/suppliers-store";
import { supplierPayload } from "@/store/supplier-candidates-store";

const input = { ...emptySupplierForm, tradeName: "Norte", companyName: "Norte Ltda", cnpj: "11222333000181", state: "PA", city: "X", address: "Rua", streetNumber: "1" };
const DUP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  Object.values(query).forEach((fn) => fn.mockReset());
  Object.values(toast).forEach((fn) => fn.mockReset());
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  useSuppliersStore.setState({ suppliers: [], status: "idle" });
});

describe("suppliers-store", () => {
  it("carrega fornecedores da empresa e ordena pelo nome de exibição", async () => {
    query.order.mockResolvedValue({
      data: [
        { id: "2", name: "", company_name: "Zeta Ltda", phone: "", trade_name: "", cnpj: "", ie: "", email: "", address: "", neighborhood: "", cep: "", city: "", state: "", created_at: "", updated_at: "" },
        { id: "1", name: "", company_name: "Alfa Ltda", phone: "", trade_name: "Beta", cnpj: "", ie: "", email: "", address: "", neighborhood: "", cep: "", city: "", state: "", created_at: "", updated_at: "", active: false, revision: 4 },
      ],
      error: null,
    });
    await useSuppliersStore.getState().fetchSuppliers();
    const { suppliers, status } = useSuppliersStore.getState();
    expect(status).toBe("ready");
    expect(suppliers.map((s) => s.id)).toEqual(["1", "2"]);
    expect(suppliers[0]).toMatchObject({ active: false, revision: 4 });
    expect(suppliers[1]).toMatchObject({ active: true, revision: 1 });
    expect(query.eq).toHaveBeenCalledWith("company_id", "c1");
  });

  it("erro de leitura vira estado de erro, sem lista falsa", async () => {
    query.order.mockResolvedValue({ data: null, error: { message: "x" } });
    await useSuppliersStore.getState().fetchSuppliers();
    expect(useSuppliersStore.getState().status).toBe("error");
    expect(useSuppliersStore.getState().suppliers).toEqual([]);
  });

  it("criar envia command_id, payload completo e categorias no mesmo comando; nunca escreve direto na tabela", async () => {
    rpc.mockResolvedValue({ data: { id: "n1", revision: 1 }, error: null });
    const result = await useSuppliersStore.getState().createSupplier(input, ["cat1"], "cmd-1");
    expect(result).toEqual({ id: "n1", revision: 1 });
    expect(rpc).toHaveBeenCalledWith("create_supplier", { p_command_id: "cmd-1", p_payload: expect.objectContaining({ trade_name: "Norte", category_ids: ["cat1"], cnpj: "11222333000181" }) });
    expect(from).not.toHaveBeenCalled();
  });

  it("documento duplicado volta como duplicateOf (sem toast de erro genérico)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: `DUPLICADO:${DUP}` } });
    const result = await useSuppliersStore.getState().createSupplier(input, [], "cmd-2");
    expect(result).toEqual({ duplicateOf: DUP });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("validação do servidor chega legível à pessoa", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "O CNPJ deve conter 14 posições, com os dois últimos caracteres numéricos" } });
    const result = await useSuppliersStore.getState().createSupplier(input, [], "cmd-3");
    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("O CNPJ deve conter 14 posições, com os dois últimos caracteres numéricos");
  });

  it("editar envia a revisão esperada e o delta de categorias; conflito não sobrescreve em silêncio", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "s1", revision: 6 }, error: null });
    expect(await useSuppliersStore.getState().updateSupplier("s1", 5, input, { add: ["a"], remove: ["b"] })).toEqual({ id: "s1", revision: 6 });
    expect(rpc).toHaveBeenCalledWith("update_supplier", { p_id: "s1", p_expected_revision: 5, p_payload: expect.objectContaining({ category_add: ["a"], category_remove: ["b"] }) });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "CONFLITO_REVISAO: o fornecedor foi alterado por outra pessoa (revisão atual 7)" } });
    expect(await useSuppliersStore.getState().updateSupplier("s1", 5, input, { add: [], remove: [] })).toEqual({ conflict: true });
  });

  it("inativar usa a RPC com revisão e atualiza a lista; não há exclusão", async () => {
    useSuppliersStore.setState({ suppliers: [{ id: "s1", active: true, revision: 1 } as never] });
    rpc.mockResolvedValue({ data: { id: "s1", revision: 2, active: false }, error: null });
    expect(await useSuppliersStore.getState().setActive("s1", false, 1)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("set_supplier_active", { p_id: "s1", p_active: false, p_expected_revision: 1 });
    expect(useSuppliersStore.getState().suppliers[0]).toMatchObject({ active: false, revision: 2 });
    expect("deleteSupplier" in useSuppliersStore.getState()).toBe(false);
  });

  it("sem permissão a inativação falha com mensagem clara e não altera a lista", async () => {
    useSuppliersStore.setState({ suppliers: [{ id: "s1", active: true, revision: 1 } as never] });
    rpc.mockResolvedValue({ data: null, error: { message: "Sem permissão para esta operação de fornecedores" } });
    expect(await useSuppliersStore.getState().setActive("s1", false, 1)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Você não tem permissão para esta ação.");
    expect(useSuppliersStore.getState().suppliers[0].active).toBe(true);
  });

  it("pré-checagem de duplicidade por documento", async () => {
    rpc.mockResolvedValue({ data: { id: DUP, trade_name: "X", company_name: "Y", active: true }, error: null });
    expect(await useSuppliersStore.getState().findByDocument("11.222.333/0001-81", "s9")).toMatchObject({ id: DUP });
    expect(rpc).toHaveBeenCalledWith("find_supplier_by_document", { p_document: "11.222.333/0001-81", p_exclude: "s9" });
  });
});

describe("promoção da avaliação", () => {
  it("o payload da promoção é o mesmo do cadastro (campos completos) mais as categorias", () => {
    const payload = supplierPayload(input, ["c1", "c2"]);
    expect(payload).toMatchObject({ trade_name: "Norte", company_name: "Norte Ltda", cnpj: "11222333000181", category_ids: ["c1", "c2"], person_type: "PJ" });
  });
});
