import { describe, expect, it } from 'vitest';
import { getProductSubtitle, isDessertCategoryName, pickFeaturedProduct, sortMenuProducts } from '../../lib/utils/menuOrder';
import { COMBO_OFFERS_ENABLED, resolveComboOffers } from '../../lib/data/offers';

const categories = [
  { id: 'bev', name: 'Bevande', display_order: 1 },
  { id: 'dol', name: 'Dolci', display_order: 2 },
  { id: 'gou', name: 'Gourmet', display_order: 3 },
  { id: 'cla', name: 'Classiche', display_order: 6 },
  { id: 'met', name: 'Al metro', display_order: 7 },
];

const p = (name: string, category_id: string, display_order: number, image_url: string | null = null) => ({
  name,
  category_id,
  display_order,
  image_url,
  description: null as string | null,
  ingredients: null as string[] | null,
});

describe('sortMenuProducts', () => {
  it('follows the category order, desserts after the pizzas, then display_order', () => {
    const list = [
      p('Profiterol', 'dol', 1),
      p('Margherita al metro', 'met', 1),
      p('Margherita', 'cla', 1),
      p('La Rustica', 'gou', 1),
      p('Romana', 'cla', 2),
      p('Tiramisù', 'dol', 3),
    ];
    expect(sortMenuProducts(list, categories).map((x) => x.name)).toEqual([
      'La Rustica',
      'Margherita',
      'Romana',
      'Margherita al metro',
      'Profiterol',
      'Tiramisù',
    ]);
  });

  it('keeps unknown categories last and is stable', () => {
    const list = [p('X', 'zzz', 1), p('A', 'cla', 5), p('B', 'cla', 5)];
    expect(sortMenuProducts(list, categories).map((x) => x.name)).toEqual(['A', 'B', 'X']);
  });

  it('does not mutate the input', () => {
    const list = [p('Profiterol', 'dol', 1), p('Margherita', 'cla', 1)];
    sortMenuProducts(list, categories);
    expect(list[0].name).toBe('Profiterol');
  });
});

describe('pickFeaturedProduct', () => {
  it('prefers the first product with a photo', () => {
    expect(pickFeaturedProduct([p('A', 'dol', 1), p('B', 'cla', 1, 'https://x/y.webp')])?.name).toBe('B');
  });
  it('falls back to the first product, and undefined on an empty list', () => {
    expect(pickFeaturedProduct([p('A', 'dol', 1, '  ')])?.name).toBe('A');
    expect(pickFeaturedProduct([])).toBeUndefined();
  });
});

describe('getProductSubtitle', () => {
  it('uses description, then ingredients, then the fallback', () => {
    expect(getProductSubtitle({ ...p('M', 'cla', 1), description: 'pomodoro' }, 'Classiche', 'Ricetta artigianale')).toBe('pomodoro');
    expect(getProductSubtitle({ ...p('M', 'cla', 1), ingredients: ['a', ' b '] }, 'Classiche', 'R')).toBe('a, b');
    expect(getProductSubtitle(p('Profiterol', 'dol', 1), 'Dolci', 'Ricetta artigianale')).toBe('Ricetta artigianale');
  });
  it('shows nothing for drinks without a description', () => {
    expect(getProductSubtitle(p('Coca Cola', 'bev', 1), 'Bevande', 'Ricetta artigianale')).toBe('');
  });
});

describe('isDessertCategoryName', () => {
  it('matches Dolci only', () => {
    expect(isDessertCategoryName('Dolci')).toBe(true);
    expect(isDessertCategoryName('Classiche')).toBe(false);
    expect(isDessertCategoryName(undefined)).toBe(false);
  });
});

describe('combo offers', () => {
  it('are off until the pizzeria defines real ones', () => {
    expect(COMBO_OFFERS_ENABLED).toBe(false);
    const products = [{ id: '1', name: 'Margherita', price: 5, category_id: 'cla' }] as never[];
    expect(resolveComboOffers(products)).toEqual([]);
    expect(resolveComboOffers(products, true).length).toBeGreaterThan(0);
  });
});
