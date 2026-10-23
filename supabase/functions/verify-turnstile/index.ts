// Edge function: verifica un token Cloudflare Turnstile e lascia un "pass" monouso (5 min)
// per l'utente loggato in public.order_captcha_passes. create_order_with_items lo consuma
// solo se companies.require_turnstile = true. Logica in ./handler.ts (testata con mock).
//
// Secret (li configura Carmine, NON sono nel repo):
//   TURNSTILE_SECRET_KEY        obbligatoria (Cloudflare → Turnstile → widget → Secret key)
//   TURNSTILE_ALLOWED_HOSTNAMES facoltativa, es. "skibidi-eight-virid.vercel.app,localhost"
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (forniti da Supabase alle edge function)
// Deploy: supabase functions deploy verify-turnstile --project-ref zqubwvhstobaugifzoyb
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { createVerifyTurnstileHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const configured = Boolean(url && anonKey && serviceKey);

Deno.serve(
  createVerifyTurnstileHandler({
    secret: configured ? Deno.env.get('TURNSTILE_SECRET_KEY') : undefined,
    allowedHostnames: Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES'),
    getUser: async (authHeader) => {
      if (!authHeader) return null;
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser();
      return data.user ? { id: data.user.id, is_anonymous: data.user.is_anonymous } : null;
    },
    savePass: async (userId, verifiedAt, expiresAt) => {
      const admin = createClient(url, serviceKey);
      const { error } = await admin.from('order_captcha_passes').upsert({
        user_id: userId,
        verified_at: verifiedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
      return { error };
    },
    fetch: (input, init) => fetch(input, init),
  })
);
