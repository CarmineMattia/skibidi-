/**
 * Client ↔ server pricing parity.
 *
 * 1. The listino seeded by the migration (menu_pricing.config) equals the
 *    client constants (lib/data/menuPricing.ts → buildMenuPricingConfig).
 * 2. tests/sql/fixtures/pricing-cases.json holds one case per size / mezzo
 *    metro / extras / builder combination of the real catalogue
 *    (tests/fixtures/ambrosia-catalogue.json): the exact order_items.notes the
 *    client sends and the unit price the client shows. This test regenerates
 *    them from the client code and fails if the committed file differs; the
 *    PGlite runner (tests/sql/run-server-pricing-pglite.mjs) checks the server
 *    prices every case to the same cent.
 *
 * Regenerate after changing prices/catalogue: UPDATE_PRICING_FIXTURES=1 npx vitest run tests/unit/serverPricingParity.spec.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INGREDIENT_CATALOG } from '@/lib/data/ingredients';
import type { IngredientCategoryId } from '@/lib/data/ingredients';
import {
  buildMenuItemModifiers,
  buildMenuPricingConfig,
  computeMenuItemUnitPrice,
  getMenuItemFlags,
} from '@/lib/data/menuPricing';
import type { MenuItemSelection } from '@/lib/data/menuPricing';
import { COOKING_OPTIONS } from '@/lib/data/menuPricing';
import {
  BUILDER_DOUGHS,
  BUILDER_PRODUCT_NAME,
  BUILDER_SAUCES,
  BUILDER_SIZES,
  buildSelectionModifiers,
  calculateBuilderPrice,
  createMezzoMetroGustoFromProduct,
  MENU_PIZZA_SIZES,
} from '@/lib/data/pizzaBuilder';
import { formatOrderItemNotes } from '@/lib/utils/orderItemDetails';
import { getMaxGustiForProduct, isMetroCategoryName, isPizzaCategoryName } from '@/lib/utils/menuCategories';

const root = path.resolve(__dirname, '../..');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/ambrosia-catalogue.json'), 'utf8')) as {
  company_id: string;
  categories: { id: string; name: string }[];
  products: { id: string; category_id: string | null; name: string; price: number; ingredients: string[] | null }[];
};
/** Not on the live menu today (no active "Componi la tua pizza"): synthetic, to cover the builder. */
const BUILDER_TEST_PRODUCT = {
  id: '00000000-0000-0000-0000-00000000b11d',
  category_id: null as string | null,
  name: BUILDER_PRODUCT_NAME,
  price: 5,
  ingredients: null as string[] | null,
};

const firstOfCategory = (category: IngredientCategoryId) =>
  INGREDIENT_CATALOG.find((entry) => entry.category === category)!;
const EXTRA_SETS: string[][] = [
  [],
  [firstOfCategory('pesce').name],
  [firstOfCategory('formaggi').name, firstOfCategory('salumi').name, firstOfCategory('extra').name],
  [firstOfCategory('salse').name, firstOfCategory('verdure').name],
];

