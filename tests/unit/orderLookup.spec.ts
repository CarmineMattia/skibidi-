import { describe, expect, it } from 'vitest';
import {
  OrderNotFoundError,
  isMissingOrderResponse,
  isOrderNotFoundError,
  isValidOrderId,
  resolveOrderSuccessState,
} from '../../lib/utils/orderLookup';
import { formatCustomerOrderCode } from '../../lib/utils/orderDisplayCode';

const realId = '00000000-0000-0000-0000-000000000021';
const base = { hydrated: true, formatLabel: formatCustomerOrderCode };

describe('order lookup by id', () => {
  it('accepts only uuids as order ids', () => {
    expect(isValidOrderId(realId)).toBe(true);
    for (const bad of ['', '12', 'abc', 'ordine-1', `${realId}x`, undefined, null]) expect(isValidOrderId(bad)).toBe(false);
  });

  it('NULL tracking row or a non-uuid (22P02) is "not found"; server/network errors are not', () => {
    expect(isMissingOrderResponse(null, null)).toBe(true);
    expect(isMissingOrderResponse([], null)).toBe(true);
    expect(isMissingOrderResponse(null, { code: '22P02' })).toBe(true);
    expect(isMissingOrderResponse({ id: realId }, null)).toBe(false);
    expect(isMissingOrderResponse(null, { code: 'PGRST301' })).toBe(false);
    expect(isMissingOrderResponse(null, { code: undefined })).toBe(false);
  });

  it('recognises the not-found error', () => {
    expect(isOrderNotFoundError(new OrderNotFoundError())).toBe(true);
    expect(isOrderNotFoundError(new Error('Ordine non trovato'))).toBe(false);
    expect(isOrderNotFoundError(new Error('timeout'))).toBe(false);
  });
});

describe('/order-success state', () => {
  it('made-up order id: not found, never "Ordine #N" (even with a displayCode in the URL)', () => {
    for (const orderId of ['123', 'fake', 'not-a-real-order']) {
      expect(resolveOrderSuccessState({ ...base, orderId, displayCode: 'Ordine #7' })).toEqual({ kind: 'not_found' });
    }
    expect(resolveOrderSuccessState({ ...base, orderId: undefined })).toEqual({ kind: 'not_found' });
  });

  it('well-formed id the server does not know: not found', () => {
    expect(resolveOrderSuccessState({ ...base, orderId: realId, displayCode: 'Ordine #7', error: new OrderNotFoundError() }))
      .toEqual({ kind: 'not_found' });
  });

  it('before hydration nothing is decided (static HTML has no query string)', () => {
    expect(resolveOrderSuccessState({ ...base, hydrated: false })).toEqual({ kind: 'loading' });
  });

  it('real order: label from the server row or the checkout code', () => {
    const order = { id: realId, display_code: 'Ordine #12' };
    expect(resolveOrderSuccessState({ ...base, orderId: realId, order })).toEqual({ kind: 'found', label: formatCustomerOrderCode(order) });
    expect(resolveOrderSuccessState({ ...base, orderId: realId, displayCode: 'Ordine #12', order })).toEqual({ kind: 'found', label: '🍕 Ordine #12' });
  });

  it('server unreachable: still "verify", not "not found"', () => {
    expect(resolveOrderSuccessState({ ...base, orderId: realId, error: new Error('503') }).kind).toBe('unverified');
    expect(resolveOrderSuccessState({ ...base, orderId: realId }).kind).toBe('loading');
  });
});
