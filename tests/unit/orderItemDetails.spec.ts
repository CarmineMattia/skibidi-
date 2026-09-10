import { describe, expect, test } from 'vitest';
import {
  cleanKitchenOrderNotes,
  formatOrderItemNotes,
  parseOrderItemNotes,
} from '../../lib/utils/orderItemDetails';

describe('formatOrderItemNotes', () => {
  test('persists product name, modifiers and free note for the kitchen', () => {
    expect(
      formatOrderItemNotes('poco cotta', ['Taglia: Media', '+ Gorgonzola', 'No cipolla'], 'Margherita')
    ).toBe('[P] Margherita\nTaglia: Media\n+ Gorgonzola\nNo cipolla\nNota: poco cotta');
  });

  test('returns null when empty', () => {
    expect(formatOrderItemNotes('', [])).toBeNull();
    expect(formatOrderItemNotes(undefined, undefined)).toBeNull();
  });
});

describe('parseOrderItemNotes', () => {
  test('parses the new newline format with product snapshot', () => {
    expect(
      parseOrderItemNotes(
        '[P] Margherita\nTaglia: Media\n+ Gorgonzola\nNo cipolla\nNota: poco cotta'
      )
    ).toEqual({
      productName: 'Margherita',
      modifiers: ['Taglia: Media', '+ Gorgonzola', 'No cipolla'],
      freeNote: 'poco cotta',
    });
  });

  test('parses legacy pipe + comma format', () => {
    expect(
      parseOrderItemNotes('poco cotta | Taglia: Media, + Gorgonzola, No cipolla')
    ).toEqual({
      productName: null,
      freeNote: 'poco cotta',
      modifiers: ['Taglia: Media', '+ Gorgonzola', 'No cipolla'],
    });
  });

  test('parses legacy modifiers-only string', () => {
    expect(parseOrderItemNotes('Extra mozzarella, No funghi')).toEqual({
      productName: null,
      modifiers: ['Extra mozzarella', 'No funghi'],
      freeNote: null,
    });
  });
});

describe('cleanKitchenOrderNotes', () => {
  test('strips fulfillment and capacity tokens', () => {
    expect(
      cleanKitchenOrderNotes(
        'Cliente allergico | Fulfillment: ASAP | [FULFILLMENT:2026-09-04T12:00:00.000Z] | [CAPACITY_UNITS:2]'
      )
    ).toBe('Cliente allergico');
  });
});
