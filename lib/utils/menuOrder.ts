/**
 * Order and labels of the customer menu list (pure, unit-tested in
 * tests/unit/menuOrder.spec.ts).
 *
 * Products come from the DB sorted only by their own display_order, which mixes
 * the categories (Profiterol, Buna, Margherita al metro, ...), and the categories'
 * own display_order on prod puts Bevande and Dolci first. The menu uses a fixed
 * order instead: Classiche, Bianche, Gustose, Gourmet, Al metro, then Dolci and
 * Bevande last. The default chip is "Pizze" (pizzas only), and the
 * "Scelta dello chef" card shows a product that has a photo.
 */

import { isBeverageCategoryName } from '@/lib/utils/menuCategories';

type CategoryLike = { id: string; name: string; display_order?: number | null };
type ProductLike = {
  category_id: string;
  display_order?: number | null;
  image_url?: string | null;
  description?: string | null;
  ingredients?: string[] | null;
};

export function isDessertCategoryName(categoryName?: string): boolean {
  if (!categoryName) return false;
  const name = categoryName.toLowerCase();
  return name.includes('dolc') || name.includes('dessert');
}

/** Label of the default chip: the pizza categories (no desserts, no drinks). */
export const PIZZE_CHIP_LABEL = 'Pizze';

function isDrinkName(name: string): boolean {
  return (
    isBeverageCategoryName(name) ||
    ['drink', 'bibit', 'cocktail', 'birr'].some((key) => name.includes(key)) ||
    /\bvin[oi]\b/.test(name)
  );
}

/**
 * Position of a category in the customer menu, from its name:
 * 0 Classiche, 1 Bianche, 2 Gustose, 3 Gourmet, 4 other pizzas, 5 Al metro,
 * 6 other food, 7 Dolci, 8 Bevande.
 */
export function menuCategoryRank(categoryName?: string): number {
  const name = categoryName?.trim().toLowerCase() ?? '';
  if (isDrinkName(name)) return 8;
  if (isDessertCategoryName(name)) return 7;
  if (name.includes('metro')) return 5;
  if (name.includes('classic')) return 0;
  if (name.includes('bianc')) return 1;
  if (name.includes('gustos')) return 2;
  if (name.includes('gourmet')) return 3;
  if (name.includes('pizz')) return 4;
  return 6;
}

/** True for the categories shown under the default "Pizze" chip (everything but desserts and drinks). */
export function isDefaultMenuCategory(categoryName?: string): boolean {
  return menuCategoryRank(categoryName) < 7;
}

/** Menu order (see menuCategoryRank), then display_order, then input order. Stable, does not mutate. */
export function sortMenuCategories<T extends CategoryLike>(categories: T[]): T[] {
  return categories
    .map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const ra = menuCategoryRank(a.category.name);
      const rb = menuCategoryRank(b.category.name);
      if (ra !== rb) return ra - rb;
      const da = a.category.display_order ?? Number.MAX_SAFE_INTEGER;
      const db = b.category.display_order ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      return a.index - b.index;
    })
    .map(({ category }) => category);
}

/** Category order of the menu (sortMenuCategories), then the product's display_order. Stable. */
export function sortMenuProducts<T extends ProductLike>(products: T[], categories: CategoryLike[]): T[] {
  const rank = new Map<string, [number, number]>();
  sortMenuCategories(categories).forEach((category, index) => {
    rank.set(category.id, [0, index]);
  });
  const missing: [number, number] = [1, Number.MAX_SAFE_INTEGER];
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const [ga, ca] = rank.get(a.product.category_id) ?? missing;
      const [gb, cb] = rank.get(b.product.category_id) ?? missing;
      if (ga !== gb) return ga - gb;
      if (ca !== cb) return ca - cb;
      const pa = a.product.display_order ?? Number.MAX_SAFE_INTEGER;
      const pb = b.product.display_order ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.index - b.index;
    })
    .map(({ product }) => product);
}

/** First product with a photo, otherwise the first product. */
export function pickFeaturedProduct<T extends ProductLike>(products: T[]): T | undefined {
  return products.find((product) => Boolean(product.image_url?.trim())) ?? products[0];
}

/**
 * Line under the product name: description, else ingredients, else the
 * generic fallback. Drinks get no fallback ("Ricetta artigianale" on a Coca
 * Cola reads wrong): an empty string means "show nothing".
 */
export function getProductSubtitle(product: ProductLike, categoryName: string | undefined, fallback: string): string {
  const description = product.description?.trim();
  if (description) return description;
  const ingredients = (product.ingredients ?? []).map((item) => item.trim()).filter(Boolean);
  if (ingredients.length > 0) return ingredients.join(', ');
  return isBeverageCategoryName(categoryName) ? '' : fallback;
}

/**
 * Pizzas for the home strip: products of the pizza categories (not Al metro,
 * desserts or drinks) that have a photo, in menu order, at most `limit`.
 */
export function pickHomePizzas<T extends ProductLike & { name?: string }>(
  products: T[],
  categories: CategoryLike[],
  limit = 8
): T[] {
  const nameById = new Map(categories.map((category) => [category.id, category.name] as const));
  const eligible = products.filter((product) => {
    const rank = menuCategoryRank(nameById.get(product.category_id));
    return nameById.has(product.category_id) && rank <= 4 && Boolean(product.image_url?.trim());
  });
  return sortMenuProducts(eligible, categories).slice(0, Math.max(0, limit));
}
