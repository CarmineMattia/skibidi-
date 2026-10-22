// Logica pura dell'edge function verify-turnstile (nessuna dipendenza da Deno o da supabase-js):
// index.ts la collega a Deno.env, fetch e Supabase; i test (tests/unit/verifyTurnstile.spec.ts)
// la usano con dei mock.
//
// Risposte (il client decide solo cosa mostrare; chi blocca davvero è create_order_with_items,
// che consuma il pass solo se companies.require_turnstile = true). Il client ferma il checkout
// SOLO con 403 turnstile_failed (verdetto definitivo di Cloudflare sul token); per tutto il resto
// invia l'ordine senza pass e decide il server.
//   200 { ok: true }                          token valido, pass monouso salvato (5 min)
//   400 { error: 'missing_token' | 'invalid_body' }
//   401 { error: 'login_required' }           nessun utente o sessione anonima
//   403 { error: 'turnstile_failed' }         Cloudflare: token non valido (invalid-input-response)
//   403 { error: 'turnstile_wrong_action' }   token valido ma senza azione o con un'azione diversa da checkout
//   409 { error: 'turnstile_expired' }        token scaduto o già usato (serve un nuovo widget)
//   502 { error: 'turnstile_unavailable' }    siteverify non raggiungibile, oltre 5 s, internal-error,
//                                             risposta non valida o codici sconosciuti (problema del provider)
//   503 { error: 'turnstile_not_configured' } manca TURNSTILE_SECRET_KEY (o la secret è sbagliata)
//   503 { error: 'turnstile_wrong_site' }     hostname non in TURNSTILE_ALLOWED_HOSTNAMES (configurazione)
//   500 { error: 'pass_not_saved' }
// remoteip non viene inviato: è facoltativo per Cloudflare e gli header con l'IP (x-forwarded-for)
// possono essere impostati dal client.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_ACTION = 'checkout';
export const PASS_TTL_MS = 5 * 60 * 1000;
export const MAX_TOKEN_LENGTH = 2048;
/** Oltre questo tempo siteverify viene abbandonato (502): il checkout non resta appeso. */
export const SITEVERIFY_TIMEOUT_MS = 5000;

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type SiteverifyOutcome = {
  success?: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
};

export type VerifyTurnstileDeps = {
  /** TURNSTILE_SECRET_KEY; undefined/vuota = non configurato. */
  secret: string | undefined;
  /** TURNSTILE_ALLOWED_HOSTNAMES separati da virgola (facoltativo: il widget Cloudflare li limita già). */
  allowedHostnames?: string | undefined;
  /** Utente della sessione (dall'header Authorization). */
  getUser: (authHeader: string) => Promise<{ id: string; is_anonymous?: boolean } | null>;
  /** Salva il pass monouso per l'utente (service role). */
  savePass: (userId: string, verifiedAt: Date, expiresAt: Date) => Promise<{ error: unknown | null }>;
  fetch: (url: string, init: { method: string; body: FormData; signal?: AbortSignal }) => Promise<{ json: () => Promise<unknown> }>;
  now?: () => Date;
  /** Per i test; predefinito SITEVERIFY_TIMEOUT_MS. */
  timeoutMs?: number;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export function parseAllowedHostnames(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

const SECRET_ERRORS = new Set(['missing-input-secret', 'invalid-input-secret']);
/** Verdetti definitivi sul token: l'unico caso in cui il client ferma il checkout. */
const INVALID_TOKEN_ERRORS = new Set(['invalid-input-response']);

/** La promessa o un errore dopo `ms`, anche se fetch ignora il segnale. */
function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('siteverify_timeout'));
    }, ms);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

export function createVerifyTurnstileHandler(deps: VerifyTurnstileDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const secret = deps.secret?.trim();
    if (!secret) return json(503, { error: 'turnstile_not_configured' });

    const user = await deps.getUser(req.headers.get('Authorization') ?? '').catch(() => null);
    if (!user || user.is_anonymous) return json(401, { error: 'login_required' });

    let token = '';
    try {
      const body = (await req.json()) as { token?: unknown } | null;
      token = typeof body?.token === 'string' ? body.token.trim() : '';
    } catch {
      return json(400, { error: 'invalid_body' });
    }
    if (!token || token.length > MAX_TOKEN_LENGTH) return json(400, { error: 'missing_token' });

    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    let outcome: SiteverifyOutcome;
    try {
      outcome = await withTimeout(deps.timeoutMs ?? SITEVERIFY_TIMEOUT_MS, async (signal) => {
        const res = await deps.fetch(SITEVERIFY_URL, { method: 'POST', body: form, signal });
        return ((await res.json()) ?? {}) as SiteverifyOutcome;
      });
    } catch {
      return json(502, { error: 'turnstile_unavailable' });
    }
    if (!outcome || typeof outcome !== 'object') return json(502, { error: 'turnstile_unavailable' });

    if (outcome.success !== true) {
      const codes = Array.isArray(outcome['error-codes']) ? outcome['error-codes'] : [];
      if (codes.some((c) => SECRET_ERRORS.has(c))) return json(503, { error: 'turnstile_not_configured' });
      if (codes.length > 0 && codes.every((c) => c === 'timeout-or-duplicate')) {
        return json(409, { error: 'turnstile_expired' });
      }
      if (codes.some((c) => INVALID_TOKEN_ERRORS.has(c))) return json(403, { error: 'turnstile_failed' });
      // internal-error, bad-request, codici sconosciuti o success non booleano: problema del provider
      return json(502, { error: 'turnstile_unavailable' });
    }

    const allowed = parseAllowedHostnames(deps.allowedHostnames);
    const hostname = (outcome.hostname ?? '').toLowerCase();
    if (allowed.length > 0 && !allowed.includes(hostname)) return json(503, { error: 'turnstile_wrong_site' });
    if (outcome.action !== TURNSTILE_ACTION) return json(403, { error: 'turnstile_wrong_action' });

    const now = deps.now?.() ?? new Date();
    const { error } = await deps.savePass(user.id, now, new Date(now.getTime() + PASS_TTL_MS));
    if (error) return json(500, { error: 'pass_not_saved' });
    return json(200, { ok: true });
  };
}
