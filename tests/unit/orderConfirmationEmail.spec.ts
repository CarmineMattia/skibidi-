import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BRAND_NAME,
  ORDER_CONFIRMATION_PHONE,
  PAYMENT_LINE,
  TRACKING_BUTTON_LABEL,
  buildOrderConfirmationEmail,
  createSendOrderConfirmationHandler,
  escapeHtml,
  type ConfirmationOrder,
  type OutboundOrderEmail,
  type SendOrderConfirmationDeps,
} from '../../supabase/functions/send-order-confirmation/handler';

const ORDER_ID = '00000000-0000-4000-8000-0000000000ab';
const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const AUTH_EMAIL = 'secret.customer@gmail.com';
const NOW = new Date('2026-11-13T10:00:00Z');
const SITE = 'https://skibidi-eight-virid.vercel.app/ignored?x=1';
const FROM = 'Pizzeria Ambrosia <ordini@example.com>';

const order = (over: Partial<ConfirmationOrder> = {}): ConfirmationOrder => ({
  id: ORDER_ID,
  customerId: CUSTOMER,
  displayCode: 'Ordine #12',
  totalAmount: 12.5,
  createdAt: '2026-11-13T09:30:00Z',
  items: [{ name: 'Margherita', quantity: 2, totalPrice: 10 }],
  ...over,
});

function setup(over: Partial<SendOrderConfirmationDeps> = {}) {
  const sendEmail = vi.fn(async (_message: OutboundOrderEmail) => ({ ok: true }));
  const claimSend = vi.fn(async () => true);
  const releaseClaim = vi.fn(async () => undefined);
  const loadOrder = vi.fn(async () => order());
  const getUser = vi.fn(async () => ({ id: CUSTOMER, email: AUTH_EMAIL, is_anonymous: false }));
  const deps: SendOrderConfirmationDeps = {
    resendApiKey: 're_test',
    emailFrom: FROM,
    siteUrl: SITE,
    getUser,
    loadOrder,
    claimSend,
    releaseClaim,
    sendEmail,
    now: () => NOW,
    ...over,
  };
  return { handler: createSendOrderConfirmationHandler(deps), sendEmail, claimSend, releaseClaim, loadOrder, getUser };
}

