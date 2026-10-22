/**
 * Antiabuso lato client: messaggi per gli errori del server e flag Turnstile.
 * I controlli veri stanno nel DB (migration 20261013140000_order_antiabuse.sql).
 */
export type AntiabuseCode =
  | 'ANTIABUSE_LOGIN_REQUIRED'
  | 'ANTIABUSE_ACCOUNT_BLOCKED'
  | 'ANTIABUSE_ORDER_TOO_LARGE'
  | 'ANTIABUSE_TOO_MANY_OPEN_ORDERS'
  | 'ANTIABUSE_RATE_LIMITED'
  | 'ANTIABUSE_CAPTCHA_REQUIRED';

const MESSAGES_IT: Record<AntiabuseCode, string> = {
  ANTIABUSE_LOGIN_REQUIRED: 'Accedi con Google per inviare l’ordine.',
  ANTIABUSE_ACCOUNT_BLOCKED: 'Il tuo account non può inviare ordini online. Chiama la pizzeria.',
  ANTIABUSE_ORDER_TOO_LARGE: 'L’ordine supera l’importo massimo online. Per ordini grandi chiama la pizzeria.',
  ANTIABUSE_TOO_MANY_OPEN_ORDERS: 'Hai già ordini in corso. Attendi che vengano ritirati prima di ordinarne altri.',
  ANTIABUSE_RATE_LIMITED: 'Troppi ordini in poco tempo. Riprova tra qualche minuto.',
  ANTIABUSE_CAPTCHA_REQUIRED: 'Conferma di non essere un robot e riprova.',
};

const MESSAGES_EN: Record<AntiabuseCode, string> = {
  ANTIABUSE_LOGIN_REQUIRED: 'Sign in with Google to place the order.',
  ANTIABUSE_ACCOUNT_BLOCKED: 'Your account cannot place online orders. Please call the restaurant.',
  ANTIABUSE_ORDER_TOO_LARGE: 'This order is above the online limit. Please call the restaurant for large orders.',
  ANTIABUSE_TOO_MANY_OPEN_ORDERS: 'You already have orders in progress. Pick them up before ordering again.',
  ANTIABUSE_RATE_LIMITED: 'Too many orders in a short time. Try again in a few minutes.',
  ANTIABUSE_CAPTCHA_REQUIRED: 'Please confirm you are not a robot and try again.',
};

export function getAntiabuseCode(message: string | null | undefined): AntiabuseCode | null {
  const match = /ANTIABUSE_[A-Z_]+/.exec(message ?? '');
  if (!match) return null;
  return match[0] in MESSAGES_IT ? (match[0] as AntiabuseCode) : null;
}

export function getAntiabuseMessage(message: string | null | undefined, language: 'it' | 'en' = 'it'): string | null {
  const code = getAntiabuseCode(message);
  if (!code) return null;
  return (language === 'en' ? MESSAGES_EN : MESSAGES_IT)[code];
}

/** Turnstile attivo solo se Carmine configura la site key pubblica (nessun default). */
// Accesso statico: Expo inlinea solo `process.env.EXPO_PUBLIC_*` scritto per intero.
export function getTurnstileSiteKey(
  raw: string | undefined = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY
): string | null {
  const key = raw?.trim();
  return key ? key : null;
}

export function isTurnstileEnabled(raw: string | undefined = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY): boolean {
  return getTurnstileSiteKey(raw) !== null;
}

/** Azione Turnstile del checkout: l'edge function rifiuta token emessi per altre azioni. */
export const TURNSTILE_ACTION = 'checkout';

/**
 * Esito della chiamata a verify-turnstile, visto dal client.
 * - verified: pass salvato, si invia l'ordine;
 * - rejected: Cloudflare ha rifiutato il token (400/403): si chiede di rifare la verifica;
 * - unverified: funzione non deployata (404), non configurata (503), token scaduto/già usato (409),
 *   login mancante (401), rete o Cloudflare giù. Si invia comunque l'ordine: decide il server
 *   (create_order_with_items chiede il pass solo se companies.require_turnstile = true).
 * Così le chiavi mancanti o la funzione non ancora deployata non bloccano il checkout.
 */
export type TurnstileVerification = 'verified' | 'rejected' | 'unverified';

export function classifyTurnstileVerification(error: unknown): TurnstileVerification {
  if (!error) return 'verified';
  const status = (error as { context?: { status?: unknown } } | null)?.context?.status;
  if (status === 400 || status === 403) return 'rejected';
  return 'unverified';
}

type InvokeVerifyTurnstile = (
  name: 'verify-turnstile',
  options: { body: { token: string } }
) => Promise<{ error: unknown }>;

/**
 * Passo Turnstile prima di create_order_with_items. 'skipped' = Turnstile spento (nessuna site key)
 * o nessun token (widget non caricato/non risolto): l'ordine parte e decide il server.
 */
export async function verifyTurnstileBeforeOrder(
  token: string | null | undefined,
  invoke: InvokeVerifyTurnstile,
  enabled: boolean = isTurnstileEnabled()
): Promise<TurnstileVerification | 'skipped'> {
  if (!enabled || !token) return 'skipped';
  try {
    const { error } = await invoke('verify-turnstile', { body: { token } });
    return classifyTurnstileVerification(error);
  } catch {
    return 'unverified';
  }
}

/** Errore già tradotto da mostrare così com'è al cliente. */
export class AntiabuseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AntiabuseError';
  }
}

export function isAntiabuseError(error: unknown): error is AntiabuseError {
  return error instanceof Error && error.name === 'AntiabuseError';
}
