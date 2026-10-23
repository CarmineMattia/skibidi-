/**
 * Order lookup by id (/order-success, /order-tracking).
 * A made-up / mistyped / deleted order id must show "not found", never a
 * fake "Ordine #N" built from the id or from the URL.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class OrderNotFoundError extends Error {
  readonly code = 'ORDER_NOT_FOUND';
  constructor(message = 'Ordine non trovato') {
    super(message);
    this.name = 'OrderNotFoundError';
  }
}

export function isValidOrderId(orderId: string | null | undefined): orderId is string {
  return typeof orderId === 'string' && UUID_RE.test(orderId.trim());
}

export function isOrderNotFoundError(error: unknown): boolean {
  return (
    error instanceof OrderNotFoundError ||
    (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ORDER_NOT_FOUND')
  );
}

/**
 * PostgREST answer of get_order_tracking → not found?
 * NULL body (no such order) or 22P02 (not a uuid) mean "no such order";
 * anything else (network, 5xx, timeouts) is a verification error, not "not found".
 */
export function isMissingOrderResponse(data: unknown, error: { code?: string } | null | undefined): boolean {
  if (error) return error.code === '22P02';
  return data === null || data === undefined || (typeof data === 'object' && !('id' in (data as object)));
}

export type OrderSuccessState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'unverified'; label: string }
  | { kind: 'found'; label: string };

/**
 * What /order-success shows. The order label comes from the server row
 * (or the code passed by checkout while the server row is still loading);
 * a not-found order never gets a label.
 */
export function resolveOrderSuccessState(input: {
  hydrated: boolean;
  orderId?: string | null;
  displayCode?: string | null;
  order?: { id: string; display_code?: string | null } | null;
  error?: unknown;
  formatLabel: (order: { id: string; display_code?: string | null }) => string;
}): OrderSuccessState {
  const { hydrated, orderId, displayCode, order, error, formatLabel } = input;
  if (!hydrated) return { kind: 'loading' };
  if (!isValidOrderId(orderId)) return { kind: 'not_found' };
  if (isOrderNotFoundError(error)) return { kind: 'not_found' };
  if (order) return { kind: 'found', label: displayCode ? `🍕 ${displayCode}` : formatLabel(order) };
  if (error) return { kind: 'unverified', label: displayCode ? `🍕 ${displayCode}` : formatLabel({ id: orderId, display_code: null }) };
  return { kind: 'loading' };
}
