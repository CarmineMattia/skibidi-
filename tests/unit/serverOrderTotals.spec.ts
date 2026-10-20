import { describe, expect, it } from 'vitest';
import { resolveOrderTotals, type ResolvedOrderLine } from '@/lib/utils/serverOrderTotals';
import {
  applyMenuPricingConfig,
  buildMenuPricingConfig,
  computeMenuItemUnitPrice,
} from '@/lib/data/menuPricing';
import { getMenuPizzaUnitPrice } from '@/lib/data/pizzaBuilder';

const client: ResolvedOrderLine[] = [
  { productId: 'p1', name: 'Diavola', quantity: 2, unitPrice: 0.01, totalPrice: 0.02 },
  { productId: 'p2', name: 'Acqua', quantity: 1, unitPrice: 1, totalPrice: 1 },
];

describe('resolveOrderTotals (server prices win)', () => {
  it('uses server lines, fee and total', () => {
    const r = resolveOrderTotals({
      id: 'o', total_amount: 17.5, delivery_fee: 2.5,
      items: [
        { product_id: 'p1', quantity: 2, unit_price: 6.5, total_price: 13 },
        { product_id: 'p2', quantity: 1, unit_price: '2', total_price: '2' },
      ],
    }, client, 2);
    expect(r).toMatchObject({ fromServer: true, total: 17.5, deliveryFee: 2.5 });
    expect(r.lines.map((l) => [l.unitPrice, l.totalPrice])).toEqual([[6.5, 13], [2, 2]]);
  });
  it('derives the fee when the server does not send it', () => {
    const r = resolveOrderTotals({ total_amount: 15.5, items: [
      { product_id: 'p1', quantity: 2, unit_price: 6.5, total_price: 13 },
      { product_id: 'p2', quantity: 1, unit_price: 0, total_price: 0 },
    ] }, client, 0);
    expect(r.deliveryFee).toBe(2.5);
  });
  it('old DB function (no items): saved total, client lines', () => {
    const r = resolveOrderTotals({ id: 'o', total_amount: 3.02 }, client, 2);
    expect(r).toMatchObject({ fromServer: false, total: 3.02, deliveryFee: 2 });
    expect(r.lines).toEqual(client);
  });
  it('no total at all: client estimate', () => {
    expect(resolveOrderTotals({ id: 'o' }, client, 2).total).toBe(3.02);
  });
  it('mismatched server lines are not mapped onto the cart', () => {
    const r = resolveOrderTotals({ total_amount: 9, items: [{ product_id: 'px', quantity: 1, unit_price: 9, total_price: 9 }] }, client, 0);
    expect(r).toMatchObject({ fromServer: false, total: 9 });
  });
});

describe('applyMenuPricingConfig (client reads the DB listino)', () => {
  it('refuses malformed configs and changes nothing', () => {
    const before = JSON.stringify(buildMenuPricingConfig());
    expect(applyMenuPricingConfig(null)).toBe(false);
    expect(applyMenuPricingConfig({ version: 2 })).toBe(false);
    expect(applyMenuPricingConfig({ ...buildMenuPricingConfig(), ingredientCategoryPrices: { salse: 'free' } })).toBe(false);
    expect(JSON.stringify(buildMenuPricingConfig())).toBe(before);
  });
  it('a DB price change is what the client shows (then restored)', () => {
    const original = buildMenuPricingConfig();
    const changed = structuredClone(original);
    changed.menuSizes.find((s) => s.id === 'mezzo_metro')!.priceMultiplier = 2.5;
    changed.ingredientCategoryPrices.pesce = 3;
    try {
      expect(applyMenuPricingConfig(changed)).toBe(true);
      expect(getMenuPizzaUnitPrice(8, 'mezzo_metro')).toBe(20);
      const price = computeMenuItemUnitPrice({
        product: { id: 'x', name: 'Margherita', price: 8 }, categoryName: 'Classiche',
        sizeId: 'normale', extraIngredients: ['Tonno'], mezzoGusti: [], selectedGusti: [], modifications: {},
      });
      expect(price).toBe(11);
    } finally {
      expect(applyMenuPricingConfig(original)).toBe(true);
    }
    expect(buildMenuPricingConfig()).toEqual(original);
  });
});
