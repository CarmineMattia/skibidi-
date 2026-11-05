/**
 * Browser tab titles of the tab pages. /menu, /account and /order-tracking had an
 * empty title; home keeps its longer SEO title.
 * Pure module (the brand name is passed in, so it is unit-testable without the logo asset).
 * Static strings only: no order id / customer data ends up in the tab title.
 */
export const PAGE_TITLES = {
  menu: 'Menu',
  account: 'Il tuo account',
  orderTracking: 'Stato del tuo ordine',
} as const;

export const HOME_TITLE_SUFFIX = 'Pizza e consegna a Montecchio Emilia';

export type PageTitleKey = keyof typeof PAGE_TITLES | 'home';

export function pageTitle(key: PageTitleKey, brandName: string): string {
  if (key === 'home') return `${brandName} | ${HOME_TITLE_SUFFIX}`;
  return `${PAGE_TITLES[key]} | ${brandName}`;
}

/**
 * Tabs stay mounted: only the focused screen may own the title, otherwise the last
 * mounted one wins (e.g. "Menu | …" stays after going back to Home).
 */
export function titleWhenFocused(key: PageTitleKey, brandName: string, focused: boolean): string | null {
  return focused ? pageTitle(key, brandName) : null;
}
