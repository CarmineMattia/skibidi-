import { describe, expect, it } from 'vitest';
import {
  isDefaultMenuCategory,
  menuCategoryRank,
  PIZZE_CHIP_LABEL,
  pickHomePizzas,
  sortMenuCategories,
  sortMenuProducts,
} from '../../lib/utils/menuOrder';

// Active categories on prod (2026-10-25), with their DB display_order:
// Bevande and Dolci come first there, so the menu opened on drinks/desserts chips.
const prodCategories = [
  { id: 'bev', name: 'Bevande', display_order: 1 },
  { id: 'dol', name: 'Dolci', display_order: 2 },
  { id: 'gou', name: 'Gourmet', display_order: 3 },
  { id: 'gus', name: 'Gustose', display_order: 4 },
  { id: 'bia', name: 'Bianche', display_order: 5 },
  { id: 'cla', name: 'Classiche', display_order: 6 },
  { id: 'met', name: 'Al metro', display_order: 7 },
];

const p = (id: string, name: string, category_id: string, display_order: number, image_url: string | null = null, price = 5) => ({
  id,
  name,
  category_id,
  display_order,
  image_url,
  price,
  description: null as string | null,
  ingredients: null as string[] | null,
});

describe('menu: pizzas first', () => {
  it('the default chip is labelled "Pizze"', () => {
    expect(PIZZE_CHIP_LABEL).toBe('Pizze');
  });

  it('orders the prod categories Classiche, Bianche, Gustose, Gourmet, Al metro, Dolci, Bevande', () => {
    expect(sortMenuCategories(prodCategories).map((c) => c.name)).toEqual([
      'Classiche',
      'Bianche',
      'Gustose',
      'Gourmet',
      'Al metro',
      'Dolci',
      'Bevande',
    ]);
  });

  it('does not mutate the input and is stable for equal ranks', () => {
    const input = [...prodCategories];
    sortMenuCategories(input);
    expect(input.map((c) => c.id)).toEqual(prodCategories.map((c) => c.id));
    const twins = [
      { id: 'a', name: 'Pizze speciali', display_order: 2 },
      { id: 'b', name: 'Pizze del mese', display_order: 2 },
      { id: 'c', name: 'Pizze rosse', display_order: 1 },
    ];
    expect(sortMenuCategories(twins).map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('ranks legacy "Pizze ..." names and other categories sensibly', () => {
    expect(menuCategoryRank('Pizze Classiche')).toBe(0);
    expect(menuCategoryRank('Pizze Bianche')).toBe(1);
    expect(menuCategoryRank('Pizze Gustose')).toBe(2);
    expect(menuCategoryRank('Pizze al metro')).toBe(5);
    expect(menuCategoryRank('Fritti')).toBe(6);
    expect(menuCategoryRank('Dolci')).toBe(7);
    expect(menuCategoryRank('Vini')).toBe(8);
    expect(menuCategoryRank(undefined)).toBe(6);
  });

  it('the "Pizze" chip covers pizzas (and Al metro) but not desserts or drinks', () => {
    for (const name of ['Classiche', 'Bianche', 'Gustose', 'Gourmet', 'Al metro']) {
      expect(isDefaultMenuCategory(name)).toBe(true);
    }
    expect(isDefaultMenuCategory('Dolci')).toBe(false);
    expect(isDefaultMenuCategory('Bevande')).toBe(false);
  });

  it('the default list starts with Margherita (Classiche), not Gourmet or desserts', () => {
    const products = [
      p('1', 'Profiterol', 'dol', 1),
      p('2', 'Coca Cola', 'bev', 1),
      p('3', 'La Rustica', 'gou', 1, 'https://x/rustica.webp'),
      p('4', 'Margherita', 'cla', 1, 'https://x/margherita.webp'),
      p('5', 'Bianca', 'bia', 1),
      p('6', 'Diavola', 'cla', 2),
    ];
    const nameById = new Map(prodCategories.map((c) => [c.id, c.name] as const));
    const defaultList = sortMenuProducts(
      products.filter((x) => isDefaultMenuCategory(nameById.get(x.category_id))),
      prodCategories
    );
    expect(defaultList.map((x) => x.name)).toEqual(['Margherita', 'Diavola', 'Bianca', 'La Rustica']);
  });
});

describe('pickHomePizzas', () => {
  const products = [
    p('1', 'Profiterol', 'dol', 1, 'https://x/prof.webp'),
    p('2', 'Coca Cola', 'bev', 1, 'https://x/coca.webp'),
    p('3', 'La Rustica', 'gou', 1, 'https://x/rustica.webp'),
    p('4', 'Margherita', 'cla', 1, 'https://x/margherita.webp'),
    p('5', 'Bianca', 'bia', 1, '  '),
    p('6', 'Diavola', 'cla', 2, 'https://x/diavola.webp'),
    p('7', 'Margherita al metro', 'met', 1, 'https://x/metro.webp'),
    p('8', 'Orfana', 'missing', 1, 'https://x/orfana.webp'),
  ];

  it('returns photographed pizzas in menu order, no metro, desserts, drinks or unknown categories', () => {
    expect(pickHomePizzas(products, prodCategories).map((x) => x.name)).toEqual(['Margherita', 'Diavola', 'La Rustica']);
  });

  it('respects the limit and handles empty data', () => {
    expect(pickHomePizzas(products, prodCategories, 1).map((x) => x.name)).toEqual(['Margherita']);
    expect(pickHomePizzas(products, prodCategories, -3)).toEqual([]);
    expect(pickHomePizzas([], prodCategories)).toEqual([]);
    expect(pickHomePizzas(products, [])).toEqual([]);
  });
});
