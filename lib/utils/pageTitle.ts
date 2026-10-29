/**
 * Titles of the tab pages that did not have one (the browser tab was empty on
 * /menu, /account and /order-tracking). Home keeps its own, longer SEO title.
 * Pure module (the brand name is passed in, so it is unit-testable without the logo asset).
 * Static strings only: no order id / customer data ends up in the tab title.
 */
export const PAGE_TITLES = {
  menu: 'Menu',
  account: 'Il tuo account',
  orderTracking: 'Stato del tuo ordine',
} as const;

export type PageTitleKey = keyof typeof PAGE_TITLES;

export function pageTitle(key: PageTitleKey, brandName: string): string {
  return `${PAGE_TITLES[key]} | ${brandName}`;
}
