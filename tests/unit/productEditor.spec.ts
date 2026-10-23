import { describe, expect, test } from 'vitest';
import {
  buildProductSave,
  DEFAULT_NEW_PRODUCT_CATEGORY_ID,
  ingredientsToText,
  parseIngredients,
  parsePrice,
  type EditableProduct,
} from '../../lib/utils/productEditor';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const STORAGE = 'https://zqubwvhstobaugifzoyb.supabase.co/storage/v1/object/public/products/ambrosia/margherita.jpg';

// Prodotto come arriva all'editor da useProducts (select('*')): disattivato, in posizione 7.
const inactive: EditableProduct & { active: boolean; display_order: number } = {
  id: 'p1',
  name: 'Diavola',
  price: 8.5,
  image_url: STORAGE,
  ingredients: ['pomodoro', 'mozzarella', 'salame piccante'],
  category_id: 'cat-rosse',
  active: false,
  display_order: 7,
};

const formOf = (p: EditableProduct) => ({
  name: p.name,
  price: String(p.price),
  image: p.image_url,
  ingredients: ingredientsToText(p.ingredients),
});

describe('editor prodotto admin: salvataggio in modifica', () => {
  test('cambiare solo il prezzo invia solo il prezzo (niente active, display_order, ingredienti)', () => {
    const plan = buildProductSave({ ...formOf(inactive), price: '9,00' }, inactive, COMPANY);
    expect(plan).toEqual({ kind: 'update', id: 'p1', patch: { price: 9 } });
    if (plan.kind !== 'update') throw new Error();
    for (const key of ['active', 'display_order', 'ingredients', 'category_id', 'company_id', 'image_url', 'name']) {
      expect(plan.patch).not.toHaveProperty(key);
    }
  });

  test('un prodotto disattivato salvato senza cambiamenti non viene toccato', () => {
    expect(buildProductSave(formOf(inactive), inactive, COMPANY)).toEqual({ kind: 'noop' });
  });

  test('ingredienti: inviati solo se l\'admin li cambia, e preservati se il prodotto non li ha nel form', () => {
    const changed = buildProductSave({ ...formOf(inactive), ingredients: 'pomodoro, mozzarella, salame piccante, olive' }, inactive, COMPANY);
    expect(changed).toEqual({ kind: 'update', id: 'p1', patch: { ingredients: ['pomodoro', 'mozzarella', 'salame piccante', 'olive'] } });
    // Solo spazi diversi: nessun cambiamento.
    expect(buildProductSave({ ...formOf(inactive), ingredients: 'pomodoro,mozzarella ,  salame piccante ' }, inactive, COMPANY)).toEqual({ kind: 'noop' });
    // Prodotto senza ingredienti caricati: rinominarlo non svuota nulla.
    const noIngr = { ...inactive, ingredients: undefined };
    expect(buildProductSave({ ...formOf(noIngr), name: 'Diavola piccante' }, noIngr, COMPANY)).toEqual({
      kind: 'update', id: 'p1', patch: { name: 'Diavola piccante' },
    });
    // Svuotare il campo di proposito li cancella.
    expect(buildProductSave({ ...formOf(inactive), ingredients: '' }, inactive, COMPANY)).toEqual({
      kind: 'update', id: 'p1', patch: { ingredients: [] },
    });
  });

  test('foto: la foto locale mostrata nell\'app non sostituisce quella del DB', () => {
    // Prodotto con foto generata locale al posto di image_url NULL (resolveProductImage).
    const bundled = { ...inactive, image_url: '/assets/margherita-generated.webp', stored_image_url: null };
    expect(buildProductSave(formOf(bundled), bundled, COMPANY)).toEqual({ kind: 'noop' });
    // Nuova foto caricata: inviata.
    const uploaded = buildProductSave({ ...formOf(inactive), image: `${STORAGE}?v=2` }, inactive, COMPANY);
    expect(uploaded).toEqual({ kind: 'update', id: 'p1', patch: { image_url: `${STORAGE}?v=2` } });
    // Foto tolta: null.
    expect(buildProductSave({ ...formOf(inactive), image: '  ' }, inactive, COMPANY)).toEqual({
      kind: 'update', id: 'p1', patch: { image_url: null },
    });
  });

  test('nome e prezzo validati', () => {
    expect(buildProductSave({ ...formOf(inactive), name: '  ' }, inactive, COMPANY)).toEqual({ kind: 'error', message: 'Nome e prezzo sono obbligatori' });
    expect(buildProductSave({ ...formOf(inactive), price: '' }, inactive, COMPANY).kind).toBe('error');
    expect(buildProductSave({ ...formOf(inactive), price: 'abc' }, inactive, COMPANY)).toEqual({ kind: 'error', message: 'Prezzo non valido (es. 8,50)' });
    expect(buildProductSave({ ...formOf(inactive), price: '-1' }, inactive, COMPANY).kind).toBe('error');
    expect(buildProductSave({ ...formOf(inactive), name: ' Diavola ' }, inactive, COMPANY)).toEqual({ kind: 'noop' });
  });
});

describe('editor prodotto admin: creazione', () => {
  test('nuovo prodotto: attivo, categoria di default, azienda dell\'admin', () => {
    expect(buildProductSave({ name: 'Bufalina', price: '10,5', image: null, ingredients: 'pomodoro, bufala' }, null, COMPANY)).toEqual({
      kind: 'insert',
      row: {
        name: 'Bufalina',
        price: 10.5,
        image_url: null,
        ingredients: ['pomodoro', 'bufala'],
        category_id: DEFAULT_NEW_PRODUCT_CATEGORY_ID,
        active: true,
        display_order: 0,
        company_id: COMPANY,
      },
    });
  });
});

describe('helper', () => {
  test('parsePrice accetta virgola e punto, max 2 decimali', () => {
    expect(parsePrice('8,50')).toBe(8.5);
    expect(parsePrice(' 12.5 ')).toBe(12.5);
    expect(parsePrice('7')).toBe(7);
    expect(parsePrice('0')).toBe(0);
    expect(parsePrice('1.234')).toBeNull();
    expect(parsePrice('1e3')).toBeNull();
    expect(parsePrice('')).toBeNull();
  });
  test('parseIngredients / ingredientsToText', () => {
    expect(parseIngredients(' a, ,b ,c,')).toEqual(['a', 'b', 'c']);
    expect(ingredientsToText(undefined)).toBe('');
    expect(ingredientsToText(['a', 'b'])).toBe('a, b');
  });
});
