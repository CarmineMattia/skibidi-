/**
 * Chiede l'email di conferma dopo create_order_with_items.
 * Non aspetta il provider e non rilancia: l'ordine è già salvato.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ORDER_CONFIRMATION_FUNCTION = 'send-order-confirmation';

type Invoke = (name: string, args: { body: { orderId: string } }) => Promise<unknown> | unknown;

export function requestOrderConfirmationEmail(orderId: string, invoke: Invoke | null | undefined): void {
  if (!invoke || !UUID_RE.test(orderId)) return;
  try {
    void Promise.resolve(invoke(ORDER_CONFIRMATION_FUNCTION, { body: { orderId } })).catch(() => undefined);
  } catch {
    // Manca la function, la rete o la sessione: il checkout resta valido.
  }
}
