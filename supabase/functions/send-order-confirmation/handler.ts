// Email di conferma ordine (italiano), inviata solo dal server dopo
// create_order_with_items. Nessun segreto qui: index.ts legge le env.
//
// Senza RESEND_API_KEY, EMAIL_FROM o PUBLIC_SITE_URL la function risponde
// 200 e non invia nulla. Un errore del provider non è un errore dell'ordine:
// il client ignora la risposta e il claim viene rilasciato, così un retry
// dello stesso ordine può riprovare. Il claim (confirmation_email_sent_at)
// più la Idempotency-Key di Resend garantiscono una sola email per ordine.
//
// Il destinatario è l'email dell'utente Auth (login Google), mai un campo
// del body. Il corpo contiene numero ordine, righe, totale, pagamento in
// cassa, il link di tracking e il telefono del locale. Niente nome, telefono
// o indirizzo del cliente.

export const RESEND_URL = 'https://api.resend.com/emails';
export const BRAND_NAME = 'Pizzeria Ambrosia';
export const ORDER_CONFIRMATION_PHONE = '0522 171 7681';
export const TRACKING_BUTTON_LABEL = 'Segui il tuo ordine';
export const PAYMENT_LINE = 'Pagamento in cassa';
export const MAX_ORDER_AGE_MS = 24 * 60 * 60 * 1000;
export const FUTURE_SKEW_MS = 5 * 60 * 1000;
export const MAX_BODY_CHARS = 2000;

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConfirmationLine = { name: string; quantity: number; totalPrice: number };

export type ConfirmationOrder = {
  id: string;
  customerId: string;
  displayCode: string;
  totalAmount: number;
  createdAt: string;
  items: ConfirmationLine[];
};

export type OutboundOrderEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type AuthUser = { id: string; email?: string | null; is_anonymous?: boolean };

export type SendOrderConfirmationDeps = {
  resendApiKey?: string;
  emailFrom?: string;
  siteUrl?: string;
  getUser: (authHeader: string | null) => Promise<AuthUser | null>;
  loadOrder: (orderId: string) => Promise<ConfirmationOrder | null>;
  /** true solo se questa chiamata ha scritto confirmation_email_sent_at (era NULL). */
  claimSend: (orderId: string, customerId: string) => Promise<boolean>;
  releaseClaim: (orderId: string, customerId: string) => Promise<void>;
  sendEmail: (message: OutboundOrderEmail) => Promise<{ ok: boolean }>;
  now?: () => Date;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function publicSiteOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1';
  if (url.username || url.password) return null;
  if (url.protocol === 'https:') return url.origin;
  if (url.protocol === 'http:' && local) return url.origin;
  return null;
}

export function safeFromAddress(raw: string | undefined): string | null {
  const from = raw?.trim() ?? '';
  if (!from || from.length > 200 || /[\r\n]/.test(from)) return null;
  return from;
}

