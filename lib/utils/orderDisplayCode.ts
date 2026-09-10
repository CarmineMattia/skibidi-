const ORDER_CALLSIGNS = [
  'Margherita',
  'Diavola',
  'Bufala',
  'Tartufo',
  'Patate',
  'Ortolana',
  'Marinara',
  'Carbonara',
  'Speck',
  'Porcini',
  'Gamberi',
  'Bresaola',
  'Nduja',
  'Capricciosa',
  '4 Formaggi',
  'Prosciutto',
  'Wurstel',
  'Funghi',
  'Rucola',
  'Norma',
] as const;

type OrderCodeSource = {
  id: string;
  display_code?: string | null;
};

function hashOrderId(orderId: string): number {
  const compact = orderId.replaceAll('-', '');
  return compact.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

/** Fallback when DB has no display_code yet — plain sequential-looking label. */
export function generateFallbackOrderDisplayCode(orderId: string): string {
  const hash = hashOrderId(orderId);
  const number = (hash % 98) + 1;
  return `Ordine #${number}`;
}

/**
 * Prefer stored display_code.
 * Legacy nickname codes like "Patate #3" are rewritten to "Ordine #3" for kitchen clarity.
 */
export function getOrderDisplayCode(order: OrderCodeSource): string {
  const trimmed = order.display_code?.trim();
  if (!trimmed) return generateFallbackOrderDisplayCode(order.id);

  const legacy = trimmed.match(new RegExp(`^(?:${ORDER_CALLSIGNS.map(escapeRegExp).join('|')})\\s*#(\\d+)$`, 'i'));
  if (legacy?.[1]) {
    return `Ordine #${legacy[1]}`;
  }

  return trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatCustomerOrderCode(order: OrderCodeSource): string {
  return getOrderDisplayCode(order);
}
