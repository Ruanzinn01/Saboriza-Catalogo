import { describe, expect, it } from "vitest";
import { buildAsaasFeeFields, hasValidDocument, mapDiscountDeadlineToDays, mapFeeType } from "./asaas-billing";

describe("mapDiscountDeadlineToDays", () => {
  it.each([
    ["Até o dia do vencimento", 0],
    ["1 dia antes", 1],
    ["3 dias antes", 3],
    ["5 dias antes", 5],
    ["7 dias antes", 7],
  ])("converte \"%s\" para %i", (label, days) => {
    expect(mapDiscountDeadlineToDays(label as string)).toBe(days);
  });

  it("lança erro controlado para valor desconhecido, sem fallback silencioso", () => {
    expect(() => mapDiscountDeadlineToDays("10 dias antes")).toThrow();
  });
});

describe("mapFeeType", () => {
  it("percent -> PERCENTAGE", () => expect(mapFeeType("percent")).toBe("PERCENTAGE"));
  it("fixed -> FIXED", () => expect(mapFeeType("fixed")).toBe("FIXED"));
});

describe("buildAsaasFeeFields", () => {
  it("sem configuração nenhuma, não envia nenhuma chave", () => {
    expect(buildAsaasFeeFields(null)).toEqual({});
    expect(buildAsaasFeeFields(undefined)).toEqual({});
  });

  it("juros desativado não aparece no payload", () => {
    expect(buildAsaasFeeFields({ interest_on: false, interest_percent: 2 })).toEqual({});
  });

  it("juros ativado envia value", () => {
    expect(buildAsaasFeeFields({ interest_on: true, interest_percent: 1.5 })).toEqual({ interest: { value: 1.5 } });
  });

  it("multa desativada não aparece no payload", () => {
    expect(buildAsaasFeeFields({ fine_on: false, fine_type: "percent", fine: 2 })).toEqual({});
  });

  it("multa percentual", () => {
    expect(buildAsaasFeeFields({ fine_on: true, fine_type: "percent", fine: 2 })).toEqual({
      fine: { value: 2, type: "PERCENTAGE" },
    });
  });

  it("multa valor fixo", () => {
    expect(buildAsaasFeeFields({ fine_on: true, fine_type: "fixed", fine: 10 })).toEqual({
      fine: { value: 10, type: "FIXED" },
    });
  });

  it("desconto desativado não aparece no payload", () => {
    expect(buildAsaasFeeFields({ discount_on: false, discount_type: "percent", discount: 5, discount_deadline: "1 dia antes" })).toEqual({});
  });

  it("desconto percentual com prazo", () => {
    expect(
      buildAsaasFeeFields({ discount_on: true, discount_type: "percent", discount: 10, discount_deadline: "5 dias antes" })
    ).toEqual({ discount: { value: 10, type: "PERCENTAGE", dueDateLimitDays: 5 } });
  });

  it("desconto valor fixo com prazo", () => {
    expect(
      buildAsaasFeeFields({ discount_on: true, discount_type: "fixed", discount: 20, discount_deadline: "Até o dia do vencimento" })
    ).toEqual({ discount: { value: 20, type: "FIXED", dueDateLimitDays: 0 } });
  });

  it("desconto ativado sem discount_deadline lança erro em vez de assumir um prazo", () => {
    expect(() => buildAsaasFeeFields({ discount_on: true, discount_type: "percent", discount: 10 })).toThrow();
  });

  it("combina juros, multa e desconto no mesmo payload", () => {
    expect(
      buildAsaasFeeFields({
        interest_on: true,
        interest_percent: 1,
        fine_on: true,
        fine_type: "percent",
        fine: 2,
        discount_on: true,
        discount_type: "fixed",
        discount: 15,
        discount_deadline: "3 dias antes",
      })
    ).toEqual({
      interest: { value: 1 },
      fine: { value: 2, type: "PERCENTAGE" },
      discount: { value: 15, type: "FIXED", dueDateLimitDays: 3 },
    });
  });
});

describe("hasValidDocument", () => {
  it("ausente", () => {
    expect(hasValidDocument(null)).toBe(false);
    expect(hasValidDocument(undefined)).toBe(false);
    expect(hasValidDocument("")).toBe(false);
  });

  it("CPF válido", () => {
    expect(hasValidDocument("529.982.247-25")).toBe(true);
  });

  it("CPF inválido (dígito verificador errado)", () => {
    expect(hasValidDocument("111.111.111-11")).toBe(false);
  });

  it("CNPJ válido", () => {
    expect(hasValidDocument("11.222.333/0001-81")).toBe(true);
  });

  it("CNPJ inválido (dígito verificador errado)", () => {
    expect(hasValidDocument("11.222.333/0001-00")).toBe(false);
  });

  it("formato com quantidade de dígitos que não é CPF nem CNPJ", () => {
    expect(hasValidDocument("12345")).toBe(false);
  });
});
