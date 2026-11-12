/**
 * I codici DETAIL delle funzioni punti diventano frasi in italiano.
 * Il checkout altrimenti le copre con «Non abbiamo ricevuto la conferma…».
 */

const LOYALTY_MESSAGES: Record<string, string> = {
  LOYALTY_INSUFFICIENT: 'Punti insufficienti',
  LOYALTY_DISABLED: 'Skibidi Coin non è attivo in questa pizzeria',
  LOYALTY_INVALID: 'Quantità punti non valida',
  LOYALTY_NOT_MULTIPLE: 'I punti si usano solo a multipli della soglia prevista',
  LOYALTY_DISCOUNT_TOO_HIGH: 'Lo sconto punti supera il totale dei prodotti',
  LOYALTY_NOT_STAFF: 'Solo lo staff della pizzeria può farlo',
  LOYALTY_NOT_AUTHENTICATED: 'Accedi per usare i punti',
  LOYALTY_NOT_OWNER: 'Puoi usare solo i punti del tuo account',
  LOYALTY_OTHER_COMPANY: 'Questo cliente non è della tua pizzeria',
  LOYALTY_REASON_REQUIRED: 'Il motivo è obbligatorio',
  LOYALTY_NO_REQUEST: 'Questo ordine non ha una richiesta punti',
  LOYALTY_ALREADY_CONFIRMED: 'Lo sconto punti è già confermato',
  LOYALTY_CLOSED_ORDER: 'Ordine chiuso: lo sconto punti non si può confermare',
  LOYALTY_NOT_FOUND: 'Movimento punti non trovato',
  LOYALTY_POINTS_LOCKED: 'I punti dell’ordine si aggiornano solo in cassa',
  LOYALTY_ALREADY_REVERSED: 'Questo movimento è già stato stornato',
  LOYALTY_EXPIRED: 'Questi punti sono scaduti',
  LOYALTY_ALREADY_USED: 'Questi punti sono già stati usati',
  LOYALTY_NOT_REVERSIBLE: 'Questo movimento non si può stornare',
};

export class LoyaltyUserError extends Error {
  readonly loyalty = true;

  constructor(message: string) {
    super(message);
    this.name = 'LoyaltyUserError';
  }
}

function errorText(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const extra = error as Error & { details?: unknown; hint?: unknown; code?: unknown };
    return [error.message, extra.details, extra.hint, extra.code].filter(Boolean).join(' ');
  }
  if (typeof error === 'object') {
    const row = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [row.message, row.details, row.hint, row.code].filter(Boolean).join(' ');
  }
  return '';
}

export function loyaltyUserMessage(error: unknown): string | null {
  if (error instanceof LoyaltyUserError) return error.message;
  const text = errorText(error);
  for (const code of Object.keys(LOYALTY_MESSAGES)) {
    if (text.includes(code)) return LOYALTY_MESSAGES[code];
  }
  return null;
}

export function loyaltyUserError(error: unknown, fallback: string): Error {
  const message = loyaltyUserMessage(error);
  if (message) return new LoyaltyUserError(message);
  return new Error(fallback);
}
