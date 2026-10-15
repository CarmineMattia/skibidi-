/**
 * Guardia prod per gli e2e.
 *
 * I test che fanno login reali (admin@skibidi.com, customer@skibidi.com) o
 * scritture via API NON devono mai girare contro il progetto Supabase di
 * produzione. Se il target è prod vengono saltati, a meno di un opt-in esplicito:
 *
 *   E2E_ALLOW_PROD=1   (solo con OK di Carmine, mai in CI)
 *
 * Il target è considerato prod se EXPO_PUBLIC_SUPABASE_URL (env o .env)
 * contiene il ref di prod, oppure se PLAYWRIGHT_BASE_URL punta al sito di prod.
 */
import fs from 'node:fs';
import path from 'node:path';

export const PROD_SUPABASE_REF = 'zqubwvhstobaugifzoyb';
export const PROD_SITE_HOSTS = ['skibidi-eight-virid.vercel.app'];
export const PROD_OPT_IN_ENV = 'E2E_ALLOW_PROD';

function supabaseUrlFromDotEnv(): string | undefined {
  try {
    const env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
    return env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export function resolvedSupabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL || supabaseUrlFromDotEnv() || '';
}

export function targetsProd(): boolean {
  const url = resolvedSupabaseUrl();
  const base = process.env.PLAYWRIGHT_BASE_URL || '';
  return url.includes(PROD_SUPABASE_REF) || PROD_SITE_HOSTS.some((h) => base.includes(h));
}

export function prodWritesAllowed(): boolean {
  return process.env[PROD_OPT_IN_ENV] === '1';
}

/** true se i test con login reali/scritture devono essere saltati. */
export function mustSkipRealAuth(): boolean {
  return targetsProd() && !prodWritesAllowed();
}

export const PROD_SKIP_REASON = `Target Supabase di produzione: login reali e scritture disattivati (opt-in: ${PROD_OPT_IN_ENV}=1)`;
