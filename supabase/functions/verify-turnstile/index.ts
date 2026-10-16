// Edge function: verifica un token Cloudflare Turnstile e lascia un "pass" monouso (5 min)
// per l'utente loggato in public.order_captcha_passes. create_order_with_items lo consuma
// solo se companies.require_turnstile = true.
//
// Secret richiesti (li configura Carmine, NON sono nel repo):
//   TURNSTILE_SECRET_KEY        (Cloudflare → Turnstile → widget → Secret key)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (forniti da Supabase alle edge function)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !anonKey || !serviceKey) return json(503, { error: 'turnstile_not_configured' });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || user.is_anonymous) return json(401, { error: 'login_required' });

  let token = '';
  try {
    token = String((await req.json())?.token ?? '');
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  if (!token || token.length > 2048) return json(400, { error: 'missing_token' });

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) form.append('remoteip', ip);
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const outcome = await verify.json().catch(() => ({ success: false }));
  if (!outcome?.success) return json(403, { error: 'turnstile_failed' });

  const admin = createClient(url, serviceKey);
  const { error } = await admin.from('order_captcha_passes').upsert({
    user_id: user.id,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  if (error) return json(500, { error: 'pass_not_saved' });
  return json(200, { ok: true });
});
