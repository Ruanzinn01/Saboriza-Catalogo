import { describe, expect, it } from "vitest";
import { outcomeFromSteps, recordFor } from "../../supabase/functions/asaas-webhook/outcome";

const NOW = new Date("2026-10-15T12:00:00.000Z");

describe("asaas-webhook · decisão do resultado do evento", () => {
  it("todas as atualizações ok: evento processado, sem erro, resposta 200", () => {
    const outcome = outcomeFromSteps([
      { label: "cobranca", error: null },
      { label: "recebivel", error: null },
    ]);
    expect(outcome).toEqual({ kind: "applied" });
    expect(recordFor(outcome, NOW)).toEqual({ processed_at: NOW.toISOString(), process_error: null, http_status: 200 });
  });

  it("uma atualização falha: NÃO marca como processado e responde 500 para reenvio", () => {
    const outcome = outcomeFromSteps([
      { label: "cobranca", error: null },
      { label: "recebivel", error: { message: "violação de restrição" } },
    ]);
    expect(outcome.kind).toBe("retry");
    const record = recordFor(outcome, NOW);
    expect(record.processed_at).toBeNull();
    expect(record.http_status).toBe(500);
    expect(record.process_error).toContain("recebivel");
    expect(record.process_error).toContain("violação de restrição");
  });

  it("todas as atualizações falham: o erro lista cada passo", () => {
    const outcome = outcomeFromSteps([
      { label: "cobranca", error: { message: "a" } },
      { label: "recebivel", error: { message: "b" } },
    ]);
    expect(recordFor(outcome, NOW).process_error).toBe("cobranca: a; recebivel: b");
  });

  it("evento ignorado de forma intencional fica registrado como processado, com a razão, e responde 200", () => {
    const record = recordFor({ kind: "ignored", message: "REVISAR: cobranca nao encontrada para este payment_id" }, NOW);
    expect(record).toEqual({
      processed_at: NOW.toISOString(),
      process_error: "REVISAR: cobranca nao encontrada para este payment_id",
      http_status: 200,
    });
  });

  it("sem nenhum passo com erro (lista vazia) conta como aplicado", () => {
    expect(outcomeFromSteps([])).toEqual({ kind: "applied" });
  });
});
