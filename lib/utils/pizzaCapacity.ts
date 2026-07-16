/**
 * Capacità forno per fascia — unità pallina equivalenti.
 *
 * Regole di business:
 * - Pizza normale / piccola = 1
 * - Pizza tirata = 1.5
 * - Mezzo metro = 3
 * - Metro intero = 6 (2 × mezzo metro)
 * - Bevande, contorni, piadine = 0
 */

import { BUILDER_PRODUCT_NAME, BUILDER_SIZES } from '../data/pizzaBuilder';
import type { CartItem } from '../stores/CartContext';

export const CAPACITY_UNITS_NOTE_PREFIX = '[CAPACITY_UNITS:';

export const PIZZA_CAPACITY_WEIGHT = {
  piccola: 1,
  normale: 1,
  media: 1,
  tirata: 1.5,
  mezzo_metro: 3,
  metro: 6,
} as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isPizzaProductName(name: string): boolean {
  const normalized = normalizeText(name);
  if (normalized.includes(BUILDER_PRODUCT_NAME.toLowerCase())) return true;
  if (normalized.includes('pizza')) return true;
  if (normalized.includes('metro')) return true;
  return false;
}

function isNonPizzaProductName(name: string): boolean {
  const normalized = normalizeText(name);
  return (
    normalized.includes('bevand') ||
    normalized.includes('bibita') ||
    normalized.includes('acqua') ||
    normalized.includes('coca') ||
    normalized.includes('birra') ||
    normalized.includes('vino') ||
    normalized.includes('piadina') ||
    normalized.includes('dolce') ||
    normalized.includes('antipast')
  );
}

function weightFromBuilderModifiers(modifiers: string[]): number | null {
  const taglia = modifiers.find((modifier) => modifier.startsWith('Taglia:'));
  if (!taglia) return null;

  const tagliaLabel = normalizeText(taglia.replace('Taglia:', '').trim());
  const matchedSize = BUILDER_SIZES.find((size) => normalizeText(size.label) === tagliaLabel);
  if (matchedSize) return matchedSize.capacityWeight;

  if (tagliaLabel.includes('piccola')) return PIZZA_CAPACITY_WEIGHT.piccola;
  if (tagliaLabel.includes('mezzo metro')) return PIZZA_CAPACITY_WEIGHT.mezzo_metro;
  if (tagliaLabel.includes('media')) return PIZZA_CAPACITY_WEIGHT.media;

  return PIZZA_CAPACITY_WEIGHT.normale;
}

function weightFromProductName(name: string): number {
  const normalized = normalizeText(name);

  if (normalized.includes('tirata')) return PIZZA_CAPACITY_WEIGHT.tirata;
  if (normalized === 'piccola' || normalized.startsWith('piccola ')) return PIZZA_CAPACITY_WEIGHT.piccola;

  if (normalized.includes('mezzo metro') || normalized.includes('meta ')) {
    return PIZZA_CAPACITY_WEIGHT.mezzo_metro;
  }

  if (normalized.includes('al metro')) {
    return PIZZA_CAPACITY_WEIGHT.metro;
  }

  return PIZZA_CAPACITY_WEIGHT.normale;
}

/** Peso pallina di una singola riga carrello (prima della quantità). */
export function getCartItemPizzaWeight(item: CartItem): number {
  const modifiers = item.modifiers ?? [];
  const productName = item.product.name;

  if (isNonPizzaProductName(productName)) return 0;
  // Alcune pizze reali non hanno la parola "pizza" nel nome (es. "Margherita").
  // In quel caso consideriamo il prodotto come pizza standard salvo keyword non-pizza.
  if (!isPizzaProductName(productName) && modifiers.length === 0) {
    return weightFromProductName(productName);
  }

  const builderWeight = weightFromBuilderModifiers(modifiers);
  if (builderWeight !== null) {
    const hasTirata =
      modifiers.some((modifier) => normalizeText(modifier).includes('tirata')) ||
      normalizeText(productName).includes('tirata');
    if (hasTirata) return PIZZA_CAPACITY_WEIGHT.tirata;
    return builderWeight;
  }

  if (modifiers.some((modifier) => normalizeText(modifier).includes('tirata'))) {
    return PIZZA_CAPACITY_WEIGHT.tirata;
  }

  return weightFromProductName(productName);
}

/** Somma unità pallina dell'intero carrello. */
export function sumCartPizzaCapacity(items: CartItem[]): number {
  const total = items.reduce((sum, item) => sum + getCartItemPizzaWeight(item) * item.quantity, 0);
  return Math.round(total * 10) / 10;
}

export function buildCapacityUnitsToken(units: number): string {
  const normalized = Math.round(units * 10) / 10;
  return `${CAPACITY_UNITS_NOTE_PREFIX}${normalized}]`;
}

export function parseCapacityUnitsFromNotes(notes?: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(/\[CAPACITY_UNITS:([^\]]+)\]/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Unità pallina di un ordine già salvato (token in notes, fallback legacy = 1). */
export function getOrderPizzaCapacityUnits(notes?: string | null): number {
  return parseCapacityUnitsFromNotes(notes) ?? 1;
}

export function formatPizzaCapacityLabel(units: number): string {
  const rounded = Math.round(units * 10) / 10;
  if (rounded === 1) return '1 pizza';
  return `${rounded} pizze`;
}
