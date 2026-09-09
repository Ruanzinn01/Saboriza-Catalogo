export const weekdayMessages: Record<number, string> = {
  0: "Domingo é dia de planejar: deixe seu pedido encaminhado!",
  1: "Segunda, comece a semana abastecendo sua loja!",
  2: "Terça de reposição: seu estoque está em dia?",
  3: "Quarta de vendas! Garanta seus produtos para a semana.",
  4: "Quinta é dia de preparar a prateleira para vender mais.",
  5: "Sextou com estoque abastecido! Faça seu pedido.",
  6: "Sábado também é dia de vender. Reponha seu estoque!",
};

export function getTodayMessage() {
  return weekdayMessages[new Date().getDay()];
}
