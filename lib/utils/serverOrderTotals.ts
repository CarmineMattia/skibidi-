/**
 * Prezzi confermati dal server (create_order_with_items, 20261020150000).
 * Il server ricalcola righe, consegna e totale dal listino: quelli valgono per
 * scontrino e conferma. Con il DB vecchio (risposta senza items) restano i
 * prezzi del client.
 */
export interface ServerOrderResponse {
  id?: string;
  display_code?: string;
  total_amount?: number | string | null;
  delivery_fee?: number | string | null;
  items?: { product_id?: string; quantity?: number; unit_price?: number | string; total_price?: number | string }[] | null;
}

export interface ResolvedOrderLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ResolvedOrderTotals {
  lines: ResolvedOrderLine[];
  deliveryFee: number;
  total: number;
  fromServer: boolean;
}

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const round2 = (value: number) => Math.round(value * 100) / 100;

export function resolveOrderTotals(
  saved: ServerOrderResponse | null | undefined,
  clientLines: ResolvedOrderLine[],
  clientDeliveryFee: number
): ResolvedOrderTotals {
  const clientTotal = round2(clientLines.reduce((sum, line) => sum + line.totalPrice, 0) + clientDeliveryFee);
  const serverTotal = toNumber(saved?.total_amount);
  const items = saved?.items;
  // Lines come back in the order they were sent; use them only if they match.
  const serverLines =
    Array.isArray(items) && items.length === clientLines.length &&
    items.every((item, i) => item.product_id === clientLines[i].productId && item.quantity === clientLines[i].quantity &&
      toNumber(item.unit_price) !== null && toNumber(item.total_price) !== null)
      ? clientLines.map((line, i) => ({ ...line, unitPrice: toNumber(items[i].unit_price)!, totalPrice: toNumber(items[i].total_price)! }))
      : null;
  if (serverTotal === null) {
    return { lines: clientLines, deliveryFee: clientDeliveryFee, total: clientTotal, fromServer: false };
  }
  if (!serverLines) {
    // Old DB function (or unexpected shape): saved total, client lines.
    return { lines: clientLines, deliveryFee: clientDeliveryFee, total: serverTotal, fromServer: false };
  }
  const linesTotal = round2(serverLines.reduce((sum, line) => sum + line.totalPrice, 0));
  const fee = toNumber(saved?.delivery_fee) ?? round2(serverTotal - linesTotal);
  return { lines: serverLines, deliveryFee: fee, total: serverTotal, fromServer: true };
}
