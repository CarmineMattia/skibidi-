/**
 * Identità Pizzeria Ambrosia
 *
 * Fonti: https://github.com/CarmineMattia/pizzeria-ambrosia
 *        https://pizzeria-ambrosia.netlify.app/
 */

export const BRAND = {
  name: 'Pizzeria Ambrosia',
  tagline: 'Il Nettare degli Dei',
  address: 'Via E. Franchini, 51, 42027 Montecchio Emilia (RE)',
  phone: '0522 171 7681',
  website: 'https://pizzeria-ambrosia.netlify.app',
  /** P.IVA reale da configurare prima dell'uso fiscale in produzione */
  vatNumber: 'P.IVA 00000000000',
  openingHours: 'Mar–Ven 12–14 / 18–22:30 · Sab–Dom 18–22:30 · Lunedì chiuso',
} as const;

/** Logo ovale "Pizzeria Ambrosia — Il nettare degli dei" (rapporto ~1.93:1) */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const BRAND_LOGO = require('@/assets/images/logo-pizzeria-ambrosia.png') as number;
