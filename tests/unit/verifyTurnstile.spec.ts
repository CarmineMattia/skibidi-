import { describe, expect, test, vi } from 'vitest';
import {
  createVerifyTurnstileHandler,
  parseAllowedHostnames,
  PASS_TTL_MS,
  SITEVERIFY_URL,
  TURNSTILE_ACTION as SERVER_ACTION,
  type VerifyTurnstileDeps,
} from '../../supabase/functions/verify-turnstile/handler';
import {
  classifyTurnstileVerification,
  TURNSTILE_ACTION,
  verifyTurnstileBeforeOrder,
} from '../../lib/utils/antiabuse';

const NOW = new Date('2026-10-22T08:00:00Z');
const USER = { id: '00000000-0000-0000-0000-0000000000a1', is_anonymous: false };

function setup(over: Partial<VerifyTurnstileDeps> & { outcome?: unknown } = {}) {
  const { outcome = { success: true, hostname: 'skibidi-eight-virid.vercel.app', action: 'checkout' }, ...rest } = over;
  const fetchMock = vi.fn(async () => ({ json: async () => outcome }));
  const savePass = vi.fn(async () => ({ error: null }));
  const getUser = vi.fn(async () => USER);
  const deps: VerifyTurnstileDeps = {
    secret: 'test-secret',
    allowedHostnames: 'skibidi-eight-virid.vercel.app, localhost',
    getUser,
    savePass,
    fetch: fetchMock,
    now: () => NOW,
    ...rest,
  };
  return { handler: createVerifyTurnstileHandler(deps), fetchMock, savePass, getUser };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://x.supabase.co/functions/v1/verify-turnstile', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function call(handler: (r: Request) => Promise<Response>, req: Request) {
  const res = await handler(req);
  return { status: res.status, body: res.status === 200 && req.method === 'OPTIONS' ? null : await res.json().catch(() => null) };
}

