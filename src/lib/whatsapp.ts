export function buildWhatsAppLink(phone: string, message: string) {
  const params = new URLSearchParams({ text: message });
  return `https://wa.me/${phone}?${params.toString()}`;
}