export function isSendableEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  const email = value.trim();
  if (email.length > 320 || /[\s\r\n]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function formatEuro(value: number): string {
  const rounded = round2(value);
  const sign = rounded < 0 ? '-' : '';
  const [whole, frac] = Math.abs(rounded).toFixed(2).split('.');
  return `${sign}${whole},${frac} €`;
}

function cleanLine(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function trackingUrl(siteUrl: string | undefined, orderId: string): string | null {
  const origin = publicSiteOrigin(siteUrl);
  if (!origin || !UUID_RE.test(orderId)) return null;
  return `${origin}/order-tracking?orderId=${encodeURIComponent(orderId.toLowerCase())}`;
}

export function buildOrderConfirmationEmail(order: ConfirmationOrder, siteUrl: string | undefined, from: string): OutboundOrderEmail | null {
  const href = trackingUrl(siteUrl, order.id);
  if (!href) return null;
  const code = cleanLine(order.displayCode || 'Ordine', 80) || 'Ordine';
  const lines = order.items
    .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0 && Number.isFinite(line.totalPrice))
    .slice(0, 40)
    .map((line) => ({
      name: cleanLine(line.name, 80) || 'Prodotto',
      quantity: Math.min(99, Math.floor(line.quantity)),
      totalPrice: round2(line.totalPrice),
    }));
  const linesTotal = round2(lines.reduce((sum, line) => sum + line.totalPrice, 0));
  const total = Number.isFinite(order.totalAmount) ? round2(order.totalAmount) : linesTotal;
  const deliveryFee = round2(total - linesTotal);
  const summary = lines.map((line) => `${line.quantity} × ${line.name} — ${formatEuro(line.totalPrice)}`);
  if (deliveryFee >= 0.01) summary.push(`Consegna — ${formatEuro(deliveryFee)}`);

  const text = [
    BRAND_NAME,
    '',
    `Numero ordine: ${escapeHtml(code)}`,
    '',
    'Riepilogo',
    ...(summary.length ? summary.map((line) => escapeHtml(line)) : ['(nessuna riga)']),
    `Totale: ${escapeHtml(formatEuro(total))}`,
    '',
    PAYMENT_LINE,
    '',
    `${TRACKING_BUTTON_LABEL}: ${escapeHtml(href)}`,
    '',
    ORDER_CONFIRMATION_PHONE,
  ].join('\n');

  const rows = summary
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');
  const html = [
    '<!DOCTYPE html>',
    '<html lang="it"><body style="font-family:Georgia,serif;color:#271d19;background:#fff8ee;padding:24px;">',
    `<p style="font-size:20px;font-weight:bold;margin:0 0 12px;">${escapeHtml(BRAND_NAME)}</p>`,
    `<p style="margin:0 0 12px;">Numero ordine: ${escapeHtml(code)}</p>`,
    '<p style="margin:0 0 8px;font-weight:bold;">Riepilogo</p>',
    `<ul style="margin:0 0 12px;padding-left:18px;">${rows || '<li>(nessuna riga)</li>'}</ul>`,
    `<p style="margin:0 0 12px;">Totale: ${escapeHtml(formatEuro(total))}</p>`,
    `<p style="margin:0 0 16px;">${escapeHtml(PAYMENT_LINE)}</p>`,
    `<p style="margin:0 0 16px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#8d171e;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">${escapeHtml(TRACKING_BUTTON_LABEL)}</a></p>`,
    `<p style="margin:0;color:#65554c;">${escapeHtml(ORDER_CONFIRMATION_PHONE)}</p>`,
    '</body></html>',
  ].join('');

  const subjectCode = code.replace(/[^\p{L}\p{N} #\-]/gu, '').trim().slice(0, 40) || 'conferma ordine';
  return {
    from,
    to: '',
    subject: `${BRAND_NAME} — ${subjectCode}`,
    html,
    text,
    idempotencyKey: `order-confirmation:${order.id.toLowerCase()}`,
  };
}

const json = (status: number, body: { ok: true; sent: boolean }) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const skipped = () => json(200, { ok: true, sent: false });

function configured(deps: SendOrderConfirmationDeps): { from: string; siteUrl: string } | null {
  if (!deps.resendApiKey?.trim()) return null;
  const from = safeFromAddress(deps.emailFrom);
  const siteUrl = publicSiteOrigin(deps.siteUrl);
  if (!from || !siteUrl) return null;
  return { from, siteUrl };
}

function orderIsRecent(createdAt: string, now: Date): boolean {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  const age = now.getTime() - created;
  return age <= MAX_ORDER_AGE_MS && age >= -FUTURE_SKEW_MS;
}

export function createSendOrderConfirmationHandler(deps: SendOrderConfirmationDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (req.method !== 'POST') return new Response(JSON.stringify({ ok: true, sent: false }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const settings = configured(deps);
    if (!settings) return skipped();

    try {
      const raw = await req.text();
      if (raw.length > MAX_BODY_CHARS) return skipped();
      let orderId = '';
      try {
        const body = JSON.parse(raw) as { orderId?: unknown };
        orderId = typeof body.orderId === 'string' ? body.orderId.trim().toLowerCase() : '';
      } catch {
        return skipped();
      }
      if (!UUID_RE.test(orderId)) return skipped();

      const user = await deps.getUser(req.headers.get('Authorization')).catch(() => null);
      if (!user || user.is_anonymous || !isSendableEmail(user.email)) return skipped();

      const order = await deps.loadOrder(orderId).catch(() => null);
      if (!order || order.id.toLowerCase() !== orderId || order.customerId !== user.id) return skipped();
      if (!orderIsRecent(order.createdAt, deps.now?.() ?? new Date())) return skipped();

      const message = buildOrderConfirmationEmail(order, settings.siteUrl, settings.from);
      if (!message) return skipped();
      message.to = user.email.trim();

      const claimed = await deps.claimSend(order.id, user.id);
      if (!claimed) return skipped();
      try {
        const sent = await deps.sendEmail(message);
        if (!sent.ok) {
          await deps.releaseClaim(order.id, user.id).catch(() => undefined);
          return skipped();
        }
      } catch {
        await deps.releaseClaim(order.id, user.id).catch(() => undefined);
        return skipped();
      }
      return json(200, { ok: true, sent: true });
    } catch {
      return skipped();
    }
  };
}
