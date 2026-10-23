/**
 * Salvataggio dall'editor prodotto dell'admin (components/features/EditProductModal.tsx).
 *
 * In modifica si inviano SOLO i campi che l'admin ha cambiato nel form (nome, prezzo, foto,
 * ingredienti). Prima si inviavano sempre `active: true`, `display_order: 0`, categoria e
 * ingredienti: salvare un prodotto disattivato lo riattivava, l'ordine nel menu si azzerava e,
 * se gli ingredienti non erano nel form, venivano cancellati.
 * In creazione un nuovo prodotto parte attivo, in fondo alla sua categoria (display_order 0 come prima).
 */
import { getStoredImageUrl, imageUrlToPersist, type ImageFields } from '@/lib/utils/productImage';

/** Categoria usata dall'editor quando si crea un prodotto senza categoria (comportamento esistente). */
export const DEFAULT_NEW_PRODUCT_CATEGORY_ID = '85316818-56a5-4eed-9066-7a23341db9cb';

export interface ProductEditorForm {
  name: string;
  price: string;
  image: string | null | undefined;
  ingredients: string;
}

export interface EditableProduct extends ImageFields {
  id: string;
  name: string;
  price: number;
  ingredients?: string[] | null;
  category_id?: string | null;
}

export type ProductUpdatePatch = Partial<{
  name: string;
  price: number;
  image_url: string | null;
  ingredients: string[];
}>;

export interface ProductInsertRow {
  name: string;
  price: number;
  image_url: string | null;
  ingredients: string[];
  category_id: string;
  active: true;
  display_order: number;
  company_id: string;
}

export type ProductSavePlan =
  | { kind: 'error'; message: string }
  | { kind: 'noop' }
  | { kind: 'update'; id: string; patch: ProductUpdatePatch }
  | { kind: 'insert'; row: ProductInsertRow };

/** Testo del campo ingredienti come lo mostra l'editor. */
export function ingredientsToText(ingredients: string[] | null | undefined): string {
  return (ingredients ?? []).join(', ');
}

export function parseIngredients(text: string): string[] {
  return text
    .split(',')
    .map((i) => i.trim())
    .filter((i) => i.length > 0);
}

/** "12,50" e "12.50" -> 12.5; null se non è un prezzo valido (>= 0, al massimo 2 decimali). */
export function parsePrice(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function buildProductSave(
  form: ProductEditorForm,
  product: EditableProduct | null | undefined,
  companyId: string
): ProductSavePlan {
  const name = form.name.trim();
  const price = parsePrice(form.price);
  if (!name || form.price.trim() === '') return { kind: 'error', message: 'Nome e prezzo sono obbligatori' };
  if (price === null) return { kind: 'error', message: 'Prezzo non valido (es. 8,50)' };

  const imageUrl = imageUrlToPersist(form.image, product);
  const ingredients = parseIngredients(form.ingredients);

  if (!product) {
    return {
      kind: 'insert',
      row: {
        name,
        price,
        image_url: imageUrl,
        ingredients,
        category_id: DEFAULT_NEW_PRODUCT_CATEGORY_ID,
        active: true,
        display_order: 0,
        company_id: companyId,
      },
    };
  }

  const patch: ProductUpdatePatch = {};
  if (name !== product.name) patch.name = name;
  if (price !== Number(product.price)) patch.price = price;
  if (imageUrl !== getStoredImageUrl(product)) patch.image_url = imageUrl;
  // Ingredienti solo se l'admin ha toccato il campo: il testo iniziale è quello del prodotto.
  if (form.ingredients.trim() !== ingredientsToText(product.ingredients).trim()) {
    const current = product.ingredients ?? [];
    if (!sameList(ingredients, current)) patch.ingredients = ingredients;
  }
  if (Object.keys(patch).length === 0) return { kind: 'noop' };
  return { kind: 'update', id: product.id, patch };
}
