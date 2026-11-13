/**
 * Link WhatsApp dell'ordine. Stesso numero del CTA in home (BRAND.whatsapp).
 */

export function orderQuestionNumber(displayCode: string): string {
  const trimmed = displayCode.trim().replace(/[\r\n]+/g, ' ');
  const match = /#\s*(\d+)\s*$/.exec(trimmed);
  if (match) return match[1];
  return trimmed.replace(/[^\w #_-]+/g, '').slice(0, 40);
}

export function orderWhatsAppPrefill(orderNumber: string): string {
  const number = orderNumber.trim();
  return number ? `Ciao, ho una domanda sull'ordine #${number}` : "Ciao, ho una domanda sull'ordine";
}

/** `https://wa.me/<digits>?text=...` — digits only, same host as the hero CTA. */
export function orderWhatsAppUrl(whatsappNumber: string, orderNumber: string): string | null {
  const digits = whatsappNumber.replace(/\D/g, '');
  if (!digits) return null;
  const text = orderWhatsAppPrefill(orderNumber);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
