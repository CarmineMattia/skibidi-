/**
 * Identità Pizzeria Ambrosia
 *
 * Fonti: https://github.com/CarmineMattia/pizzeria-ambrosia
 *        https://pizzeria-ambrosia.netlify.app/
 */

export const BRAND = {
  name: 'Pizzeria Ambrosia',
  tagline: 'Il Nettare degli Dei',
  description:
    'Pizza artigianale, ingredienti genuini e impasti preparati ogni giorno a Montecchio Emilia.',
  story:
    'Benvenuti da Ambrosia, dove qualità e tradizione vengono prima di tutto. Prepariamo pizze classiche, bianche e al metro con ingredienti freschi, da gustare in pizzeria o a casa.',
  address: 'Via E. Franchini, 51, 42027 Montecchio Emilia (RE)',
  phone: '0522 171 7681',
  phoneHref: 'tel:+3905221717681',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Via%20E.%20Franchini%2051%2C%2042027%20Montecchio%20Emilia%20RE',
  website: 'https://pizzeria-ambrosia.netlify.app',
  deliveryFee: '€2,50',
  /** P.IVA reale da configurare prima dell'uso fiscale in produzione */
  vatNumber: 'P.IVA 00000000000',
  openingHours: 'Mar–Ven 12–14 / 18–22:30 · Sab–Dom 18–22:30 · Lunedì chiuso',
  hours: [
    { day: 'Lunedì', hours: 'Chiuso' },
    { day: 'Martedì', hours: '12–14 · 18–22:30' },
    { day: 'Mercoledì', hours: '12–14 · 18–22:30' },
    { day: 'Giovedì', hours: '12–14 · 18–22:30' },
    { day: 'Venerdì', hours: '12–14 · 18–22:30' },
    { day: 'Sabato', hours: '18–22:30' },
    { day: 'Domenica', hours: '18–22:30' },
  ],
} as const;

/** Logo ovale "Pizzeria Ambrosia — Il nettare degli dei" (rapporto ~1.93:1) */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const BRAND_LOGO = require('@/assets/images/logo-pizzeria-ambrosia.png') as number;
