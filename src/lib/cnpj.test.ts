import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj } from "./cnpj";

describe("isValidCnpj", () => {
  it("aceita um CNPJ real válido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });

  it("rejeita todos os dígitos iguais", () => {
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidCnpj("123")).toBe(false);
  });
});

describe("formatCnpj", () => {
  it("formata 14 dígitos no padrão XX.XXX.XXX/XXXX-XX", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("ignora caracteres não numéricos na entrada", () => {
    expect(formatCnpj("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });
});
