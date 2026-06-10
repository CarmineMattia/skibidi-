/**
 * Configurazione "Componi la tua pizza" — Pizzeria Ambrosia
 *
 * Prezzi base e supplementi del builder. Valori di listino indicativi,
 * modificabili dal gestore in questo file (in futuro: tabella dedicata).
 * La base include sempre la mozzarella; la salsa si sceglie a parte.
 */

import type { IngredientCategoryId } from '@/lib/data/ingredients';

export interface BuilderOption {
  id: string;
  label: string;
  description?: string;
  /** Supplemento in euro rispetto alla base */
  surcharge: number;
}

export interface BuilderSize extends BuilderOption {
  /** Prezzo base in euro (impasto normale, salsa inclusa, mozzarella) */
  basePrice: number;
  /** Moltiplicatore prezzo degli ingredienti extra per questa taglia */
  ingredientMultiplier: number;
}

export const BUILDER_SIZES: BuilderSize[] = [
  { id: 'piccola', label: 'Piccola', description: 'Formato ridotto', basePrice: 4.0, surcharge: 0, ingredientMultiplier: 1 },
  { id: 'media', label: 'Media', description: 'Formato classico', basePrice: 5.0, surcharge: 0, ingredientMultiplier: 1 },
  { id: 'mezzo_metro', label: 'Mezzo metro', description: 'Da condividere (2-3 persone)', basePrice: 9.0, surcharge: 0, ingredientMultiplier: 2 },
];

export const BUILDER_DOUGHS: BuilderOption[] = [
  { id: 'normale', label: 'Normale', surcharge: 0 },
  { id: 'doppia_pasta', label: 'Doppia pasta', description: 'Impasto doppio, più alta', surcharge: 2.0 },
  { id: 'integrale', label: 'Integrale', description: 'Farina integrale', surcharge: 1.5 },
  { id: 'gluten_free', label: 'Gluten free', description: 'Senza glutine', surcharge: 2.0 },
];

export const BUILDER_SAUCES: BuilderOption[] = [
  { id: 'pomodoro', label: 'Pomodoro', description: 'Base rossa classica', surcharge: 0 },
  { id: 'doppio_pomodoro', label: 'Doppio pomodoro', description: 'Extra salsa', surcharge: 0.5 },
  { id: 'bianca', label: 'Bianca', description: 'Senza pomodoro', surcharge: 0 },
];

/** Prezzo per ingrediente aggiunto, per categoria (taglia media) */
export const BUILDER_INGREDIENT_PRICES: Record<IngredientCategoryId, number> = {
  salse: 1.0,
  formaggi: 1.5,
  salumi: 1.5,
  verdure: 1.0,
  pesce: 2.0,
  extra: 0.5,
};

/** Nome del prodotto a menu che apre il builder */
export const BUILDER_PRODUCT_NAME = 'Componi la tua pizza';

export interface BuilderSelection {
  sizeId: string;
  doughId: string;
  sauceId: string;
  /** Nomi ingredienti scelti dal catalogo */
  ingredients: { name: string; category: IngredientCategoryId }[];
}

export interface BuilderPriceBreakdown {
  base: number;
  dough: number;
  sauce: number;
  ingredients: number;
  total: number;
}

export function getBuilderSize(sizeId: string): BuilderSize {
  return BUILDER_SIZES.find((size) => size.id === sizeId) ?? BUILDER_SIZES[1];
}

export function getBuilderDough(doughId: string): BuilderOption {
  return BUILDER_DOUGHS.find((dough) => dough.id === doughId) ?? BUILDER_DOUGHS[0];
}

export function getBuilderSauce(sauceId: string): BuilderOption {
  return BUILDER_SAUCES.find((sauce) => sauce.id === sauceId) ?? BUILDER_SAUCES[0];
}

/** Calcola il prezzo della pizza composta, con dettaglio per voce. */
export function calculateBuilderPrice(selection: BuilderSelection): BuilderPriceBreakdown {
  const size = getBuilderSize(selection.sizeId);
  const dough = getBuilderDough(selection.doughId);
  const sauce = getBuilderSauce(selection.sauceId);

  const ingredientsTotal = selection.ingredients.reduce(
    (sum, ingredient) =>
      sum + BUILDER_INGREDIENT_PRICES[ingredient.category] * size.ingredientMultiplier,
    0
  );

  const base = size.basePrice;
  const total = base + dough.surcharge + sauce.surcharge + ingredientsTotal;

  return {
    base,
    dough: dough.surcharge,
    sauce: sauce.surcharge,
    ingredients: ingredientsTotal,
    total: Math.round(total * 100) / 100,
  };
}

/** Descrizione leggibile della composizione per cucina/carrello. */
export function buildSelectionModifiers(selection: BuilderSelection): string[] {
  const size = getBuilderSize(selection.sizeId);
  const dough = getBuilderDough(selection.doughId);
  const sauce = getBuilderSauce(selection.sauceId);

  const modifiers: string[] = [
    `Taglia: ${size.label}`,
    `Impasto: ${dough.label}`,
    `Base: ${sauce.label}`,
  ];

  selection.ingredients.forEach((ingredient) => {
    modifiers.push(`+ ${ingredient.name}`);
  });

  return modifiers;
}
