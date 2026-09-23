export function countInstallments(paymentTerms: string): number | null {
  const times = paymentTerms.match(/(\d+)\s*x\b/i);
  if (times) return Number(times[1]);
  const days = paymentTerms.match(/\d+/g);
  if (days) return days.length;
  return /vista/i.test(paymentTerms) ? 1 : null;
}

export function formatInstallments(count: number): string {
  return `${count} ${count === 1 ? "parcela" : "parcelas"}`;
}
