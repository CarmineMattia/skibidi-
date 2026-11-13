import { describe, expect, test } from 'vitest';
import { chunkDigitGroups, formatGroupedEuro, formatReadableCode, normalizeCustomerName } from '@/lib/utils/displayFormat';
import {
  acceptPhoneTyping,
  formatItalianPhoneChunks,
  phoneChunkHint,
  toCheckoutPhone,
} from '@/lib/utils/phone';
import { motionDuration, MOTION_CAP_MS } from '@/lib/motion/timings';

describe('phone input normaliser', () => {
  test('keeps a digits-only number unchanged', () => {
    expect(acceptPhoneTyping('3331234567')).toBe('3331234567');
    expect(acceptPhoneTyping('  3331234567  ')).toBe('3331234567');
  });

  test('accepts spaces, dashes and the Italian prefix', () => {
    expect(acceptPhoneTyping('+39 333 123 4567')).toBe('3331234567');
    expect(acceptPhoneTyping('0039 0522 171 7681')).toBe('05221717681');
    expect(acceptPhoneTyping('(0522) 171-7681')).toBe('05221717681');
  });

  test('caps the stored digits', () => {
    expect(acceptPhoneTyping('33312345679999', 10)).toBe('3331234567');
  });
});

describe('Italian phone chunks', () => {
  test('chunks the pizzeria landline and a mobile', () => {
    expect(formatItalianPhoneChunks('05221717681')).toBe('0522 171 7681');
    expect(formatItalianPhoneChunks('+39 0522 171 7681')).toBe('0522 171 7681');
    expect(formatItalianPhoneChunks('3331234567')).toBe('333 123 4567');
  });

  test('chunks short area codes separately', () => {
    expect(formatItalianPhoneChunks('0212345678')).toBe('02 123 456 78');
  });

  test('hides the hint until the number can be grouped', () => {
    expect(phoneChunkHint('333')).toBeNull();
    expect(phoneChunkHint('3331234567')).toBe('333 123 4567');
  });

  test('stores an Italian number with +39 and keeps other prefixes', () => {
    expect(toCheckoutPhone('333 123 4567')).toBe('+393331234567');
    expect(toCheckoutPhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(toCheckoutPhone('   ')).toBe('');
  });
});

describe('customer name and readable codes', () => {
  test('trims and collapses the name', () => {
    expect(normalizeCustomerName('  Mario   Rossi  ')).toBe('Mario Rossi');
    expect(normalizeCustomerName('')).toBe('');
  });

  test('chunks only long digit runs', () => {
    expect(chunkDigitGroups('123456789')).toBe('123 456 789');
    expect(formatReadableCode('Ordine #12')).toBe('Ordine #12');
    expect(formatReadableCode('Ordine #123456')).toBe('Ordine #123 456');
  });
});

describe('grouped euro totals', () => {
  test('keeps the menu format under one thousand', () => {
    expect(formatGroupedEuro(5)).toBe('€5.00');
    expect(formatGroupedEuro(12.5)).toBe('€12.50');
  });

  test('groups thousands in Italian currency format', () => {
    expect(formatGroupedEuro(1234.5)).toBe('€1.234,50');
    expect(formatGroupedEuro(Number.NaN)).toBe('€0.00');
  });
});

describe('motion durations', () => {
  test('drops motion when reduced and never exceeds 300ms', () => {
    expect(motionDuration(true, 220)).toBe(0);
    expect(motionDuration(false, 220)).toBe(220);
    expect(motionDuration(false, 900)).toBe(MOTION_CAP_MS);
    expect(motionDuration(false, -5)).toBe(0);
  });
});
