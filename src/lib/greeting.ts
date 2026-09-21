const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function productionGreeting(date = new Date()) {
  const hour = date.getHours();
  const turn = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const weekday = WEEKDAY_NAMES[date.getDay()];
  return `${turn}! Hoje é ${weekday}, vamos produzir?`;
}