describe('edge function verify-turnstile (mock di Cloudflare e Supabase)', () => {
  test('token valido: chiama siteverify con secret, token e IP e salva un pass di 5 minuti', async () => {
    const { handler, fetchMock, savePass, getUser } = setup();
    const r = await call(handler, post({ token: 'tok-1' }, { 'CF-Connecting-IP': '1.2.3.4' }));
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(getUser).toHaveBeenCalledWith('Bearer user-jwt');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: FormData }];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    expect(init.body.get('secret')).toBe('test-secret');
    expect(init.body.get('response')).toBe('tok-1');
    expect(init.body.get('remoteip')).toBe('1.2.3.4');
    expect(savePass).toHaveBeenCalledWith(USER.id, NOW, new Date(NOW.getTime() + PASS_TTL_MS));
  });

  test('senza TURNSTILE_SECRET_KEY risponde 503 e non chiama Cloudflare', async () => {
    for (const secret of [undefined, '', '   ']) {
      const { handler, fetchMock, savePass } = setup({ secret });
      expect((await call(handler, post({ token: 't' }))).body).toEqual({ error: 'turnstile_not_configured' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(savePass).not.toHaveBeenCalled();
    }
  });

  test('secret sbagliata su Cloudflare = non configurato (503), non colpa del cliente', async () => {
    const { handler, savePass } = setup({ outcome: { success: false, 'error-codes': ['invalid-input-secret'] } });
    expect(await call(handler, post({ token: 't' }))).toEqual({ status: 503, body: { error: 'turnstile_not_configured' } });
    expect(savePass).not.toHaveBeenCalled();
  });

  test('serve un utente loggato non anonimo', async () => {
    for (const user of [null, { id: 'x', is_anonymous: true }]) {
      const { handler, fetchMock } = setup({ getUser: async () => user });
      expect(await call(handler, post({ token: 't' }))).toEqual({ status: 401, body: { error: 'login_required' } });
      expect(fetchMock).not.toHaveBeenCalled();
    }
    const { handler } = setup({ getUser: async () => { throw new Error('auth down'); } });
    expect((await call(handler, post({ token: 't' }))).status).toBe(401);
  });

  test('body e token non validi: 400', async () => {
    const { handler, fetchMock } = setup();
    expect((await call(handler, post('not json'))).body).toEqual({ error: 'invalid_body' });
    expect((await call(handler, post({}))).body).toEqual({ error: 'missing_token' });
    expect((await call(handler, post({ token: 42 }))).body).toEqual({ error: 'missing_token' });
    expect((await call(handler, post({ token: 'x'.repeat(2049) }))).body).toEqual({ error: 'missing_token' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('token rifiutato da Cloudflare: 403, nessun pass', async () => {
    const { handler, savePass } = setup({ outcome: { success: false, 'error-codes': ['invalid-input-response'] } });
    expect(await call(handler, post({ token: 't' }))).toEqual({ status: 403, body: { error: 'turnstile_failed' } });
    expect(savePass).not.toHaveBeenCalled();
    const { handler: h2 } = setup({ outcome: null });
    expect((await call(h2, post({ token: 't' }))).status).toBe(403);
  });

  test('token scaduto o già usato: 409 (serve un nuovo widget)', async () => {
    const { handler, savePass } = setup({ outcome: { success: false, 'error-codes': ['timeout-or-duplicate'] } });
    expect(await call(handler, post({ token: 't' }))).toEqual({ status: 409, body: { error: 'turnstile_expired' } });
    expect(savePass).not.toHaveBeenCalled();
  });

  test('hostname non ammesso o azione diversa: 403 turnstile_wrong_site', async () => {
    const { handler } = setup({ outcome: { success: true, hostname: 'evil.example', action: 'checkout' } });
    expect((await call(handler, post({ token: 't' }))).body).toEqual({ error: 'turnstile_wrong_site' });
    const { handler: h2 } = setup({ outcome: { success: true, hostname: 'localhost', action: 'login' } });
    expect((await call(h2, post({ token: 't' }))).body).toEqual({ error: 'turnstile_wrong_site' });
    const { handler: h3 } = setup({ allowedHostnames: undefined, outcome: { success: true, hostname: 'anything.dev', action: 'checkout' } });
    expect((await call(h3, post({ token: 't' }))).status).toBe(200);
  });

  test('Cloudflare irraggiungibile: 502; salvataggio fallito: 500', async () => {
    const { handler } = setup({ fetch: async () => { throw new Error('network'); } });
    expect(await call(handler, post({ token: 't' }))).toEqual({ status: 502, body: { error: 'turnstile_unavailable' } });
    const { handler: h2 } = setup({ savePass: async () => ({ error: new Error('db') }) });
    expect(await call(h2, post({ token: 't' }))).toEqual({ status: 500, body: { error: 'pass_not_saved' } });
  });

  test('CORS preflight e metodi', async () => {
    const { handler } = setup();
    const pre = await handler(new Request('https://x/f', { method: 'OPTIONS' }));
    expect(pre.status).toBe(200);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect((await handler(new Request('https://x/f', { method: 'GET' }))).status).toBe(405);
  });

  test('parseAllowedHostnames e stessa azione di client e server', () => {
    expect(parseAllowedHostnames(' Skibidi-Eight-Virid.vercel.app , localhost,, ')).toEqual([
      'skibidi-eight-virid.vercel.app',
      'localhost',
    ]);
    expect(parseAllowedHostnames(undefined)).toEqual([]);
    expect(SERVER_ACTION).toBe(TURNSTILE_ACTION);
  });
});

describe('checkout: passo Turnstile prima di create_order_with_items', () => {
  const httpError = (status: number) => ({ name: 'FunctionsHttpError', context: { status } });

  test('classifica le risposte della funzione', () => {
    expect(classifyTurnstileVerification(null)).toBe('verified');
    expect(classifyTurnstileVerification(httpError(403))).toBe('rejected');
    expect(classifyTurnstileVerification(httpError(400))).toBe('rejected');
    for (const s of [401, 404, 409, 500, 502, 503]) expect(classifyTurnstileVerification(httpError(s))).toBe('unverified');
    expect(classifyTurnstileVerification({ name: 'FunctionsFetchError', context: {} })).toBe('unverified');
    expect(classifyTurnstileVerification(new Error('x'))).toBe('unverified');
  });

  test('senza site key (prod oggi) non chiama la funzione: checkout invariato', async () => {
    const invoke = vi.fn();
    expect(await verifyTurnstileBeforeOrder('tok', invoke, false)).toBe('skipped');
    expect(invoke).not.toHaveBeenCalled();
  });

  test('con site key ma senza token (widget non caricato) invia comunque: decide il server', async () => {
    const invoke = vi.fn();
    expect(await verifyTurnstileBeforeOrder(null, invoke, true)).toBe('skipped');
    expect(await verifyTurnstileBeforeOrder('', invoke, true)).toBe('skipped');
    expect(invoke).not.toHaveBeenCalled();
  });

  test('con site key e token chiama verify-turnstile con il token', async () => {
    const invoke = vi.fn(async () => ({ error: null }));
    expect(await verifyTurnstileBeforeOrder('tok-9', invoke, true)).toBe('verified');
    expect(invoke).toHaveBeenCalledWith('verify-turnstile', { body: { token: 'tok-9' } });
  });

  test('funzione non deployata / non configurata / rete giù: non blocca il checkout', async () => {
    for (const status of [404, 503, 502, 409]) {
      expect(await verifyTurnstileBeforeOrder('t', async () => ({ error: httpError(status) }), true)).toBe('unverified');
    }
    expect(await verifyTurnstileBeforeOrder('t', async () => { throw new Error('offline'); }, true)).toBe('unverified');
  });

  test('token rifiutato: il checkout si ferma (rejected)', async () => {
    expect(await verifyTurnstileBeforeOrder('t', async () => ({ error: httpError(403) }), true)).toBe('rejected');
  });
});
