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
  /** Peso in unità pallina per la capacità forno per fascia */
  capacityWeight: number;
}

export const BUILDER_SIZES: BuilderSize[] = [
  { id: 'piccola', label: 'Piccola', description: 'Formato ridotto', basePrice: 4.0, surcharge: 0, ingredientMultiplier: 1, capacityWeight: 1 },
  { id: 'media', label: 'Media', description: 'Formato classico', basePrice: 5.0, surcharge: 0, ingredientMultiplier: 1, capacityWeight: 1 },
  { id: 'mezzo_metro', label: 'Mezzo metro', description: 'Da condividere (2-3 persone)', basePrice: 9.0, surcharge: 0, ingredientMultiplier: 2, capacityWeight: 3 },
];

/**
 * Formati disponibili sulle pizze del menu (non sul builder libero).
 * - Normale: prezzo di listino
 * - Piccola: −1€ (come da listino Ambrosia)
 * - Tirata: stesso prezzo, peso forno 1,5
 * - Mezzo metro: ~2× listino, peso forno 3, fino a 3 gusti
 */
export interface MenuPizzaSize {
  id: 'normale' | 'piccola' | 'tirata' | 'mezzo_metro';
  label: string;
  description: string;
  /** Differenza rispetto al prezzo prodotto di listino (ignorato se priceMultiplier) */
  priceDelta: number;
  /** Se presente, prezzo = listino × moltiplicatore */
  priceMultiplier?: number;
  /** Moltiplicatore prezzo ingredienti extra */
  ingredientMultiplier: number;
  capacityWeight: number;
}

export const MENU_PIZZA_SIZES: MenuPizzaSize[] = [
  {
    id: 'normale',
    label: 'Normale',
    description: 'Formato classico di listino',
    priceDelta: 0,
    ingredientMultiplier: 1,
    capacityWeight: 1,
  },
  {
    id: 'piccola',
    label: 'Piccola',
    description: 'Formato ridotto (−1€)',
    priceDelta: -1,
    ingredientMultiplier: 1,
    capacityWeight: 1,
  },
  {
    id: 'tirata',
    label: 'Tirata',
    description: 'Impasto tirato sottile (più spazio in forno)',
    priceDelta: 0,
    ingredientMultiplier: 1,
    capacityWeight: 1.5,
  },
  {
    id: 'mezzo_metro',
    label: 'Mezzo metro',
    description: 'Da condividere · fino a 3 gusti personalizzabili',
    priceDelta: 0,
    priceMultiplier: 2,
    ingredientMultiplier: 2,
    capacityWeight: 3,
  },
];

export const DEFAULT_MENU_PIZZA_SIZE_ID: MenuPizzaSize['id'] = 'normale';
export const MAX_MEZZO_METRO_GUSTI = 3;

export function getMenuPizzaSize(sizeId: string): MenuPizzaSize {
  return MENU_PIZZA_SIZES.find((size) => size.id === sizeId) ?? MENU_PIZZA_SIZES[0];
}

/** Modifiers di default per aggiunta rapida (+ sul menu). */
export function getQuickAddPizzaModifiers(): string[] {
  const size = getMenuPizzaSize(DEFAULT_MENU_PIZZA_SIZE_ID);
  return [`Taglia: ${size.label}`];
}

export function getMenuPizzaUnitPrice(listPrice: number, sizeId: string): number {
  const size = getMenuPizzaSize(sizeId);
  if (size.priceMultiplier && size.priceMultiplier !== 1) {
    return Math.max(0, Math.round(listPrice * size.priceMultiplier * 100) / 100);
  }
  return Math.max(0, Math.round((listPrice + size.priceDelta) * 100) / 100);
}

export interface MezzoMetroGustoSlot {
  id: string;
  productId: string;
  productName: string;
  listPrice: number;
  baseIngredients: string[];
  modifications: Record<string, 'no' | 'standard' | 'extra'>;
  extraIngredients: string[];
}

export function createMezzoMetroGustoFromProduct(
  product: { id: string; name: string; price: number; ingredients?: string[] | null },
  slotId?: string
): MezzoMetroGustoSlot {
  return {
    id: slotId ?? `${product.id}-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    listPrice: product.price,
    baseIngredients: product.ingredients ?? [],
    modifications: {},
    extraIngredients: [],
  };
}

/** Prezzo unità mezzo metro: 2× il gusto più caro + extra (× ingredientMultiplier). */
export function getMezzoMetroUnitPrice(
  gusti: MezzoMetroGustoSlot[],
  ingredientPriceFor: (name: string) => number
): number {
  const size = getMenuPizzaSize('mezzo_metro');
  const referenceList =
    gusti.length > 0 ? Math.max(...gusti.map((gusto) => gusto.listPrice)) : 0;
  const base = getMenuPizzaUnitPrice(referenceList, 'mezzo_metro');
  const extras = gusti.reduce((sum, gusto) => {
    const slotExtras = gusto.extraIngredients.reduce(
      (slotSum, name) => slotSum + ingredientPriceFor(name) * size.ingredientMultiplier,
      0
    );
    return sum + slotExtras;
  }, 0);
  return Math.round((base + extras) * 100) / 100;
}

/** Modifiers cucina/carrello per mezzo metro multi-gusto. */
export function buildMezzoMetroModifiers(gusti: MezzoMetroGustoSlot[]): string[] {
  const modifiers: string[] = ['Taglia: Mezzo metro'];
  const multi = gusti.length > 1;

  gusti.forEach((gusto, index) => {
    const prefix = multi ? `Gusto ${index + 1}` : 'Gusto';
    modifiers.push(`${prefix}: ${gusto.productName}`);

    Object.entries(gusto.modifications).forEach(([ingredient, status]) => {
      if (status === 'no') modifiers.push(`${prefix}: No ${ingredient}`);
      if (status === 'extra') modifiers.push(`${prefix}: Extra ${ingredient}`);
    });

    gusto.extraIngredients.forEach((ingredient) => {
      modifiers.push(`${prefix}: + ${ingredient}`);
    });
  });

  return modifiers;
}

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
