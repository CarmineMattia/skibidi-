/**
 * Order and labels of the customer menu list (pure, unit-tested in
 * tests/unit/menuOrder.spec.ts).
 *
 * Products come from the DB sorted only by their own display_order, which mixes
 * the categories (Profiterol, Buna, Margherita al metro, ...). The list follows
 * the category order of the menu instead, with desserts after the pizzas in the
 * default "Solo mangiare" view, and the "Scelta dello chef" card shows a product
 * that has a photo.
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
  return categoryName.toLowerCase().includes('dolc');
}

/** Category order first (desserts last), then the product's display_order. Stable. */
export function sortMenuProducts<T extends ProductLike>(products: T[], categories: CategoryLike[]): T[] {
  const rank = new Map<string, [number, number]>();
  categories.forEach((category, index) => {
    rank.set(category.id, [isDessertCategoryName(category.name) ? 1 : 0, category.display_order ?? index]);
  });
  const missing: [number, number] = [2, Number.MAX_SAFE_INTEGER];
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
