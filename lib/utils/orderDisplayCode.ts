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

export function generateFallbackOrderDisplayCode(orderId: string): string {
  const hash = hashOrderId(orderId);
  const callsign = ORDER_CALLSIGNS[hash % ORDER_CALLSIGNS.length];
  const number = (hash % 98) + 1;
  return `${callsign} #${number}`;
}

export function getOrderDisplayCode(order: OrderCodeSource): string {
  const trimmed = order.display_code?.trim();
  if (trimmed) return trimmed;
  return generateFallbackOrderDisplayCode(order.id);
}

export function formatCustomerOrderCode(order: OrderCodeSource): string {
  return `🍕 ${getOrderDisplayCode(order)}`;
}
