import { describe, expect, test } from 'vitest';
import { isAntiabuseError } from '../../lib/utils/antiabuse';
import { ORDER_NOTE_INPUT_MAX_CHARS, toOrderLineError } from '../../lib/utils/orderLineErrors';

const items = [{ product: { id: 'p1', name: 'Margherita' } }];

describe('note troppo lunghe (20261022100000)', () => {
  test('ORDER_NOTES_TOO_LONG diventa un messaggio chiaro, senza togliere nulla dal carrello', () => {
    const it = toOrderLineError({ message: 'Order notes too long', details: 'ORDER_NOTES_TOO_LONG', hint: '{"table":"orders","length":1001}' }, items)!;
    expect(it.message).toBe('Le note sono troppo lunghe: accorciale e riprova.');
    expect(it.code).toBe('ORDER_NOTES_TOO_LONG');
    expect(it.productId).toBeNull();
    expect(it.removeFromCart).toBe(false);
    expect(isAntiabuseError(it)).toBe(true);
    const en = toOrderLineError({ message: 'Order notes too long', details: 'ORDER_NOTES_TOO_LONG', hint: null }, items, 'en')!;
    expect(en.message).toBe('The notes are too long: please shorten them and try again.');
  });

  test('il campo note del client resta molto sotto il limite del server', () => {
    expect(ORDER_NOTE_INPUT_MAX_CHARS).toBe(200);
    expect(ORDER_NOTE_INPUT_MAX_CHARS).toBeLessThan(1000 - 200);
  });
});
