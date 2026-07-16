import { describe, expect, test } from 'vitest';

import { getCartItemPizzaWeight, sumCartPizzaCapacity } from '../../lib/utils/pizzaCapacity';

function makeCartItem(name: string, quantity = 1, modifiers: string[] = []) {
  return {
    quantity,
    modifiers,
    product: {
      id: `${name}-${quantity}`,
      name,
      price: 10,
      category: 'pizza',
      active: true,
    },
  } as any;
}

describe('pizza capacity weights', () => {
  test('counts normal and piccola as 1', () => {
    expect(getCartItemPizzaWeight(makeCartItem('Margherita'))).toBe(1);
    expect(getCartItemPizzaWeight(makeCartItem('Piccola Margherita'))).toBe(1);
  });

  test('counts tirata as 1.5', () => {
    expect(getCartItemPizzaWeight(makeCartItem('Margherita tirata'))).toBe(1.5);
    expect(getCartItemPizzaWeight(makeCartItem('Margherita', 1, ['Impasto tirata']))).toBe(1.5);
  });

  test('counts mezzo metro as 3', () => {
    expect(getCartItemPizzaWeight(makeCartItem('Mezzo metro farcita'))).toBe(3);
  });

  test('sums weighted quantities', () => {
    const items = [
      makeCartItem('Margherita', 1),
      makeCartItem('Margherita tirata', 2),
      makeCartItem('Mezzo metro farcita', 1),
    ];
    expect(sumCartPizzaCapacity(items)).toBe(7);
  });
});
