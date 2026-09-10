import { describe, expect, test } from 'vitest';

import { categorizeIngredient } from '../../lib/data/ingredients';
import {
  BUILDER_INGREDIENT_PRICES,
  buildMezzoMetroModifiers,
  createMezzoMetroGustoFromProduct,
  getMezzoMetroUnitPrice,
  getMenuPizzaUnitPrice,
} from '../../lib/data/pizzaBuilder';

describe('menu pizza mezzo metro', () => {
  test('prices mezzo metro as 2x list', () => {
    expect(getMenuPizzaUnitPrice(8.5, 'mezzo_metro')).toBe(17);
  });

  test('uses most expensive gusto for base price', () => {
    const tartufata = createMezzoMetroGustoFromProduct({
      id: '1',
      name: 'Tartufata',
      price: 8.5,
      ingredients: ['Mozzarella', 'Porcini'],
    });
    const margherita = createMezzoMetroGustoFromProduct({
      id: '2',
      name: 'Margherita',
      price: 5,
      ingredients: ['Pomodoro', 'Mozzarella'],
    });
    margherita.extraIngredients = ['Rucola'];

    const unit = getMezzoMetroUnitPrice([tartufata, margherita], (name) =>
      BUILDER_INGREDIENT_PRICES[categorizeIngredient(name)]
    );
    // 2 * 8.5 + (rucola verdure 1.0 * multiplier 2) = 17 + 2 = 19
    expect(unit).toBe(19);
  });

  test('builds per-gusto modifiers for kitchen', () => {
    const a = createMezzoMetroGustoFromProduct({
      id: '1',
      name: 'Tartufata',
      price: 8.5,
      ingredients: ['Porcini'],
    });
    a.modifications = { Porcini: 'no' };
    a.extraIngredients = ['Rucola'];
    const b = createMezzoMetroGustoFromProduct({
      id: '2',
      name: 'Margherita',
      price: 5,
      ingredients: ['Pomodoro'],
    });

    expect(buildMezzoMetroModifiers([a, b])).toEqual([
      'Taglia: Mezzo metro',
      'Gusto 1: Tartufata',
      'Gusto 1: No Porcini',
      'Gusto 1: + Rucola',
      'Gusto 2: Margherita',
    ]);
  });
});
