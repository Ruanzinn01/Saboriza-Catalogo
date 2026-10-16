import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-untyped", () => ({ supabaseUntyped: { rpc: vi.fn() } }));

import { actorLabel, dateInputToIso, defaultAuditFilters, fillDailySeries, filtersToRpcArgs, totalPages } from "@/lib/auditoria-central";

describe("auditoria-central", () => {
  it("monta filtros padrão de 30 dias", () => {
    const f = defaultAuditFilters(new Date(2026, 9, 16), 30);
    expect(f.to).toBe("2026-10-16");
    expect(f.from).toBe("2026-09-16");
  });

  it("converte filtros em argumentos de RPC com offset de página", () => {
    const args = filtersToRpcArgs({ ...defaultAuditFilters(new Date(2026, 9, 16)), search: "  EXP-1 ", actorType: "SYSTEM" }, 25, 3);
    expect(args.p_search).toBe("EXP-1");
    expect(args.p_actor_type).toBe("SYSTEM");
    expect(args.p_event_type).toBeNull();
    expect(args.p_limit).toBe(25);
    expect(args.p_offset).toBe(50);
    expect(filtersToRpcArgs(defaultAuditFilters(), 10, 0).p_offset).toBe(0);
  });

  it("rejeita data inválida", () => {
    expect(dateInputToIso("16/10/2026", false)).toBeNull();
    expect(dateInputToIso("2026-10-16", true)).toMatch(/^2026-10-1[67]T/);
  });

  it("calcula total de páginas", () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(51, 25)).toBe(3);
  });

  it("preenche dias sem evento com zero", () => {
    const filled = fillDailySeries([{ day: "2026-10-15", count: 4 }], "2026-10-14", "2026-10-16");
    expect(filled).toEqual([
      { day: "2026-10-14", count: 0 },
      { day: "2026-10-15", count: 4 },
      { day: "2026-10-16", count: 0 },
    ]);
  });

  it("distingue ator humano de sistema", () => {
    expect(actorLabel("USER", "abcdef12-0000")).toBe("Usuário abcdef12");
    expect(actorLabel("SYSTEM", null)).toBe("Sistema");
  });
});
