import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import type { CustomerProfile } from "@/lib/customers-api";
import {
  buildMapUrl,
  buildSavePayload,
  coordinateState,
  documentFormatError,
  emptyCustomerForm,
  errorSummary,
  formFromProfile,
  isFormDirty,
  normalizeDocument,
  parseCoordinate,
  qualityChecklist,
  validateCustomerForm,
  type CustomerFormState,
} from "./customer-form";

function validForm(): CustomerFormState {
  return {
    ...emptyCustomerForm(),
    tradeName: "Tio Óris", legalName: "Óris Ltda", document: "12.ABC.345/01DE-35", phone: "(94) 99138-5788", uf: "PA", city: "Canaã dos Carajás",
    ibge: "1502954", street: "Avenida Castanheira", number: "S/N",
  };
}
const ctx = { isNew: true, canEditCredit: true, municipalityResolved: true };

describe("documento", () => {
  it("CNPJ alfanumérico preserva letras e zeros à esquerda", () => {
    expect(normalizeDocument("00.abc.345/01de-35")).toBe("00ABC34501DE35");
  });

  it("PJ exige 14 posições com os 2 últimos numéricos; PF exige 11 números", () => {
    expect(documentFormatError("12ABC34501DE35", "PJ")).toBeNull();
    expect(documentFormatError("12ABC34501DEAB", "PJ")).toMatch(/CNPJ/);
    expect(documentFormatError("12ABC345010", "PJ")).toMatch(/CNPJ/);
    expect(documentFormatError("123.456.789-09", "PF")).toBeNull();
    expect(documentFormatError("1234567890A", "PF")).toMatch(/CPF/);
    expect(documentFormatError("", "PJ")).toBeNull();
  });
});

describe("coordenadas", () => {
  it("aceita vírgula, sinal e zero; recusa texto, par incompleto e fora da faixa", () => {
    expect(parseCoordinate("-6,5303")).toBe(-6.5303);
    expect(parseCoordinate("0")).toBe(0);
    expect(parseCoordinate("abc")).toBeNull();
    expect(coordinateState({ latitude: "0", longitude: "0" })).toEqual({ kind: "valid", lat: 0, lon: 0 });
    expect(coordinateState({ latitude: "", longitude: "" })).toEqual({ kind: "empty" });
    expect(coordinateState({ latitude: "-6.5", longitude: "" }).kind).toBe("invalid");
    expect(coordinateState({ latitude: "91", longitude: "10" }).kind).toBe("invalid");
    expect(coordinateState({ latitude: "10", longitude: "-181" }).kind).toBe("invalid");
  });

  it("mapa: ponto informado primeiro; ponto inválido não cai em busca de endereço; sem nada, avisa", () => {
    const base = validForm();
    expect(buildMapUrl({ ...base, latitude: "-6.53", longitude: "-49.85" })).toEqual({
      url: "https://www.google.com/maps/search/?api=1&query=-6.53%2C-49.85", message: null, approximate: false,
    });
    const invalid = buildMapUrl({ ...base, latitude: "-6.53", longitude: "" });
    expect(invalid.url).toBeNull();
    expect(invalid.message).toMatch(/Corrija/);
    const byAddress = buildMapUrl(base);
    expect(byAddress.approximate).toBe(true);
    expect(byAddress.url).toContain("Avenida%20Castanheira");
    expect(buildMapUrl({ ...emptyCustomerForm() }).url).toBeNull();
  });
});

describe("validação do formulário", () => {
  it("cliente completo passa", () => {
    expect(validateCustomerForm(validForm(), ctx)).toEqual({});
  });

  it("campos obrigatórios com mensagem por campo; razão x nome completo conforme PF/PJ", () => {
    const errors = validateCustomerForm({ ...emptyCustomerForm() }, ctx);
    expect(errors).toMatchObject({
      tradeName: "Informe o nome do comércio.", legalName: "Informe a razão social.", document: "Informe o documento.",
      uf: "Selecione o estado.", city: "Informe o município.", street: "Informe o logradouro.", number: "Informe o número ou S/N.",
    });
    expect(validateCustomerForm({ ...emptyCustomerForm(), personType: "PF" }, ctx).legalName).toBe("Informe o nome completo.");
  });

  it("município digitado fora do catálogo não passa (código limpo ao mudar o nome)", () => {
    expect(validateCustomerForm(validForm(), { ...ctx, municipalityResolved: false }).city).toMatch(/lista do IBGE/);
  });

  it("ponto informado exige conferência; CEP incompleto e e-mail inválido são recusados", () => {
    const form = { ...validForm(), latitude: "-6.5", longitude: "-49.8", cep: "123", email: "x@" };
    const errors = validateCustomerForm(form, ctx);
    expect(errors.latitude).toMatch(/confirmação/);
    expect(errors.cep).toMatch(/8 números/);
    expect(errors.email).toMatch(/e-mail/);
    expect(validateCustomerForm({ ...form, locationConfirmed: true, cep: "", email: "" }, ctx)).toEqual({});
  });

  it("limite proposto só é validado para quem pode editar", () => {
    const form = { ...validForm(), creditLimit: "abc" };
    expect(validateCustomerForm(form, ctx).creditLimit).toMatch(/limite proposto/);
    expect(validateCustomerForm(form, { ...ctx, canEditCredit: false }).creditLimit).toBeUndefined();
    expect(errorSummary({ tradeName: "a", document: undefined })).toEqual(["a"]);
  });
});

