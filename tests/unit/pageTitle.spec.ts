import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_TITLES, pageTitle } from '../../lib/utils/pageTitle';

describe('pageTitle', () => {
  it('has a real, non-empty title for /menu, /account and /order-tracking', () => {
    expect(pageTitle('menu', 'Pizzeria Ambrosia')).toBe('Menu | Pizzeria Ambrosia');
    expect(pageTitle('account', 'Pizzeria Ambrosia')).toBe('Il tuo account | Pizzeria Ambrosia');
    expect(pageTitle('orderTracking', 'Pizzeria Ambrosia')).toBe('Stato del tuo ordine | Pizzeria Ambrosia');
  });

  it('always includes the brand name and never produces a blank title', () => {
    for (const key of Object.keys(PAGE_TITLES) as (keyof typeof PAGE_TITLES)[]) {
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

describe('screens use the title', () => {
  const root = path.resolve(__dirname, '../..');
  it.each([
    ['app/(tabs)/menu.tsx', 'menu'],
    ['app/(tabs)/account.tsx', 'account'],
    ['app/(tabs)/order-tracking.tsx', 'orderTracking'],
  ])('%s renders <PageTitle page="%s" />', (file, key) => {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    expect(src).toContain(`<PageTitle page="${key}" />`);
  });
});
