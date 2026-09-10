import { describe, expect, it } from 'vitest';
import {
  generateFallbackOrderDisplayCode,
  getOrderDisplayCode,
  formatCustomerOrderCode,
} from '../../lib/utils/orderDisplayCode';

describe('orderDisplayCode', () => {
  it('keeps modern Ordine #N codes as-is', () => {
    expect(getOrderDisplayCode({ id: 'uuid', display_code: 'Ordine #12' })).toBe('Ordine #12');
  });

  it('rewrites legacy pizza nickname codes to Ordine #N', () => {
    expect(getOrderDisplayCode({ id: 'uuid', display_code: 'Patate #3' })).toBe('Ordine #3');
    expect(getOrderDisplayCode({ id: 'uuid', display_code: 'Diavola #12' })).toBe('Ordine #12');
  });

  it('generates a deterministic Ordine #N fallback from order id', () => {
    const first = generateFallbackOrderDisplayCode('11111111-1111-1111-1111-111111111111');
    const second = generateFallbackOrderDisplayCode('11111111-1111-1111-1111-111111111111');

    expect(first).toMatch(/^Ordine #\d+$/);
    expect(first).toBe(second);
  });

  it('formats customer-facing code without pizza emoji nickname', () => {
    expect(formatCustomerOrderCode({ id: 'uuid', display_code: 'Bufala #3' })).toBe('Ordine #3');
  });
});