describe("payload de gravação", () => {
  it("normaliza documento e CEP, IE some quando isento e PF não leva enquadramento", () => {
    const payload = buildSavePayload({ ...validForm(), cep: "68537-000", exempt: true, stateRegistration: "123", taxProfile: "MEI" }, { canEditCredit: false });
    expect(payload).toMatchObject({ cnpj: "12ABC34501DE35", cep: "68537000", ie: "", ie_exempt: true, tax_profile: "MEI" });
    expect(buildSavePayload({ ...validForm(), personType: "PF", taxProfile: "MEI" }, { canEditCredit: false }).tax_profile).toBeNull();
  });

  it("sem permissão a proposta de crédito nem vai no corpo (o servidor também recusaria)", () => {
    const form = { ...validForm(), creditLimit: "9.000,50", paymentTerms: "28", paymentMethod: "Boleto", creditNotes: "ok" };
    const without = buildSavePayload(form, { canEditCredit: false });
    expect(without).not.toHaveProperty("proposed_credit_limit");
    expect(without).not.toHaveProperty("credit_notes");
    const withPerm = buildSavePayload(form, { canEditCredit: true });
    expect(withPerm).toMatchObject({ proposed_credit_limit: 9000.5, preferred_payment_days: "28", preferred_payment_method: "Boleto" });
  });

  it("sem ponto, lat/lon e confirmação vão nulos; com ponto, pares numéricos e origem", () => {
    expect(buildSavePayload(validForm(), { canEditCredit: false })).toMatchObject({ latitude: null, longitude: null, location_confirmed: false, location_source: null });
    const withPoint = buildSavePayload({ ...validForm(), latitude: "-6,5", longitude: "0", locationConfirmed: true, locationSource: "GPS_DISPOSITIVO", locationAccuracy: "12" }, { canEditCredit: false });
    expect(withPoint).toMatchObject({ latitude: -6.5, longitude: 0, location_confirmed: true, location_source: "GPS_DISPOSITIVO", location_accuracy_m: 12 });
  });

  it("contatos adicionais sem nome são descartados", () => {
    const payload = buildSavePayload({ ...validForm(), extraContacts: [{ key: "1", name: "Maria", role: "Financeiro", phone: "9", whatsapp: true, email: "" }, { key: "2", name: " ", role: "", phone: "", whatsapp: false, email: "" }] }, { canEditCredit: false });
    expect(payload.extra_contacts).toEqual([{ name: "Maria", role: "Financeiro", phone: "9", whatsapp_enabled: true, email: "" }]);
  });

  it("não envia situação do cadastro nem limite aprovado", () => {
    const payload = buildSavePayload(validForm(), { canEditCredit: true });
    expect(payload).not.toHaveProperty("registration_status");
    expect(payload).not.toHaveProperty("credit_limit");
  });
});

describe("prévia e proteção de saída", () => {
  it("qualidade do cadastro é só preenchimento: 6 itens", () => {
    const base = qualityChecklist(emptyCustomerForm(), false, false);
    expect(base.percent).toBe(0);
    expect(base.items).toHaveLength(6);
    const full = qualityChecklist({ ...validForm(), contactName: "Óris", latitude: "-6", longitude: "-49", locationConfirmed: true, sellerId: "s" }, true, true);
    expect(full.percent).toBe(100);
  });

  it("detecta alteração e foto pendente", () => {
    const a = validForm();
    expect(isFormDirty(a, { ...a }, 0)).toBe(false);
    expect(isFormDirty({ ...a, phone: "1" }, a, 0)).toBe(true);
    expect(isFormDirty(a, { ...a }, 2)).toBe(true);
  });

  it("carrega o cadastro existente inteiro, sem perder campos", () => {
    const profile = {
      person_type: "PF", registration_status: "INATIVO", trade_name: "Banca", company_name: "Ana", name: "Ana", contact_role: "Proprietário(a)", phone: "9", whatsapp_enabled: true,
      email: "a@b.co", cnpj: "12345678909", ie: "", ie_exempt: true, tax_profile: null, cep: "40000000", state: "BA", city: "Salvador", ibge_code: "2927408",
      address: "Rua A", address_number: "10", neighborhood: "Centro", address_complement: "Loja 2", delivery_reference: "esquina", latitude: 0, longitude: -38.5,
      location_source: "MANUAL", location_accuracy_m: null, location_confirmed_at: "2026-10-10T00:00:00Z", segment: "Atacado", origin: "Indicação",
      seller_employee_id: "s1", promoter_employee_id: null, service_notes: "n", proposed_credit_limit: 1500.5, preferred_payment_days: "14", preferred_payment_method: "Pix",
      credit_analysis_state: "EM_ANALISE", credit_notes: "c",
    } as unknown as CustomerProfile;
    const form = formFromProfile(profile, [{ id: "c1", name: "Maria", role: null, phone: "8", whatsapp_enabled: false, email: "" }]);
    expect(form).toMatchObject({
      personType: "PF", status: "INATIVO", document: "12345678909", exempt: true, latitude: "0", longitude: "-38.5", locationConfirmed: true,
      sellerId: "s1", promoterId: "", ibge: "2927408", creditLimit: "1.500,50", paymentTerms: "14", creditState: "EM_ANALISE",
    });
    expect(form.extraContacts).toHaveLength(1);
  });
});
