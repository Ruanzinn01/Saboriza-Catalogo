/**
 * Paleta EXATA do HTML V2 oficial (01_IMPLEMENTACAO/index.html) — autoridade visual do pacote
 * mestre Despesas. Não usar tokens aproximados do design system geral aqui: o HTML é referência
 * de cor, não só de layout (regra-mãe do pacote).
 */
export const DESPESAS_COLORS = {
  green: "#103f32",
  deep: "#092d23",
  accent: "#208252",
  cream: "#f4efdf",
  line: "#e6e8e1",
  muted: "#788078",
  gold: "#d2aa43",
  blue: "#2d6eb3",
  red: "#b74d43",
  orange: "#bc7a28",
  gray: "#8a928b",
  purple: "#745f9f",
  pink: "#a76593",
} as const;

/** Cores por origem — idênticas ao `catColors` do protótipo. */
export const ORIGIN_COLOR_HEX: Record<string, string> = {
  stock: "#2b7a50",
  asset: "#caa447",
  expense: "#5f83b4",
  salary: "#8b6c9f",
  commission: "#a76593",
  partner: "#c2724e",
};

/** Cor do "dot" de cada KPI, igual ao protótipo (gray/green/orange/blue/red). */
export const KPI_DOT_COLOR: Record<string, string> = {
  total: DESPESAS_COLORS.gray,
  pago: "#3e9b64",
  aPagar: DESPESAS_COLORS.orange,
  agendado: "#4885bd",
  atrasado: "#c45e54",
};
