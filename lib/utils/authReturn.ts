/**
 * Dopo il login Google l'app torna sulla pagina da cui l'utente è partito.
 * Il redirect OAuth resta `/login` (allowlist esatta di Supabase): il percorso
 * di ritorno vive in sessionStorage e accetta solo il tracking dell'ordine.
 */

import { readJsonStorage, removeStorageKey, writeJsonStorage } from '@/lib/utils/storage';

const STORAGE_KEY = 'ambrosia.authReturn.v1';
const TTL_MS = 30 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_TYPES = new Set(['eat_in', 'take_away', 'delivery']);

/** Checkout routes that already require a signed-in customer. */
export const AUTH_REQUIRED_ROUTES = new Set(['modal', 'one-screen-checkout', 'order-tracking']);

export function authRouteKey(segments: readonly string[]): string | undefined {
  if (segments[0] === '(tabs)') return segments[1];
  return segments[0];
}

/**
 * In-app tracking URL only. Rejects external, protocol-relative and
 * non-uuid targets so the post-login redirect cannot leave the app.
 */
export function safeAuthReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('\n') || value.includes('\r')) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value, 'https://app.local');
  } catch {
    return null;
  }
  if (url.origin !== 'https://app.local' || url.pathname !== '/order-tracking' || url.username || url.password || url.hash) {
    return null;
  }
  const orderId = url.searchParams.get('orderId')?.trim() ?? '';
  if (!UUID_RE.test(orderId)) return null;
  const params = new URLSearchParams();
  params.set('orderId', orderId.toLowerCase());
  const orderType = url.searchParams.get('orderType');
  if (orderType && ORDER_TYPES.has(orderType)) params.set('orderType', orderType);
  return `/order-tracking?${params.toString()}`;
}

/** `/order-tracking?...` or `/login?next=/order-tracking?...`. */
export function returnPathFromLocation(pathnameAndSearch: string | null | undefined): string | null {
  if (!pathnameAndSearch) return null;
  const direct = safeAuthReturnPath(pathnameAndSearch);
  if (direct) return direct;
  const query = pathnameAndSearch.includes('?') ? pathnameAndSearch.slice(pathnameAndSearch.indexOf('?') + 1) : '';
  const next = new URLSearchParams(query).get('next');
  return safeAuthReturnPath(next);
}

export function authReturnFromStored(stored: { path?: unknown; at?: unknown } | null, now = Date.now()): string | null {
  if (!stored || typeof stored.path !== 'string' || typeof stored.at !== 'number') return null;
  if (!Number.isFinite(stored.at) || now - stored.at > TTL_MS || stored.at > now + 60_000) return null;
  return safeAuthReturnPath(stored.path);
}

export function readAuthReturn(now = Date.now()): string | null {
  const stored = readJsonStorage<{ path?: unknown; at?: unknown }>(STORAGE_KEY, 'session');
  const path = authReturnFromStored(stored, now);
  if (stored && !path) clearAuthReturn();
  return path;
}

export function writeAuthReturn(path: string, now = Date.now()): void {
  const safe = safeAuthReturnPath(path);
  if (!safe) return;
  writeJsonStorage(STORAGE_KEY, { path: safe, at: now }, 'session');
}

export function clearAuthReturn(): void {
  removeStorageKey(STORAGE_KEY, 'session');
}

export type AuthRedirect =
  | { action: 'none'; remember: string | null }
  | { action: 'login'; remember: string | null }
  | { action: 'replace'; href: string; clearStored: boolean };

export function resolveAuthRedirect(input: {
  isLoading: boolean;
  isAuthenticated: boolean;
  route: string | undefined;
  location: string | null;
  storedReturn: string | null;
}): AuthRedirect {
  if (input.isLoading) return { action: 'none', remember: null };

  const fromLocation = returnPathFromLocation(input.location);
  const trackingVisit = input.route === 'order-tracking' || (fromLocation != null && input.route !== 'login' && input.location?.startsWith('/order-tracking'));

  if (!input.isAuthenticated && trackingVisit) {
    return { action: 'login', remember: fromLocation };
  }
  if (!input.isAuthenticated && input.route === 'login') {
    return { action: 'none', remember: fromLocation };
  }
  if (!input.isAuthenticated && input.route && AUTH_REQUIRED_ROUTES.has(input.route)) {
    return { action: 'login', remember: null };
  }
  if (input.isAuthenticated && input.route === 'login') {
    const next = safeAuthReturnPath(input.storedReturn);
    return { action: 'replace', href: next ?? '/(tabs)/menu', clearStored: input.storedReturn != null };
  }
  return { action: 'none', remember: null };
}
