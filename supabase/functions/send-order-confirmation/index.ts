// Edge function: email di conferma dopo create_order_with_items.
// Il client la invoca e ignora l'esito. Senza le env qui sotto non parte
// nessuna chiamata a Resend e l'ordine resta valido.
//
// Secret (li configura Carmine, NON sono nel repo e NON vanno nel client):
//   RESEND_API_KEY     chiave API Resend
//   EMAIL_FROM         mittente verificato, es. "Pizzeria Ambrosia <ordini@dominio>"
//   PUBLIC_SITE_URL    origine dell'app, es. https://skibidi-eight-virid.vercel.app
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (le fornisce Supabase)
//
// Deploy (non eseguito da questa PR):
//   supabase functions deploy send-order-confirmation --project-ref zqubwvhstobaugifzoyb
// Prima va applicata la migration confirmation_email_sent_at (solo con l'OK di Carmine).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { createSendOrderConfirmationHandler, type ConfirmationOrder } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ready = Boolean(url && anonKey && serviceKey);

type ItemRow = {
  quantity?: number | string | null;
  total_price?: number | string | null;
  product?: { name?: string | null } | { name?: string | null }[] | null;
};

function asNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function productName(product: ItemRow['product']): string {
  const row = Array.isArray(product) ? product[0] : product;
  return typeof row?.name === 'string' ? row.name : 'Prodotto';
}

Deno.serve(
  createSendOrderConfirmationHandler({
    resendApiKey: Deno.env.get('RESEND_API_KEY'),
    emailFrom: Deno.env.get('EMAIL_FROM'),
    siteUrl: Deno.env.get('PUBLIC_SITE_URL'),
    getUser: async (authHeader) => {
      if (!ready || !authHeader) return null;
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser();
      const user = data.user;
      if (!user) return null;
      return { id: user.id, email: user.email ?? null, is_anonymous: user.is_anonymous };
    },
    loadOrder: async (orderId) => {
      if (!ready) return null;
      const admin = createClient(url, serviceKey);
      const { data, error } = await admin
        .from('orders')
        .select('id, customer_id, display_code, total_amount, created_at, order_items(quantity, total_price, product:products(name))')
        .eq('id', orderId)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as {
        id?: string;
        customer_id?: string | null;
        display_code?: string | null;
        total_amount?: number | string | null;
        created_at?: string | null;
        order_items?: ItemRow[] | null;
      };
      const total = asNumber(row.total_amount);
      if (!row.id || !row.customer_id || total === null || !row.created_at) return null;
      const order: ConfirmationOrder = {
        id: row.id,
        customerId: row.customer_id,
        displayCode: row.display_code?.trim() || 'Ordine',
        totalAmount: total,
        createdAt: row.created_at,
        items: (row.order_items ?? []).flatMap((item) => {
          const quantity = asNumber(item.quantity);
          const totalPrice = asNumber(item.total_price);
          if (quantity === null || totalPrice === null) return [];
          return [{ name: productName(item.product), quantity, totalPrice }];
        }),
      };
      return order;
    },
    claimSend: async (orderId, customerId) => {
      if (!ready) return false;
      const admin = createClient(url, serviceKey);
      const { data, error } = await admin
        .from('orders')
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('customer_id', customerId)
        .is('confirmation_email_sent_at', null)
        .select('id');
      return !error && Array.isArray(data) && data.length === 1;
    },
    releaseClaim: async (orderId, customerId) => {
      if (!ready) return;
      const admin = createClient(url, serviceKey);
      await admin.from('orders').update({ confirmation_email_sent_at: null }).eq('id', orderId).eq('customer_id', customerId);
    },
    sendEmail: async (message) => {
      const key = Deno.env.get('RESEND_API_KEY')?.trim();
      if (!key) return { ok: false };
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
          signal: AbortSignal.timeout(8000),
        });
        return { ok: res.ok };
      } catch {
        return { ok: false };
      }
    },
  })
);
