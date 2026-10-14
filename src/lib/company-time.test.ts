import { describe, expect, it } from "vitest";
import { formatTimeInZone, zonedDateTimeToIso } from "@/lib/company-time";
import { compensationChanges, EMPTY_COMPENSATION } from "@/lib/employee-compensation";

describe("zonedDateTimeToIso", () => {
  it("interpreta o horário digitado no fuso da empresa, não no do navegador", () => {
    expect(zonedDateTimeToIso("2026-10-14", "08:00", "America/Sao_Paulo")).toBe("2026-10-14T11:00:00.000Z");
    expect(zonedDateTimeToIso("2026-10-14", "08:00", "America/Manaus")).toBe("2026-10-14T12:00:00.000Z");
    expect(zonedDateTimeToIso("2026-10-14", "08:00", "UTC")).toBe("2026-10-14T08:00:00.000Z");
  });

  it("vai e volta sem deslocar o horário", () => {
    const iso = zonedDateTimeToIso("2026-03-02", "23:30", "America/Sao_Paulo");
    expect(formatTimeInZone(iso, "America/Sao_Paulo")).toBe("23:30");
  });
});

describe("compensationChanges", () => {
  it("envia só os campos alterados", () => {
    const after = { ...EMPTY_COMPENSATION, salary_base: 2500, pix_key: "a@b.com" };
    expect(compensationChanges({ ...EMPTY_COMPENSATION, pix_key: "a@b.com" }, after)).toEqual({ salary_base: 2500 });
  });

  it("não envia nada quando nada mudou", () => {
    expect(compensationChanges(EMPTY_COMPENSATION, EMPTY_COMPENSATION)).toEqual({});
  });
});
