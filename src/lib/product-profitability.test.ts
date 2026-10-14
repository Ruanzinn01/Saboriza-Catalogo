import { describe, expect, it } from "vitest";
import { computeProfitability, resaleUnitCost } from "@/lib/product-profitability";

describe("rentabilidade de produto de revenda", () => {
  it("exemplo do PRD: custo 10, preço 16 => margem real 37,5%", () => {
    const result = computeProfitability(16, resaleUnitCost(10), null);
    expect(result.marginPct).toBeCloseTo(37.5, 5);
    expect(result.status).toBe("no-target");
    expect(result.gapPp).toBeNull();
  });

  it("com meta de 40% fica 2,5 p.p. abaixo e o preço não é alterado", () => {
    const result = computeProfitability(16, resaleUnitCost(10), 40);
    expect(result.status).toBe("below-target");
    expect(result.gapPp).toBeCloseTo(-2.5, 5);
    expect(result.price).toBe(16);
  });

  it("sem compra nem saldo inicial não inventa margem: aguardando primeira compra", () => {
    const result = computeProfitability(16, resaleUnitCost(null), 40);
    expect(result.status).toBe("no-cost");
    expect(result.marginPct).toBeNull();
  });

  it("sem preço praticado não calcula margem", () => {
    expect(computeProfitability(0, resaleUnitCost(10), null).status).toBe("no-price");
  });
});
