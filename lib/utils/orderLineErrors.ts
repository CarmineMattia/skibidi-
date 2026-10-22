/**
 * Rifiuti di create_order_with_items legati a una riga del carrello
 * (20261020150000_server_side_pricing.sql): message "Invalid order lines" /
 * "Invalid order total" / "Delivery fee misconfigured", DETAIL = codice,
 * HINT = {"product_id", "line"}. Diventano messaggi chiari per il cliente.
 */
import { AntiabuseError } from '@/lib/utils/antiabuse';

export type OrderLineErrorCode =
  | 'ORDER_PRODUCT_UNAVAILABLE'
  | 'ORDER_INVALID_OPTIONS'
  | 'ORDER_INVALID_NOTE'
  | 'ORDER_INVALID_QUANTITY'
  | 'ORDER_TOTAL_TOO_LOW'
  | 'ORDER_DELIVERY_FEE_INVALID'
  | 'ORDER_NOTES_TOO_LONG';

const CODES: OrderLineErrorCode[] = [
  'ORDER_PRODUCT_UNAVAILABLE', 'ORDER_INVALID_OPTIONS', 'ORDER_INVALID_NOTE',
  'ORDER_INVALID_QUANTITY', 'ORDER_TOTAL_TOO_LOW', 'ORDER_DELIVERY_FEE_INVALID',
  // 20261022100000_order_notes_menu_hardening.sql: notes > 1000 characters (orders or order_items)
  'ORDER_NOTES_TOO_LONG',
];

/** Limite dei campi "Note per la cucina" (il server accetta fino a 1000 caratteri per riga). */
export const ORDER_NOTE_INPUT_MAX_CHARS = 200;

/** Shown as is (isAntiabuseError → true); carries the cart line to fix. */
export class OrderLineError extends AntiabuseError {
  readonly code: OrderLineErrorCode;
  readonly productId: string | null;
  /** The line cannot be ordered as it is: the checkout removes it from the cart. */
  readonly removeFromCart: boolean;
  constructor(message: string, code: OrderLineErrorCode, productId: string | null) {
    super(message);
    this.code = code;
    this.productId = productId;
    this.removeFromCart = Boolean(productId) && (code === 'ORDER_PRODUCT_UNAVAILABLE' || code === 'ORDER_INVALID_OPTIONS');
  }
}

export function isOrderLineError(error: unknown): error is OrderLineError {
  return error instanceof OrderLineError;
}

interface RpcError { message?: string; details?: string | null; hint?: string | null }

export function toOrderLineError(
  error: RpcError | null | undefined,
  items: { product: { id: string; name: string } }[],
  language: 'it' | 'en' = 'it'
): OrderLineError | null {
  const code = CODES.find((candidate) => candidate === error?.details?.trim());
  if (!code) return null;
  let productId: string | null = null;
  try {
    const hint = error?.hint ? JSON.parse(error.hint) : null;
    productId = typeof hint?.product_id === 'string' ? hint.product_id : null;
  } catch {
    productId = null;
  }
  const name = items.find((item) => item.product.id === productId)?.product.name ?? (language === 'en' ? 'a product' : 'un prodotto');
  const it: Record<OrderLineErrorCode, string> = {
    ORDER_PRODUCT_UNAVAILABLE: `Un prodotto nel carrello non è più disponibile: ${name}. L'abbiamo tolto dal carrello.`,
    ORDER_INVALID_OPTIONS: `Le opzioni scelte per ${name} non sono più valide. L'abbiamo tolto dal carrello: aggiungilo di nuovo dal menu.`,
    ORDER_INVALID_NOTE: `La nota per ${name} non è valida: modificala e riprova.`,
    ORDER_INVALID_QUANTITY: 'Quantità non valida nel carrello: controlla le quantità e riprova.',
    ORDER_TOTAL_TOO_LOW: "Il totale dell'ordine non è valido.",
    ORDER_DELIVERY_FEE_INVALID: 'Il costo di consegna non è configurato correttamente: contatta la pizzeria o scegli il ritiro.',
    ORDER_NOTES_TOO_LONG: 'Le note sono troppo lunghe: accorciale e riprova.',
  };
  const en: Record<OrderLineErrorCode, string> = {
    ORDER_PRODUCT_UNAVAILABLE: `A product in your cart is no longer available: ${name}. We removed it from your cart.`,
    ORDER_INVALID_OPTIONS: `The options chosen for ${name} are no longer valid. We removed it from your cart: please add it again from the menu.`,
    ORDER_INVALID_NOTE: `The note for ${name} is not valid: please edit it and try again.`,
    ORDER_INVALID_QUANTITY: 'Invalid quantity in your cart: please check and try again.',
    ORDER_TOTAL_TOO_LOW: 'The order total is not valid.',
    ORDER_DELIVERY_FEE_INVALID: 'The delivery fee is not configured correctly: please contact the restaurant or choose pickup.',
    ORDER_NOTES_TOO_LONG: 'The notes are too long: please shorten them and try again.',
  };
  return new OrderLineError((language === 'en' ? en : it)[code], code, productId);
}
