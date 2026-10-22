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

/** Oltre questo tempo il checkout smette di aspettare verify-turnstile e invia l'ordine (decide il server). */
export const VERIFY_TURNSTILE_TIMEOUT_MS = 5000;

/**
 * Esito della chiamata a verify-turnstile, visto dal client.
 * - verified: pass salvato, si invia l'ordine;
 * - rejected: SOLO 403 { error: 'turnstile_failed' }, cioè Cloudflare dice che il token non è valido:
 *   si chiede di rifare la verifica;
 * - unverified: tutto il resto (funzione non deployata 404, non configurata o hostname non ammesso 503,
 *   token scaduto 409, azione diversa 403 turnstile_wrong_action, login 401, provider giù 502, oltre 5 s,
 *   rete giù, corpo illeggibile). Si invia comunque l'ordine: decide il server
 *   (create_order_with_items chiede il pass solo se companies.require_turnstile = true).
 * Così chiavi mancanti, configurazione sbagliata o Cloudflare giù non bloccano il checkout quando
 * require_turnstile = false; con true il server resta rigido (niente pass = ordine rifiutato).
 */
export type TurnstileVerification = 'verified' | 'rejected' | 'unverified';

type FunctionErrorLike = { context?: { status?: unknown; json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } } } | null;

export async function classifyTurnstileVerification(error: unknown): Promise<TurnstileVerification> {
  if (!error) return 'verified';
  const ctx = (error as FunctionErrorLike)?.context;
  if (ctx?.status !== 403) return 'unverified';
  try {
    const body = (await (ctx.clone ? ctx.clone().json() : ctx.json?.())) as { error?: unknown } | undefined;
    return body?.error === 'turnstile_failed' ? 'rejected' : 'unverified';
  } catch {
    return 'unverified';
  }
}

type InvokeVerifyTurnstile = (
  name: 'verify-turnstile',
  options: { body: { token: string }; timeout?: number }
) => Promise<{ error: unknown }>;

/**
 * Passo Turnstile prima di create_order_with_items. 'skipped' = Turnstile spento (nessuna site key)
 * o nessun token (widget non caricato/non risolto): l'ordine parte e decide il server.
 * Mai più di timeoutMs: oltre, 'unverified' (il checkout non resta su "Invio in corso…").
 */
export async function verifyTurnstileBeforeOrder(
  token: string | null | undefined,
  invoke: InvokeVerifyTurnstile,
  enabled: boolean = isTurnstileEnabled(),
  timeoutMs: number = VERIFY_TURNSTILE_TIMEOUT_MS
): Promise<TurnstileVerification | 'skipped'> {
  if (!enabled || !token) return 'skipped';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<TurnstileVerification>((resolve) => {
    timer = setTimeout(() => resolve('unverified'), timeoutMs);
  });
  const attempt = (async (): Promise<TurnstileVerification> => {
    try {
      const { error } = await invoke('verify-turnstile', { body: { token }, timeout: timeoutMs });
      return await classifyTurnstileVerification(error);
    } catch {
      return 'unverified';
    }
  })();
  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    clearTimeout(timer);
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
