export function generateOrderNumber(sequence: number) {
  return `#${String(sequence).padStart(4, "0")}`;
}
