import { describe, expect, it } from "vitest";
import {
  addressFingerprint,
  coordinateState,
  emptySupplierForm,
  formatCentsToBrlInput,
  mapsUrl,
  parseBrlToCents,
  parseCoordinate,
  registrationQuality,
  supplierToForm,
  toSupplierPayload,
  validateSupplierForm,
} from "@/lib/supplier-form";
import { supplierFromRow } from "@/lib/mappers/supplier-mapper";
import type { SupplierInput } from "@/types/supplier";

const valid: SupplierInput = {
  ...emptySupplierForm,
  tradeName: "Norte Alimentos",
  companyName: "Norte Alimentos Ltda",
  cnpj: "11.222.333/0001-81",
  state: "PA",
  city: "Canaã dos Carajás",
  address: "Rua A",
  streetNumber: "S/N",
};

describe("valores monetários e coordenadas", () => {
  it("converte reais em centavos aceitando milhar e vírgula", () => {
    expect(parseBrlToCents("1.234,56")).toBe(123456);
    expect(parseBrlToCents("0,00")).toBe(0);
    expect(parseBrlToCents("")).toBe(0);
    expect(parseBrlToCents("500")).toBe(50000);
    expect(parseBrlToCents("12,5")).toBe(1250);
  });
  it("recusa valor inválido ou negativo", () => {
    expect(parseBrlToCents("abc")).toBeNull();
    expect(parseBrlToCents("-5,00")).toBeNull();
    expect(parseBrlToCents("1,234,56")).toBeNull();
    expect(parseBrlToCents("9999999999")).toBeNull();
  });
  it("formata centavos para o campo", () => {
    expect(formatCentsToBrlInput(123456)).toBe("1.234,56");
    expect(formatCentsToBrlInput(0)).toBe("0,00");
  });
  it("aceita vírgula e trata zero como valor válido", () => {
    expect(parseCoordinate("-12,9714")).toBe(-12.9714);
    expect(parseCoordinate("0")).toBe(0);
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("x")).toBeNaN();
  });
  it("exige o par latitude/longitude dentro das faixas", () => {
    expect(coordinateState("", "").empty).toBe(true);
    expect(coordinateState("0", "0")).toMatchObject({ valid: true, latitude: 0, longitude: 0 });
    expect(coordinateState("10", "").valid).toBe(false);
    expect(coordinateState("91", "10").valid).toBe(false);
    expect(coordinateState("10", "-181").valid).toBe(false);
    expect(coordinateState("-6,5303", "-49,856")).toMatchObject({ valid: true, latitude: -6.5303, longitude: -49.856 });
  });
  it("link do mapa usa o ponto quando existe e o endereço codificado quando não existe", () => {
    expect(mapsUrl({ ...valid, latitude: "-6,5", longitude: "-49,8" })).toContain("query=-6.5%2C-49.8");
    expect(mapsUrl(valid)).toContain(encodeURIComponent("Rua A, S/N, Canaã dos Carajás, PA"));
  });
});

