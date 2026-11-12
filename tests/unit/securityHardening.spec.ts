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

describe('migration sul progetto ospitato', () => {
  const storageAlter = /ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?storage\./i;
  const unsafeStorageDrop = /DROP\s+POLICY\s+(?!IF\s+EXISTS)[^;]*\bON\s+storage\./i;
  const managedAlter = /ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?(auth|realtime)\./i;

  it('nessun file in supabase/migrations contiene ALTER TABLE storage.', () => {
    const dir = path.join(root, 'supabase/migrations');
    for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.sql'))) {
      const sql = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(sql, name).not.toMatch(storageAlter);
    }
  });

  it('le tre migration di #57 non richiedono il proprietario di storage, auth o realtime', () => {
    const files = [
      'supabase/migrations/20261111234500_security_hardening.sql',
      'supabase/migrations/20261112003000_company_storage_and_orders_anon.sql',
      'supabase/migrations/20261112010000_order_item_price_and_company.sql',
    ];
    for (const rel of files) {
      const sql = read(rel);
      expect(sql, rel).not.toMatch(storageAlter);
      expect(sql, rel).not.toMatch(managedAlter);
      expect(sql, rel).not.toMatch(/FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(sql, rel).not.toMatch(unsafeStorageDrop);
    }
    const first = read(files[0]);
    expect(first).toContain('relrowsecurity');
    expect(first).toContain('RAISE WARNING');
    expect(first).toContain('DROP POLICY IF EXISTS %I ON storage.objects');
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
