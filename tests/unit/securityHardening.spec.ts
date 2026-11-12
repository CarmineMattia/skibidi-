import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('security headers', () => {
  it('vercel.json nega il framing su ogni route e lascia la geolocalizzazione al sito', () => {
    const config = JSON.parse(read('vercel.json')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const headers = config.headers
      .filter((group) => group.source === '/(.*)')
      .flatMap((group) => group.headers);
    const map = Object.fromEntries(headers.map((header) => [header.key, header.value]));
    expect(map['X-Frame-Options']).toBe('DENY');
    expect(map['Content-Security-Policy']).toBe("frame-ancestors 'none'");
    expect(map['X-Content-Type-Options']).toBe('nosniff');
    expect(map['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(map['Permissions-Policy']).toContain('geolocation=(self)');
    expect(map['Content-Security-Policy']).not.toMatch(/script-src|default-src/);
  });
});

describe('prototipo assistente', () => {
  it('non esce dal barrel dei hook', () => {
    expect(read('lib/hooks/index.ts')).not.toMatch(/export \* from '\.\/useOrderAssistantChat'/);
  });

  it('entra nel bundle solo col flag di sviluppo', () => {
    const metro = read('metro.config.js');
    expect(metro).toContain('EXPO_PUBLIC_ENABLE_ORDER_ASSISTANT');
    expect(metro).toContain('orderAssistantStub');
    expect(metro).toContain("NODE_ENV !== 'production'");
    const gate = read('components/features/chat/OrderAssistantChat.tsx');
    expect(gate).toContain('__DEV__');
    expect(gate).toContain('EXPO_PUBLIC_ENABLE_ORDER_ASSISTANT');
  });
});

describe('checkout', () => {
  it('passa dal RPC che prezza le righe e rifiuta gli anonimi', () => {
    const hook = read('lib/hooks/useCreateOrder.ts');
    expect(hook).toContain("rpc('create_order_with_items'");
    expect(hook).not.toMatch(/from\('orders'\)\s*\.insert/);
    expect(hook).not.toMatch(/from\('order_items'\)\s*\.insert/);
    const rpc = read('supabase/migrations/20261022100000_order_notes_menu_hardening.sql');
    expect(rpc).toContain('order_line_priced');
    expect(rpc).toContain('is_anonymous');
    const followUp = read('supabase/migrations/20261112003000_company_storage_and_orders_anon.sql');
    expect(followUp).not.toMatch(/FUNCTION public\.create_order_with_items/);
  });
});

describe('ruolo del profilo', () => {
  it('il client non scrive profiles.role', () => {
    const src = read('lib/stores/AuthContext.tsx');
    expect(src).not.toMatch(/setUserRole:/);
    expect(src).not.toMatch(/\.update\(\s*\{[^}]*role/);
    expect(src).not.toMatch(/role:\s*'customer'/);
  });
});
