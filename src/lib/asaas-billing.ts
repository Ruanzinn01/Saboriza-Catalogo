// Mapeamento puro Saboriza -> Asaas para cobrança (juros/multa/desconto) e validação de CPF/CNPJ.
// Fonte canônica, testada em asaas-billing.test.ts. A Edge Function asaas-create-charge roda em
// Deno e não importa de src/ — existe uma cópia sincronizada em
// supabase/functions/asaas-create-charge/_shared/asaas-billing.ts, enviada junto no deploy. Se
// mudar a lógica aqui, replique a mudança lá também.
//
// isValidCpf/isValidCnpj abaixo são as mesmas de src/lib/cpf.ts e src/lib/cnpj.ts, reaproveitadas
// em vez de criar uma terceira validação.

export interface AsaasFeeConfig {
  interest_on?: boolean;
  interest_percent?: number;
  fine_on?: boolean;
  fine_type?: "percent" | "fixed";
  fine?: number;
  discount_on?: boolean;
  discount_type?: "percent" | "fixed";
  discount?: number;
  discount_deadline?: string;
}

export interface AsaasFeeFields {
  interest?: { value: number };
  fine?: { value: number; type: "FIXED" | "PERCENTAGE" };
  discount?: { value: number; type: "FIXED" | "PERCENTAGE"; dueDateLimitDays: number };
}

const DISCOUNT_DEADLINE_DAYS: Record<string, number> = {
  "Até o dia do vencimento": 0,
  "1 dia antes": 1,
  "3 dias antes": 3,
  "5 dias antes": 5,
  "7 dias antes": 7,
};

export function mapDiscountDeadlineToDays(label: string): number {
  if (!(label in DISCOUNT_DEADLINE_DAYS)) {
    throw new Error(`prazo de desconto desconhecido: "${label}"`);
  }
  return DISCOUNT_DEADLINE_DAYS[label];
}

export function mapFeeType(type: "percent" | "fixed"): "FIXED" | "PERCENTAGE" {
  if (type === "percent") return "PERCENTAGE";
  if (type === "fixed") return "FIXED";
  throw new Error(`tipo de encargo desconhecido: "${type}"`);
}

function assertNonNegative(label: string, value: number): void {
  if (value < 0) {
    throw new Error(`${label} não pode ser negativo: ${value}`);
  }
}

// Só inclui as chaves que o usuário realmente configurou. Nenhum fallback silencioso: um
// discount_deadline ou fine_type/discount_type fora do esperado, ou um valor negativo, derruba a
// cobrança com erro controlado, em vez de mandar uma configuração incorreta pro Asaas.
export function buildAsaasFeeFields(fees: AsaasFeeConfig | null | undefined): AsaasFeeFields {
  const out: AsaasFeeFields = {};
  if (!fees) return out;

  if (fees.interest_on && fees.interest_percent) {
    assertNonNegative("interest_percent", fees.interest_percent);
    out.interest = { value: fees.interest_percent };
  }

  if (fees.fine_on && fees.fine) {
    assertNonNegative("fine", fees.fine);
    out.fine = { value: fees.fine, type: mapFeeType(fees.fine_type ?? "percent") };
  }

  if (fees.discount_on && fees.discount) {
    assertNonNegative("discount", fees.discount);
    if (typeof fees.discount_deadline !== "string") {
      throw new Error("discount_deadline ausente com desconto ativado");
    }
    out.discount = {
      value: fees.discount,
      type: mapFeeType(fees.discount_type ?? "percent"),
      dueDateLimitDays: mapDiscountDeadlineToDays(fees.discount_deadline),
    };
  }

  return out;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(d[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  function checkDigit(base: string): number {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split("").reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }

  const firstCheck = checkDigit(digits.slice(0, 12));
  const secondCheck = checkDigit(digits.slice(0, 12) + firstCheck);
  return digits === digits.slice(0, 12) + String(firstCheck) + String(secondCheck);
}

// A Asaas exige name + cpfCnpj para criar cliente (schema oficial: required: ["name", "cpfCnpj"]),
// sem distinção entre boleto e Pix. true só quando o documento bate com CPF (11 dígitos) ou CNPJ (14).
export function hasValidDocument(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}