describe("validateSupplierForm", () => {
  it("cadastro novo válido não tem erros; contato, telefone, razão do contato e categoria não são exigidos", () => {
    expect(validateSupplierForm(valid, { isCreate: true })).toEqual({});
  });
  it("cadastro novo exige fantasia, razão, documento, UF, município, logradouro e número", () => {
    const errors = validateSupplierForm(emptySupplierForm, { isCreate: true });
    expect(Object.keys(errors).sort()).toEqual(["address", "city", "cnpj", "companyName", "state", "streetNumber", "tradeName"]);
  });
  it("CNPJ alfanumérico é aceito e CNPJ/CPF mal formados são recusados", () => {
    expect(validateSupplierForm({ ...valid, cnpj: "12.ABC.345/01DE-35" }, { isCreate: true }).cnpj).toBeUndefined();
    expect(validateSupplierForm({ ...valid, cnpj: "12ABC34501DEXX" }, { isCreate: true }).cnpj).toMatch(/CNPJ/);
    expect(validateSupplierForm({ ...valid, personType: "PF", cnpj: "123.456.789-09" }, { isCreate: true }).cnpj).toBeUndefined();
    expect(validateSupplierForm({ ...valid, personType: "PF", cnpj: "123" }, { isCreate: true }).cnpj).toMatch(/CPF/);
  });
  it("edição de legado vazio não bloqueia, mas campo já preenchido não pode ser apagado", () => {
    const legacy = { cnpj: "", state: "", city: "", address: "", streetNumber: "" };
    expect(validateSupplierForm({ ...emptySupplierForm, tradeName: "A", companyName: "B" }, { isCreate: false, existing: legacy })).toEqual({});
    const filled = { cnpj: "11222333000181", state: "PA", city: "X", address: "Rua", streetNumber: "1" };
    const errors = validateSupplierForm({ ...valid, address: "" }, { isCreate: false, existing: filled });
    expect(errors.address).toBeDefined();
  });
  it("documento legado fora do padrão não bloqueia a edição se não foi alterado", () => {
    const existing = { cnpj: "123", state: "PA", city: "X", address: "Rua", streetNumber: "1" };
    expect(validateSupplierForm({ ...valid, cnpj: "123" }, { isCreate: false, existing }).cnpj).toBeUndefined();
    expect(validateSupplierForm({ ...valid, cnpj: "1234" }, { isCreate: false, existing }).cnpj).toBeDefined();
  });
  it("ponto no mapa exige confirmação e par válido", () => {
    expect(validateSupplierForm({ ...valid, latitude: "10", longitude: "20" }, { isCreate: true }).location).toBeDefined();
    expect(validateSupplierForm({ ...valid, latitude: "10", longitude: "20", locationConfirmed: true }, { isCreate: true }).location).toBeUndefined();
    expect(validateSupplierForm({ ...valid, latitude: "10" }, { isCreate: true }).latitude).toBeDefined();
  });
  it("e-mails, site, CEP, prazo e valores", () => {
    const errors = validateSupplierForm(
      { ...valid, email: "x", salesEmail: "y", invoiceEmail: "z", website: "site.com", cep: "123", leadTimeDays: "999", minimumOrder: "abc", creditLimit: "-1" },
      { isCreate: true }
    );
    expect(Object.keys(errors).sort()).toEqual(["cep", "creditLimit", "email", "invoiceEmail", "leadTimeDays", "minimumOrder", "salesEmail", "website"]);
  });
});

describe("payload e formulário", () => {
  it("monta o payload snake_case com centavos e sem ponto quando não confirmado", () => {
    const payload = toSupplierPayload({ ...valid, minimumOrder: "500,00", creditLimit: "25.000,00", leadTimeDays: "7", stateExempt: true, ie: "123", latitude: "-6,5", longitude: "-49,8", locationConfirmed: true });
    expect(payload).toMatchObject({
      trade_name: "Norte Alimentos",
      company_name: "Norte Alimentos Ltda",
      minimum_order_cents: 50000,
      credit_limit_cents: 2500000,
      lead_time_days: 7,
      state_exempt: true,
      ie: "",
      latitude: -6.5,
      longitude: -49.8,
      location_confirmed: true,
      location_source: "MANUAL",
    });
    expect(toSupplierPayload(valid)).toMatchObject({ latitude: null, longitude: null, location_confirmed: false, lead_time_days: null });
  });
  it("nunca inclui dados bancários no payload do fornecedor", () => {
    expect(Object.keys(toSupplierPayload(valid)).some((key) => /bank|pix|beneficiary|account|branch/i.test(key))).toBe(false);
  });
  it("ida e volta: a linha do banco vira formulário com centavos formatados", () => {
    const supplier = supplierFromRow({
      id: "s1", name: "C", company_name: "R", phone: "1", trade_name: "T", cnpj: "11222333000181", ie: "", email: "", address: "Rua", neighborhood: "", cep: "", city: "X", state: "PA",
      created_at: "", updated_at: "", minimum_order_cents: "50000", credit_limit_cents: 2500000, latitude: "-6.5", longitude: "-49.8", location_confirmed_at: "2026-10-01T00:00:00Z", lead_time_days: 7, revision: 3,
    });
    const form = supplierToForm(supplier);
    expect(form).toMatchObject({ minimumOrder: "500,00", creditLimit: "25.000,00", latitude: "-6.5", locationConfirmed: true, leadTimeDays: "7" });
    expect(supplier.revision).toBe(3);
    expect(supplier.active).toBe(true);
  });
  it("mudar endereço ou ponto altera a impressão digital (usada para invalidar a confirmação)", () => {
    expect(addressFingerprint(valid)).not.toBe(addressFingerprint({ ...valid, address: "Rua B" }));
    const renamed: SupplierInput = { ...valid, tradeName: "outro" };
    expect(addressFingerprint(valid)).toBe(addressFingerprint(renamed));
  });
  it("qualidade do cadastro conta só o que está preenchido", () => {
    expect(registrationQuality(emptySupplierForm).percent).toBe(0);
    expect(registrationQuality({ ...valid, name: "Ana", phone: "1", buyerName: "Carlos", paymentTerms: "28" }).percent).toBeGreaterThan(60);
  });
});
