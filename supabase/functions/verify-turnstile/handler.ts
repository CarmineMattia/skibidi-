// Logica pura dell'edge function verify-turnstile (nessuna dipendenza da Deno o da supabase-js):
// index.ts la collega a Deno.env, fetch e Supabase; i test (tests/unit/verifyTurnstile.spec.ts)
// la usano con dei mock.
//
// Risposte (il client decide solo cosa mostrare; chi blocca davvero è create_order_with_items,
// che consuma il pass solo se companies.require_turnstile = true):
//   200 { ok: true }                          token valido, pass monouso salvato (5 min)
//   400 { error: 'missing_token' | 'invalid_body' }
//   401 { error: 'login_required' }           nessun utente o sessione anonima
//   403 { error: 'turnstile_failed' }         Cloudflare dice che il token non è valido
//   403 { error: 'turnstile_wrong_site' }     token valido ma di un altro hostname/azione
//   409 { error: 'turnstile_expired' }        token scaduto o già usato (serve un nuovo widget)
//   502 { error: 'turnstile_unavailable' }    siteverify non raggiungibile
//   503 { error: 'turnstile_not_configured' } manca TURNSTILE_SECRET_KEY (o la secret è sbagliata)
//   500 { error: 'pass_not_saved' }

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_ACTION = 'checkout';
export const PASS_TTL_MS = 5 * 60 * 1000;
export const MAX_TOKEN_LENGTH = 2048;

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
  fetch: (url: string, init: { method: string; body: FormData }) => Promise<{ json: () => Promise<unknown> }>;
  now?: () => Date;
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
    const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (ip) form.append('remoteip', ip);

    let outcome: SiteverifyOutcome;
    try {
      const res = await deps.fetch(SITEVERIFY_URL, { method: 'POST', body: form });
      outcome = ((await res.json()) ?? {}) as SiteverifyOutcome;
    } catch {
      return json(502, { error: 'turnstile_unavailable' });
    }

    if (outcome.success !== true) {
      const codes = outcome['error-codes'] ?? [];
      if (codes.some((c) => SECRET_ERRORS.has(c))) return json(503, { error: 'turnstile_not_configured' });
      if (codes.length > 0 && codes.every((c) => c === 'timeout-or-duplicate')) {
        return json(409, { error: 'turnstile_expired' });
      }
      return json(403, { error: 'turnstile_failed' });
    }

    const allowed = parseAllowedHostnames(deps.allowedHostnames);
    const hostname = (outcome.hostname ?? '').toLowerCase();
    if (allowed.length > 0 && !allowed.includes(hostname)) return json(403, { error: 'turnstile_wrong_site' });
    if (outcome.action && outcome.action !== TURNSTILE_ACTION) return json(403, { error: 'turnstile_wrong_site' });

    const now = deps.now?.() ?? new Date();
    const { error } = await deps.savePass(user.id, now, new Date(now.getTime() + PASS_TTL_MS));
    if (error) return json(500, { error: 'pass_not_saved' });
    return json(200, { ok: true });
  };
}