interface PricingCase {
  label: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  unit_price: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateCases(): PricingCase[] {
  const categoryName = (id: string | null) => catalogue.categories.find((c) => c.id === id)?.name;
  const cases: PricingCase[] = [];
  const standardPizzas = catalogue.products.filter((product) =>
    getMenuItemFlags(product, categoryName(product.category_id)).isStandardMenuPizza
  );
  const push = (label: string, product: { id: string; name: string }, modifiers: string[], unit: number, note = '', quantity = 1) => {
    cases.push({
      label,
      product_id: product.id,
      quantity,
      notes: formatOrderItemNotes(note, modifiers, product.name),
      unit_price: round2(unit),
    });
  };

  catalogue.products.forEach((product, productIndex) => {
    const category = categoryName(product.category_id);
    const flags = getMenuItemFlags(product, category);
    const base: MenuItemSelection = {
      product,
      categoryName: category,
      sizeId: 'normale',
      extraIngredients: [],
      mezzoGusti: [],
      selectedGusti: [],
      modifications: {},
      cookingLabel: null,
    };
    const ingredients = product.ingredients ?? [];
    const modifications: MenuItemSelection['modifications'] =
      ingredients.length >= 2 ? { [ingredients[0]]: 'no', [ingredients[1]]: 'extra' } : {};

    if (flags.isStandardMenuPizza) {
      for (const size of MENU_PIZZA_SIZES.filter((s) => s.id !== 'mezzo_metro')) {
        EXTRA_SETS.forEach((extras, setIndex) => {
          const selection: MenuItemSelection = {
            ...base,
            sizeId: size.id,
            extraIngredients: extras,
            modifications: setIndex === 2 ? modifications : {},
            cookingLabel: setIndex === 3 ? 'Ben cotta' : null,
          };
          push(`${product.name} ${size.id} extras#${setIndex}`, product, buildMenuItemModifiers(selection),
            computeMenuItemUnitPrice(selection), setIndex === 1 ? 'Senza fretta\nTaglia: Mezzo metro\n+ Burrata' : '', 1 + (setIndex % 3));
        });
      }
      // Mezzo metro: 1, 2 and 3 gusti (other real pizzas), with extras per slot.
      const others = standardPizzas.filter((other) => other.id !== product.id);
      const gustiSets = [
        [product],
        [product, others[productIndex % others.length]],
        [others[(productIndex + 3) % others.length], product, others[(productIndex + 7) % others.length]],
      ];
      gustiSets.forEach((gusti, setIndex) => {
        const slots = gusti.map((gusto, slotIndex) => {
          const slot = createMezzoMetroGustoFromProduct(gusto, `slot-${slotIndex}`);
          slot.extraIngredients = EXTRA_SETS[(setIndex + slotIndex) % EXTRA_SETS.length];
          const first = gusto.ingredients?.[0];
          if (first && slotIndex === 0) slot.modifications = { [first]: 'extra' };
          return slot;
        });
        const selection: MenuItemSelection = { ...base, sizeId: 'mezzo_metro', mezzoGusti: slots };
        push(`${product.name} mezzo_metro gusti#${gusti.length}`, product, buildMenuItemModifiers(selection),
          computeMenuItemUnitPrice(selection));
      });
      return;
    }

    if (flags.isMetro) {
      const gusti = standardPizzas.slice(productIndex % 5, (productIndex % 5) + flags.maxGusti).map((g) => g.name);
      [0, 2].forEach((setIndex) => {
        const selection: MenuItemSelection = { ...base, selectedGusti: gusti, extraIngredients: EXTRA_SETS[setIndex], modifications };
        push(`${product.name} metro extras#${setIndex}`, product, buildMenuItemModifiers(selection), computeMenuItemUnitPrice(selection));
      });
      return;
    }

    const extras = flags.showIngredientTools ? EXTRA_SETS[1] : [];
    const selection: MenuItemSelection = { ...base, extraIngredients: extras };
    push(`${product.name} plain`, product, buildMenuItemModifiers(selection), computeMenuItemUnitPrice(selection), '', 2);
  });

  // Componi la tua pizza: every size × dough × sauce, with ingredient sets.
  for (const size of BUILDER_SIZES) {
    for (const dough of BUILDER_DOUGHS) {
      for (const sauce of BUILDER_SAUCES) {
        [0, 2, 3].forEach((setIndex) => {
          const selection = {
            sizeId: size.id,
            doughId: dough.id,
            sauceId: sauce.id,
            ingredients: EXTRA_SETS[setIndex].map((name) => INGREDIENT_CATALOG.find((entry) => entry.name === name)!),
          };
          const modifiers = buildSelectionModifiers(selection);
          if (setIndex === 3) modifiers.push(`Cottura: ${COOKING_OPTIONS[0].label}`);
          push(`builder ${size.id}/${dough.id}/${sauce.id} extras#${setIndex}`, BUILDER_TEST_PRODUCT,
            modifiers, calculateBuilderPrice(selection).total, setIndex === 2 ? 'senza\nfretta,  grazie | + Burrata' : '');
        });
      }
    }
  }
  return cases;
}

const casesPath = path.join(root, 'tests/sql/fixtures/pricing-cases.json');
const migrationPath = path.join(root, 'supabase/migrations/20261020150000_server_side_pricing.sql');

describe('server-side pricing parity', () => {
  it('generated cases match the committed fixture (client prices)', () => {
    const cases = generateCases();
    const metroNames = [
      ...catalogue.products.filter((p) => isMetroCategoryName(catalogue.categories.find((c) => c.id === p.category_id)?.name)).map((p) => p.name),
      'Due terzi Diavola', 'Meta metro Bufala', 'METÀ FARCITA', 'Super Farcita', 'Metro classico',
    ];
    const metro_max_gusti = metroNames.map((name) => ({ name, max: getMaxGustiForProduct(name, 'Al metro') }));
    const json = `${JSON.stringify({ builder_product: BUILDER_TEST_PRODUCT, cooking_labels: COOKING_OPTIONS.map((o) => o.label), metro_max_gusti, cases }, null, 1)}\n`;
    if (process.env.UPDATE_PRICING_FIXTURES === '1') fs.writeFileSync(casesPath, json);
    expect(fs.readFileSync(casesPath, 'utf8')).toBe(json);
    expect(cases.length).toBeGreaterThan(500);
    // every unit price is a real, positive amount
    expect(cases.every((c) => c.unit_price > 0)).toBe(true);
  });

  it('standard pizza names are unique (mezzo metro gusti are matched by name)', () => {
    const names = catalogue.products
      .filter((product) => {
        const category = catalogue.categories.find((c) => c.id === product.category_id)?.name;
        return isPizzaCategoryName(category) && !isMetroCategoryName(category);
      })
      .map((product) => product.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the migration accepts exactly the client cooking labels', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const match = sql.match(/menu_cooking_labels\(\)[\s\S]*?SELECT ARRAY\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    expect(match![1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''))).toEqual(COOKING_OPTIONS.map((o) => o.label));
  });

  it('the migration seeds exactly the client listino', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const match = sql.match(/\$seed\$([\s\S]*?)\$seed\$/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(buildMenuPricingConfig());
  });
});
