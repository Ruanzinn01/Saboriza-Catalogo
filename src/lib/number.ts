const integerFormatter = new Intl.NumberFormat("pt-BR");
const decimalFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

/**
 * Formata um número no padrão pt-BR: ponto a cada 3 dígitos, vírgula decimal.
 * Números inteiros saem sem casas decimais; frações usam até 3 casas (kg, L, etc.).
 */
export function formatNumber(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return "0";
  if (decimals !== undefined) {
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  }
  return Number.isInteger(value) ? integerFormatter.format(value) : decimalFormatter.format(value);
}

/** Formata um número seguido da unidade, ex.: "180.000 un", "1.234,5 kg". */
export function formatQuantity(value: number, unit?: string): string {
  const formatted = formatNumber(value);
  return unit ? `${formatted} ${unit}` : formatted;
}
