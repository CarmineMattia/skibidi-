/**
 * Listino "strutturato" (taglie, mezzo metro, componi la tua pizza, ingredienti
 * aggiunti) condiviso con il server.
 *
 * Fonte unica: tabella `public.menu_pricing` (una riga per pizzeria, colonna
 * `config` jsonb). Il server (create_order_with_items → order_line_unit_price)
 * calcola i prezzi da lì e ignora i prezzi inviati dal client; il client legge
 * la stessa riga all'avvio (MenuPricingProvider → applyMenuPricingConfig) così
 * UI e server mostrano/addebitano lo stesso importo. Le costanti in
 * pizzaBuilder.ts / ingredients.ts restano il default (e il seed della
 * migrazione: un test verifica che coincidano).
 *
 * Il server prezza ogni riga dalle stesse righe "modificatore" che vede la
 * cucina (order_items.notes: "Taglia: …", "+ …", "Gusto 1: …", "Impasto: …",
 * "Base: …"), quindi ciò che si prepara è ciò che si paga.
 */

import type { IngredientCategoryId } from '@/lib/data/ingredients';
import { categorizeIngredient, INGREDIENT_CATALOG } from '@/lib/data/ingredients';
import {
  BUILDER_DOUGHS,
  BUILDER_INGREDIENT_PRICES,
  BUILDER_PRODUCT_NAME,
  BUILDER_SAUCES,
  BUILDER_SIZES,
  buildMezzoMetroModifiers,
  createMezzoMetroGustoFromProduct,
  DEFAULT_MENU_PIZZA_SIZE_ID,
  getMenuPizzaSize,
  getMenuPizzaUnitPrice,
  getMezzoMetroUnitPrice,
  MAX_MEZZO_METRO_GUSTI,
  MENU_PIZZA_SIZES,
} from '@/lib/data/pizzaBuilder';
import type { MenuPizzaSize, MezzoMetroGustoSlot } from '@/lib/data/pizzaBuilder';
import {
  getMaxGustiForProduct,
  isBeverageCategoryName,
  isMetroCategoryName,
  isPizzaCategoryName,
} from '@/lib/utils/menuCategories';

export interface MenuPricingConfig {
  version: 1;
  builderProductName: string;
  maxMezzoMetroGusti: number;
  menuSizes: {
    id: MenuPizzaSize['id'];
    label: string;
    priceDelta: number;
    priceMultiplier: number | null;
    ingredientMultiplier: number;
  }[];
  defaultMenuSize: MenuPizzaSize['id'];
  builderSizes: { id: string; label: string; basePrice: number; ingredientMultiplier: number }[];
  builderDoughs: { id: string; label: string; surcharge: number }[];
  builderSauces: { id: string; label: string; surcharge: number }[];
  defaultBuilderSize: string;
  ingredientCategoryPrices: Record<IngredientCategoryId, number>;
  ingredients: { name: string; category: IngredientCategoryId }[];
}

/** Snapshot of the current client constants (= migration seed). */
export function buildMenuPricingConfig(): MenuPricingConfig {
  return {
    version: 1,
    builderProductName: BUILDER_PRODUCT_NAME,
    maxMezzoMetroGusti: MAX_MEZZO_METRO_GUSTI,
    menuSizes: MENU_PIZZA_SIZES.map((size) => ({
      id: size.id,
      label: size.label,
      priceDelta: size.priceDelta,
      priceMultiplier: size.priceMultiplier ?? null,
      ingredientMultiplier: size.ingredientMultiplier,
    })),
    defaultMenuSize: DEFAULT_MENU_PIZZA_SIZE_ID,
    builderSizes: BUILDER_SIZES.map((size) => ({
      id: size.id,
      label: size.label,
      basePrice: size.basePrice,
      ingredientMultiplier: size.ingredientMultiplier,
    })),
    builderDoughs: BUILDER_DOUGHS.map((dough) => ({ id: dough.id, label: dough.label, surcharge: dough.surcharge })),
    builderSauces: BUILDER_SAUCES.map((sauce) => ({ id: sauce.id, label: sauce.label, surcharge: sauce.surcharge })),
    defaultBuilderSize: BUILDER_SIZES[1].id,
    ingredientCategoryPrices: { ...BUILDER_INGREDIENT_PRICES },
    ingredients: INGREDIENT_CATALOG.map((entry) => ({ name: entry.name, category: entry.category })),
  };
}

const isPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -100 && value <= 1000;

/**
 * Apply the server listino to the client constants (in place, so every screen
 * that reads them shows the server prices). Unknown ids are ignored; returns
 * false (and changes nothing) if the config is malformed.
 */
