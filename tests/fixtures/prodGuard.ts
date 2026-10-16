/**
 * Guardia prod per gli e2e (vedi docs/e2e-prod-guard.md).
 *
 * I test che fanno login reali o scritture NON devono mai girare contro il
 * progetto Supabase di produzione. Se il target è prod vengono saltati, a meno
 * di un opt-in esplicito: E2E_ALLOW_PROD=1 (solo con OK di Carmine, mai in CI).
 *
 * Il target è prod se uno qualsiasi di questi segnali lo indica:
 * - un Supabase URL (EXPO_PUBLIC_SUPABASE_URL o SUPABASE_URL, da env, .env o
 *   .env.local) contiene il ref di prod, senza distinzione maiuscole/minuscole;
 * - il Supabase URL è un custom domain di prod (PROD_SUPABASE_HOSTS o
 *   E2E_PROD_SUPABASE_HOSTS, separati da virgola);
 * - la anon key (EXPO_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY) è un JWT
 *   con ref di prod;
 * - PLAYWRIGHT_BASE_URL punta al sito di prod o a una preview Vercel del progetto.
 */
import fs from 'node:fs';
import path from 'node:path';

export const PROD_SUPABASE_REF = 'zqubwvhstobaugifzoyb';
export const PROD_SUPABASE_HOSTS: string[] = [];
export const PROD_SITE_HOSTS = ['skibidi-eight-virid.vercel.app'];
/** Preview Vercel dell'account: <progetto>-<hash|git-branch>-carminemattias-projects.vercel.app */
export const VERCEL_PREVIEW_PATTERNS = [/^[a-z0-9-]+-carminemattias-projects\.vercel\.app$/i];
export const PROD_OPT_IN_ENV = 'E2E_ALLOW_PROD';

const URL_KEYS = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'];
const KEY_KEYS = ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'];
const ENV_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.development',
  '.env.development.local',
];

type Env = Record<string, string | undefined>;

export function parseDotEnv(content: string): Env {
  const out: Env = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export function readEnvFiles(cwd = process.cwd()): Env[] {
  return ENV_FILES.map((f) => {
    try {
      return parseDotEnv(fs.readFileSync(path.resolve(cwd, f), 'utf-8'));
    } catch {
      return {};
    }
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Host normalizzato: percent-decoding, minuscolo, senza punto finale. */
export function hostOf(value: string): string {
  const raw = safeDecode(value.trim());
  let host: string;
  try {
    host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname;
  } catch {
    host = raw.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].replace(/^.*@/, '').replace(/:\d+$/, '');
  }
  return safeDecode(host).toLowerCase().replace(/\.+$/, '');
}

/** Ref Supabase dal payload della anon key (claim "ref"), o null. */
export function refFromJwt(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
    return typeof payload?.ref === 'string' ? payload.ref.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function isVercelPreviewOrProdSite(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  const host = hostOf(baseUrl);
  return PROD_SITE_HOSTS.includes(host) || VERCEL_PREVIEW_PATTERNS.some((re) => re.test(host));
}

/** Logica pura: true se uno dei segnali punta a prod. */
export function detectProd(sources: Env[]): boolean {
  const ref = PROD_SUPABASE_REF.toLowerCase();
  const customHosts = [
    ...PROD_SUPABASE_HOSTS,
    ...sources.flatMap((s) => (s.E2E_PROD_SUPABASE_HOSTS || '').split(',')),
  ]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .map(hostOf);

  for (const s of sources) {
    for (const k of URL_KEYS) {
      const v = s[k];
      if (!v) continue;
      if (v.toLowerCase().includes(ref) || hostOf(v).includes(ref)) return true;
      if (customHosts.includes(hostOf(v))) return true;
    }
    for (const k of KEY_KEYS) {
      if (refFromJwt(s[k]) === ref) return true;
    }
    if (isVercelPreviewOrProdSite(s.PLAYWRIGHT_BASE_URL)) return true;
  }
  return false;
}

export function targetsProd(env: Env = process.env, cwd = process.cwd()): boolean {
  return detectProd([env, ...readEnvFiles(cwd)]);
}

/** Supabase URL effettivo (env, poi i file .env* dal più specifico). */
export function resolvedSupabaseUrl(env: Env = process.env, cwd = process.cwd()): string {
  const files = readEnvFiles(cwd).reverse();
  for (const s of [env, ...files]) {
    for (const k of URL_KEYS) if (s[k]) return s[k] as string;
  }
  return '';
}

export function prodWritesAllowed(env: Env = process.env): boolean {
  return env[PROD_OPT_IN_ENV] === '1';
}

/** true se i test con login reali/scritture devono essere saltati. */
export function mustSkipRealAuth(env: Env = process.env, cwd = process.cwd()): boolean {
  return targetsProd(env, cwd) && !prodWritesAllowed(env);
}

export const PROD_SKIP_REASON = `Target Supabase di produzione: login reali e scritture disattivati (opt-in: ${PROD_OPT_IN_ENV}=1)`;