const post = (body: unknown) =>
  new Request('https://x.supabase.co/functions/v1/send-order-confirmation', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function call(handler: (req: Request) => Promise<Response>, req: Request) {
  const res = await handler(req);
  return { status: res.status, body: await res.json() };
}

describe('email di conferma ordine', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('senza le env non chiama Resend e non segna l’ordine', async () => {
    for (const patch of [
      { resendApiKey: undefined },
      { resendApiKey: '   ' },
      { emailFrom: '' },
      { siteUrl: 'http://evil.example' },
      { siteUrl: 'not a url' },
    ]) {
      const { handler, sendEmail, claimSend, getUser } = setup(patch);
      expect(await call(handler, post({ orderId: ORDER_ID }))).toEqual({ status: 200, body: { ok: true, sent: false } });
      expect(sendEmail).not.toHaveBeenCalled();
      expect(claimSend).not.toHaveBeenCalled();
      expect(getUser).not.toHaveBeenCalled();
    }
  });

  it('manda una mail italiana all’email Google, con link di tracking e HTML escapato', async () => {
    const poisoned = order({
      displayCode: 'Ordine #12<script>',
      items: [{ name: 'Margherita <img src=x onerror=alert(1)>', quantity: 2, totalPrice: 10 }],
    });
    const { handler, sendEmail, claimSend } = setup({ loadOrder: async () => poisoned });
    const res = await call(handler, post({ orderId: ORDER_ID, email: 'attacker@evil.com', customer_name: 'Mario Rossi' }));
    expect(res).toEqual({ status: 200, body: { ok: true, sent: true } });
    expect(claimSend).toHaveBeenCalledWith(ORDER_ID, CUSTOMER);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const message = sendEmail.mock.calls[0]?.[0];
    expect(message).toBeTruthy();
    if (!message) return;
    expect(message.to).toBe(AUTH_EMAIL);
    expect(message.from).toBe(FROM);
    expect(message.idempotencyKey).toBe(`order-confirmation:${ORDER_ID}`);
    expect(message.subject.startsWith(`${BRAND_NAME} —`)).toBe(true);
    expect(message.subject).not.toContain('<');
    const href = `https://skibidi-eight-virid.vercel.app/order-tracking?orderId=${ORDER_ID}`;
    for (const body of [message.html, message.text]) {
      expect(body).toContain(BRAND_NAME);
      expect(body).toContain(PAYMENT_LINE);
      expect(body).toContain(ORDER_CONFIRMATION_PHONE);
      expect(body).toContain(TRACKING_BUTTON_LABEL);
      expect(body).toContain('2 × Margherita');
      expect(body).toContain('10,00 €');
      expect(body).toContain('Consegna');
      expect(body).toContain('2,50 €');
      expect(body).toContain('12,50 €');
      expect(body).toContain(href);
      expect(body).not.toContain(AUTH_EMAIL);
      expect(body).not.toContain('attacker@evil.com');
      expect(body).not.toContain('Mario Rossi');
      expect(body).not.toContain('<script');
      expect(body).not.toContain('<img');
    }
    expect(message.html).toContain(escapeHtml('Margherita <img src=x onerror=alert(1)>').replace('2 × ', ''));
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain(`href="${href}"`);
  });

  it('è idempotente: il secondo invio non parte, e un fallimento rilascia il claim', async () => {
    const first = setup();
    expect((await call(first.handler, post({ orderId: ORDER_ID }))).body).toEqual({ ok: true, sent: true });
    const again = setup({ claimSend: async () => false });
    expect((await call(again.handler, post({ orderId: ORDER_ID }))).body).toEqual({ ok: true, sent: false });
    expect(again.sendEmail).not.toHaveBeenCalled();

    const failed = setup({ sendEmail: async () => ({ ok: false }) });
    expect((await call(failed.handler, post({ orderId: ORDER_ID }))).body).toEqual({ ok: true, sent: false });
    expect(failed.releaseClaim).toHaveBeenCalledWith(ORDER_ID, CUSTOMER);

    const thrown = setup({ sendEmail: async () => { throw new Error('timeout'); } });
    expect((await call(thrown.handler, post({ orderId: ORDER_ID }))).body).toEqual({ ok: true, sent: false });
    expect(thrown.releaseClaim).toHaveBeenCalledWith(ORDER_ID, CUSTOMER);
  });

  it('non invia se l’ordine non è del cliente, è vecchio, o manca l’email Auth', async () => {
    const cases: Partial<SendOrderConfirmationDeps>[] = [
      { getUser: async () => null },
      { getUser: async () => ({ id: CUSTOMER, email: AUTH_EMAIL, is_anonymous: true }) },
      { getUser: async () => ({ id: CUSTOMER, email: null, is_anonymous: false }) },
      { loadOrder: async () => order({ customerId: '22222222-2222-4222-8222-222222222222' }) },
      { loadOrder: async () => null },
      { loadOrder: async () => order({ createdAt: '2026-11-10T09:00:00Z' }) },
    ];
    for (const patch of cases) {
      const { handler, sendEmail, claimSend } = setup(patch);
      expect((await call(handler, post({ orderId: ORDER_ID }))).body.sent).toBe(false);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(claimSend).not.toHaveBeenCalled();
    }
    const { handler, sendEmail } = setup();
    expect((await call(handler, post({ orderId: 'nope' }))).body.sent).toBe(false);
    expect((await call(handler, post('not-json'))).body.sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('il testo della mail non riceve nome, telefono o indirizzo del cliente', () => {
    const message = buildOrderConfirmationEmail(order(), SITE, FROM);
    expect(message?.text).toContain(PAYMENT_LINE);
    expect(message?.html).not.toMatch(/customer_name|delivery_address|customer_phone/);
    const extra = order() as ConfirmationOrder & { customer_name: string; delivery_address: string; customer_phone: string };
    extra.customer_name = 'Mario Rossi';
    extra.delivery_address = 'Via Segreta 9';
    extra.customer_phone = '3331234567';
    const built = buildOrderConfirmationEmail(extra, SITE, FROM)!;
    expect(built.html).not.toContain('Mario Rossi');
    expect(built.html).not.toContain('Via Segreta');
    expect(built.text).not.toContain('3331234567');
    expect(built.html).toContain(ORDER_CONFIRMATION_PHONE);
  });
});
