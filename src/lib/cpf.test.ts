import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf } from "./cpf";

describe("isValidCpf", () => {
  it("aceita um CPF real válido", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCpf("111.444.777-36")).toBe(false);
  });

  it("rejeita todos os dígitos iguais", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidCpf("123")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("formata 11 dígitos no padrão XXX.XXX.XXX-XX", () => {
    expect(formatCpf("11144477735")).toBe("111.444.777-35");
  });
});
