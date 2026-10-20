/**
 * Widget Cloudflare Turnstile (solo web). Si attiva solo con EXPO_PUBLIC_TURNSTILE_SITE_KEY.
 * Il token va verificato dall'edge function verify-turnstile prima di create_order_with_items.
 */
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { getTurnstileSiteKey } from '@/lib/utils/antiabuse';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript(): Promise<TurnstileApi> {
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => (w.turnstile ? resolve(w.turnstile) : reject(new Error('turnstile missing'))));
    script.addEventListener('error', () => reject(new Error('turnstile load failed')));
  });
}

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = getTurnstileSiteKey();
  const hostRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !siteKey) return;
    let widgetId: string | null = null;
    let cancelled = false;
    loadScript()
      .then((api) => {
        const el = hostRef.current as unknown as HTMLElement | null;
        if (cancelled || !el) return;
        widgetId = api.render(el, {
          sitekey: siteKey,
          language: 'it',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      const w = window as unknown as { turnstile?: TurnstileApi };
      if (widgetId && w.turnstile) w.turnstile.remove(widgetId);
    };
  }, [siteKey, onToken]);

  if (Platform.OS !== 'web' || !siteKey) return null;
  return <View ref={hostRef} testID="turnstile-widget" style={{ minHeight: 65 }} />;
}
