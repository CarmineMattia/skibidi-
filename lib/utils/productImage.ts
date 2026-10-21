/**
 * Which image a product shows.
 *
 * Order of precedence:
 *  1. `image_url` pointing to Supabase Storage (`/storage/v1/object/public/…`):
 *     a real photo uploaded on purpose (admin upload, Carmine's photos).
 *  2. The bundled illustrative photo of `lib/data/pizzaPhotos.ts`, only for the
 *     same product id and the same recipe (description).
 *  3. Any other `image_url` (e.g. the Unsplash photos of the drinks).
 *  4. Nothing: the card shows its placeholder icon.
 *
 * Only Storage URLs beat the bundled photo: a stock / legacy seed URL on a pizza
 * (Unsplash, dead links: see PR #15) must not replace the recipe-checked photo.
 * Pure module (no expo-asset), unit-tested in tests/unit/productImage.spec.ts.
 */

export interface BundledPhoto {
  /** recipe the photo was made for (products.description) */
  recipe: string;
  /** resolved asset uri */
  uri: string;
}

export interface ImageFields {
  description?: string | null;
  image_url?: string | null;
  /** DB value of image_url, kept when the bundled photo replaced it (client only) */
  stored_image_url?: string | null;
}

const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';

export const normalizeRecipe = (value: string) => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/** The image_url saved in the DB, also on a product already resolved (idempotent). */
export function getStoredImageUrl(product: ImageFields): string | null {
  const value = product.stored_image_url !== undefined ? product.stored_image_url : product.image_url;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** True for a public Supabase Storage object URL (https, *.supabase.co or the configured project URL). */
export function isStorageImageUrl(url: string | null | undefined, supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (!parsed.pathname.startsWith(STORAGE_PUBLIC_PATH) || parsed.pathname.length <= STORAGE_PUBLIC_PATH.length) return false;
  if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')) return true;
  if (!supabaseUrl) return false;
  try {
    return parsed.origin === new URL(supabaseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Returns the product with the image it should show in `image_url`. When the
 * bundled photo is used, the DB value is kept in `stored_image_url` so that
 * editing the product never writes a bundled asset uri into the DB.
 */
export function resolveProductImage<T extends ImageFields>(
  product: T,
  bundled: BundledPhoto | undefined,
  supabaseUrl?: string
): T & { stored_image_url?: string | null } {
  const stored = getStoredImageUrl(product);
  if (isStorageImageUrl(stored, supabaseUrl)) {
    return { ...product, image_url: stored ?? undefined, stored_image_url: stored } as T;
  }
  if (bundled && normalizeRecipe(product.description || '') === normalizeRecipe(bundled.recipe)) {
    return { ...product, image_url: bundled.uri, stored_image_url: stored } as T;
  }
  if (product.stored_image_url !== undefined) {
    // already resolved once: put the DB value back
    return { ...product, image_url: stored ?? undefined, stored_image_url: stored } as T;
  }
  return product;
}

/** image_url to save from the admin editor: an untouched bundled photo saves the DB value. */
export function imageUrlToPersist(edited: string | null | undefined, product?: ImageFields | null): string | null {
  const value = edited?.trim() ? edited.trim() : null;
  if (product && product.stored_image_url !== undefined && value === (product.image_url?.trim() || null)) {
    return getStoredImageUrl(product);
  }
  return value;
}
