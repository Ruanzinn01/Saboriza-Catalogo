// Decisão pura sobre o resultado do processamento de um evento do Asaas (sem dependência de Deno).
// Regra: um evento só é "processado" quando os efeitos foram persistidos. Falha de banco nunca vira sucesso:
// o evento fica sem processed_at e a resposta é 500, para o Asaas reenviar e o reprocessamento ser possível.

export type ProcessOutcome =
  | { kind: "applied" }
  | { kind: "ignored"; message: string }
  | { kind: "retry"; message: string };

export interface StepResult {
  label: string;
  error: { message: string } | null;
}

export function outcomeFromSteps(steps: StepResult[]): ProcessOutcome {
  const failed = steps.filter((step) => step.error);
  if (failed.length === 0) return { kind: "applied" };
  return { kind: "retry", message: failed.map((step) => `${step.label}: ${step.error?.message}`).join("; ") };
}

export interface EventRecord {
  processed_at: string | null;
  process_error: string | null;
  http_status: number;
}

export function recordFor(outcome: ProcessOutcome, now: Date): EventRecord {
  if (outcome.kind === "applied") return { processed_at: now.toISOString(), process_error: null, http_status: 200 };
  if (outcome.kind === "ignored") return { processed_at: now.toISOString(), process_error: outcome.message, http_status: 200 };
  return { processed_at: null, process_error: outcome.message, http_status: 500 };
}
