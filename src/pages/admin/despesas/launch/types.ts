import type { LaunchKind, RecurrenceInput } from "@/store/expense-launch-store";

export interface CartLine {
  cid: string;
  kind: LaunchKind;
  categoryId?: string;
  rawMaterialId?: string;
  catalogItemId?: string;
  employeeId?: string;
  name: string;
  description?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  rateable: boolean;
  contractLabel: string;
  payrollType?: "salary" | "advance";
  referenceExpenseId?: string;
  breakdown?: { extra: number; discount: number; advance: number; base: number };
  recurrence: RecurrenceInput;
  destLabel: string;
}

export const KIND_LABEL: Record<LaunchKind, { name: string; sub: string; icon: string; dest: string }> = {
  stock: { name: "Insumos e mercadorias", sub: "Matéria-prima, embalagens e revenda", icon: "◇", dest: "Estoque" },
  asset: { name: "Bens e investimentos", sub: "Expositores, máquinas e equipamentos", icon: "▥", dest: "Patrimônio (saldo em formação)" },
  expense: { name: "Serviços e outras despesas", sub: "Aluguel, manutenção e contabilidade", icon: "▤", dest: "Despesa" },
  salary: { name: "Gestão salarial", sub: "Apuração mensal e vales", icon: "♙", dest: "Pessoal" },
  partner: { name: "Sócios e retiradas", sub: "Pró-labore e movimentações dos sócios", icon: "♧", dest: "Sócios" },
};

export function defaultRecurrence(startDate: string, variable = false): RecurrenceInput {
  return { enabled: false, frequency: "monthly", intervalDays: 1, dayOfMonth: 10, startDate, endMode: "none", variableAmount: variable };
}

export function frequencyLabel(r: RecurrenceInput): string {
  if (r.frequency === "weekly") return "Semanal";
  if (r.frequency === "monthly") return "Mensal";
  if (r.frequency === "yearly") return "Anual";
  return `A cada ${r.intervalDays ?? 1} dias`;
}

export function commitmentKey(kind: LaunchKind, partyName: string, contractLabel: string, refId?: string): string {
  return `${kind}|${partyName}|${contractLabel}|${refId ?? ""}`;
}