export function applyMenuPricingConfig(raw: unknown): boolean {
  const config = raw as Partial<MenuPricingConfig> | null;
  if (!config || config.version !== 1) return false;
  const { menuSizes, builderSizes, builderDoughs, builderSauces, ingredientCategoryPrices, ingredients } = config;
  if (
    !Array.isArray(menuSizes) || !Array.isArray(builderSizes) || !Array.isArray(builderDoughs) ||
    !Array.isArray(builderSauces) || !ingredientCategoryPrices || !Array.isArray(ingredients) ||
    !menuSizes.every((s) => s && isPrice(s.priceDelta) && isPrice(s.ingredientMultiplier) &&
      (s.priceMultiplier == null || isPrice(s.priceMultiplier)) && typeof s.label === 'string') ||
    !builderSizes.every((s) => s && isPrice(s.basePrice) && isPrice(s.ingredientMultiplier) && typeof s.label === 'string') ||
    ![...builderDoughs, ...builderSauces].every((o) => o && isPrice(o.surcharge) && typeof o.label === 'string') ||
    !Object.values(ingredientCategoryPrices).every(isPrice)
  ) {
    return false;
  }

  for (const size of menuSizes) {
    const target = MENU_PIZZA_SIZES.find((entry) => entry.id === size.id);
    if (!target) continue;
    target.label = size.label;
    target.priceDelta = size.priceDelta;
    target.ingredientMultiplier = size.ingredientMultiplier;
    if (size.priceMultiplier == null) delete target.priceMultiplier;
    else target.priceMultiplier = size.priceMultiplier;
  }
  for (const size of builderSizes) {
    const target = BUILDER_SIZES.find((entry) => entry.id === size.id);
    if (!target) continue;
    target.label = size.label;
    target.basePrice = size.basePrice;
    target.ingredientMultiplier = size.ingredientMultiplier;
  }
  for (const [list, options] of [[BUILDER_DOUGHS, builderDoughs], [BUILDER_SAUCES, builderSauces]] as const) {
    for (const option of options) {
      const target = list.find((entry) => entry.id === option.id);
      if (!target) continue;
      target.label = option.label;
      target.surcharge = option.surcharge;
    }
  }
  for (const [category, price] of Object.entries(ingredientCategoryPrices)) {
    if (category in BUILDER_INGREDIENT_PRICES) {
      BUILDER_INGREDIENT_PRICES[category as IngredientCategoryId] = price;
    }
  }
  for (const ingredient of ingredients) {
    if (!ingredient || typeof ingredient.name !== 'string' || !(ingredient.category in BUILDER_INGREDIENT_PRICES)) continue;
    const target = INGREDIENT_CATALOG.find((entry) => entry.name === ingredient.name);
    if (target) target.category = ingredient.category;
    else INGREDIENT_CATALOG.push({ name: ingredient.name, category: ingredient.category });
  }
  return true;
}

/** Prezzo di un ingrediente aggiunto (taglia normale). */
export function getExtraIngredientPrice(name: string): number {
  return BUILDER_INGREDIENT_PRICES[categorizeIngredient(name)];
}

export interface MenuItemProduct {
  id: string;
  name: string;
  price: number;
  ingredients?: string[] | null;
}

export interface MenuItemFlags {
  isPizza: boolean;
  isMetro: boolean;
  isStandardMenuPizza: boolean;
  showIngredientTools: boolean;
  maxGusti: number;
}

/** Same rules as the product sheet (and as the server, menu_category_kind). */
export function getMenuItemFlags(product: MenuItemProduct, categoryName?: string): MenuItemFlags {
  const isMetro = isMetroCategoryName(categoryName);
  const isPizza = isPizzaCategoryName(categoryName) || isMetro;
  const isStandardMenuPizza =
    isPizzaCategoryName(categoryName) &&
    !isMetro &&
    product.name !== 'Piccola' &&
    product.name !== BUILDER_PRODUCT_NAME;
  const showIngredientTools =
    !isBeverageCategoryName(categoryName) && (isPizza || (product.ingredients?.length ?? 0) > 0);
  return { isPizza, isMetro, isStandardMenuPizza, showIngredientTools, maxGusti: getMaxGustiForProduct(product.name, categoryName) };
}

export interface MenuItemSelection {
  product: MenuItemProduct;
  categoryName?: string;
  sizeId: MenuPizzaSize['id'];
  extraIngredients: string[];
  mezzoGusti: MezzoMetroGustoSlot[];
  selectedGusti: string[];
  modifications: Record<string, 'no' | 'standard' | 'extra'>;
  cookingLabel?: string | null;
}

function mezzoSlots(selection: MenuItemSelection): MezzoMetroGustoSlot[] {
  return selection.mezzoGusti.length > 0
    ? selection.mezzoGusti
    : [createMezzoMetroGustoFromProduct(selection.product)];
}

/** Prezzo unitario mostrato nella scheda prodotto (e addebitato dal server). */
export function computeMenuItemUnitPrice(selection: MenuItemSelection): number {
  const { isStandardMenuPizza } = getMenuItemFlags(selection.product, selection.categoryName);
  if (isStandardMenuPizza && selection.sizeId === 'mezzo_metro') {
    return getMezzoMetroUnitPrice(mezzoSlots(selection), getExtraIngredientPrice);
  }
  const base = isStandardMenuPizza
    ? getMenuPizzaUnitPrice(selection.product.price, selection.sizeId)
    : selection.product.price;
  return base + selection.extraIngredients.reduce((sum, name) => sum + getExtraIngredientPrice(name), 0);
}

/** Righe modificatore salvate in order_items.notes (cucina + prezzo server). */
export function buildMenuItemModifiers(selection: MenuItemSelection): string[] {
  const { isStandardMenuPizza, maxGusti } = getMenuItemFlags(selection.product, selection.categoryName);
  let modifiers: string[] = [];

  if (isStandardMenuPizza && selection.sizeId === 'mezzo_metro') {
    modifiers = buildMezzoMetroModifiers(mezzoSlots(selection));
  } else {
    if (isStandardMenuPizza) {
      modifiers.push(`Taglia: ${getMenuPizzaSize(selection.sizeId).label}`);
    }
    selection.selectedGusti.forEach((gusto, index) => {
      modifiers.push(maxGusti > 1 ? `Gusto ${index + 1}: ${gusto}` : `Gusto: ${gusto}`);
    });
    Object.entries(selection.modifications).forEach(([ingredient, status]) => {
      if (status === 'no') modifiers.push(`No ${ingredient}`);
      else if (status === 'extra') modifiers.push(`Extra ${ingredient}`);
    });
    selection.extraIngredients.forEach((ingredient) => {
      modifiers.push(`+ ${ingredient}`);
    });
  }

  if (selection.cookingLabel) modifiers.push(`Cottura: ${selection.cookingLabel}`);
  return modifiers;
}
