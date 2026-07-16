import { describe, expect, it } from 'vitest';
import {
  generateFallbackOrderDisplayCode,
  getOrderDisplayCode,
  formatCustomerOrderCode,
} from '../../lib/utils/orderDisplayCode';

describe('orderDisplayCode', () => {
  it('uses stored display_code when available', () => {
    expect(getOrderDisplayCode({ id: 'uuid', display_code: 'Diavola #12' })).toBe('Diavola #12');
  });

  it('generates a deterministic fallback from order id', () => {
    const first = generateFallbackOrderDisplayCode('11111111-1111-1111-1111-111111111111');
    const second = generateFallbackOrderDisplayCode('11111111-1111-1111-1111-111111111111');

    expect(first).toMatch(/^.+ #\d+$/);
    expect(first).toBe(second);
  });

  it('formats customer-facing code with pizza emoji', () => {
    expect(formatCustomerOrderCode({ id: 'uuid', display_code: 'Bufala #3' })).toBe('🍕 Bufala #3');
  });
});
