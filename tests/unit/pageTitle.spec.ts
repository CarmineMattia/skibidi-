import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_TITLES, pageTitle, titleWhenFocused } from '../../lib/utils/pageTitle';

describe('pageTitle', () => {
  it('has a real, non-empty title for /menu, /account and /order-tracking', () => {
    expect(pageTitle('menu', 'Pizzeria Ambrosia')).toBe('Menu | Pizzeria Ambrosia');
    expect(pageTitle('account', 'Pizzeria Ambrosia')).toBe('Il tuo account | Pizzeria Ambrosia');
    expect(pageTitle('orderTracking', 'Pizzeria Ambrosia')).toBe('Stato del tuo ordine | Pizzeria Ambrosia');
  });

  it('always includes the brand name and never produces a blank title', () => {
    for (const key of [...Object.keys(PAGE_TITLES), 'home'] as Parameters<typeof pageTitle>[0][]) {
      const title = pageTitle(key, 'Pizzeria Ambrosia');
      expect(title.trim().length).toBeGreaterThan(0);
      expect(title).toContain('Pizzeria Ambrosia');
      expect(title.startsWith(' ')).toBe(false);
    }
  });

  it('titles are distinct, so each tab is told apart in the browser history', () => {
    const all = Object.keys(PAGE_TITLES).map((k) => pageTitle(k as keyof typeof PAGE_TITLES, 'Pizzeria Ambrosia'));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('title follows the focused tab', () => {
  it('home has its own SEO title', () => {
    expect(pageTitle('home', 'Pizzeria Ambrosia')).toBe('Pizzeria Ambrosia | Pizza e consegna a Montecchio Emilia');
  });

  it('an unfocused (still mounted) tab does not own the title', () => {
    expect(titleWhenFocused('menu', 'Pizzeria Ambrosia', false)).toBeNull();
    expect(titleWhenFocused('menu', 'Pizzeria Ambrosia', true)).toBe('Menu | Pizzeria Ambrosia');
  });

  it('home -> menu -> home: the visible title is the focused one', () => {
    const tabs = ['home', 'menu', 'account'] as const;
    const visible = (focused: (typeof tabs)[number]) =>
      tabs.map((t) => titleWhenFocused(t, 'Pizzeria Ambrosia', t === focused)).filter(Boolean);
    expect(visible('menu')).toEqual(['Menu | Pizzeria Ambrosia']);
    expect(visible('home')).toEqual(['Pizzeria Ambrosia | Pizza e consegna a Montecchio Emilia']);
    expect(visible('account')).toEqual(['Il tuo account | Pizzeria Ambrosia']);
  });

  it('PageTitle is gated on focus (useIsFocused / useFocusEffect)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../components/ui/PageTitle.tsx'), 'utf8');
    expect(src).toContain('useIsFocused');
    expect(src).toContain('useFocusEffect');
  });
});

describe('screens use the title', () => {
  const root = path.resolve(__dirname, '../..');
  it.each([
    ['app/(tabs)/menu.tsx', 'menu'],
    ['app/(tabs)/account.tsx', 'account'],
    ['app/(tabs)/order-tracking.tsx', 'orderTracking'],
    ['app/(tabs)/index.tsx', 'home'],
    ['app/commission-summary.tsx', 'commission'],
    ['app/customer-insights.tsx', 'insights'],
  ])('%s renders <PageTitle page="%s" />', (file, key) => {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    expect(src).toContain(`<PageTitle page="${key}" />`);
  });
});
