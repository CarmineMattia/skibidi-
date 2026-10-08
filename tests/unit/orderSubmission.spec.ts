import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), storage: new Map<string, unknown>() }));
vi.mock('@/lib/api/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: null } }) }, rpc: mocks.rpc,
} }));
vi.mock('@/lib/stores/TenantContext', () => ({ useTenant: () => ({ companyId: 'restaurant-1' }) }));
vi.mock('@/lib/stores/AppSettingsContext', () => ({ useAppSettings: () => ({ deliveryFee: 2, language: 'it' }) }));
vi.mock('@/lib/stores/CartContext', () => ({ getCartItemUnitPrice: (item: { product: { price: number } }) => item.product.price }));
vi.mock('@/lib/fiscal/FiscalService', () => ({ getFiscalService: () => ({ emitReceipt: vi.fn() }) }));
vi.mock('@/lib/utils/storage', () => ({
  readJsonStorage: (key: string) => mocks.storage.get(key) ?? null,
  writeJsonStorage: (key: string, value: unknown) => mocks.storage.set(key, value),
}));

import { useCreateOrder } from '../../lib/hooks/useCreateOrder';
let submission: ReturnType<typeof useCreateOrder>;
function Probe() { submission = useCreateOrder(); return null; }
async function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let root: ReturnType<typeof create>;
  await act(async () => { root = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  return root!;
}
const input = {
  items: [{ product: { id: 'pizza-1', company_id: 'restaurant-1', name: 'Diavola', price: 6.5 }, quantity: 2, notes: 'Ben cotta' }],
  orderType: 'take_away', skipFiscal: true,
} as Parameters<typeof submission.mutateAsync>[0];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.storage.clear();
  mocks.rpc.mockReset();
});

describe('server-confirmed order submission', () => {
  it('sends the order and its kitchen lines together and returns the saved id', async () => {
    mocks.rpc.mockImplementation(async (name, args) => name === 'reserve_order_display_code'
      ? { data: 'Diavola #1', error: null }
      : { data: { id: args.p_order.id, display_code: 'Diavola #1', total_amount: 13 }, error: null });
    const root = await mount();
    let result: Awaited<ReturnType<typeof submission.mutateAsync>> | undefined;
    await act(async () => { result = await submission.mutateAsync(input); await new Promise(resolve => setTimeout(resolve, 0)); });
    const savedCall = mocks.rpc.mock.calls.find(call => call[0] === 'create_order_with_items')!;
    expect(savedCall[1]).toMatchObject({
      p_order: { id: result!.orderId, status: 'pending', company_id: 'restaurant-1', total_amount: 13 },
      p_items: [{ order_id: result!.orderId, product_id: 'pizza-1', quantity: 2, total_price: 13, notes: '[P] Diavola\nNota: Ben cotta' }],
    });
    expect(submission.isSuccess).toBe(true);
    expect(mocks.storage.get('ambrosia.orderSubmission.v1')).toBeNull();
    await act(async () => root.unmount());
  });

  it.each([
    { data: null, error: { message: 'server unavailable' } },
    { data: null, error: null },
    { data: { id: 'a-different-order' }, error: null },
  ])('never signals success without a matching server acknowledgement: %j', async response => {
    mocks.rpc.mockImplementation(async name => name === 'reserve_order_display_code'
      ? { data: null, error: null } : response);
    const root = await mount();
    await act(async () => { await expect(submission.mutateAsync(input)).rejects.toThrow(); await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(submission.isSuccess).toBe(false);
    expect(submission.isError).toBe(true);
    expect(mocks.storage.get('ambrosia.orderSubmission.v1')).toMatchObject({ id: expect.any(String) });
    await act(async () => root.unmount());
  });

  it('reuses the submission id after a lost response and a reload', async () => {
    let savedId: string | undefined;
    let attempts = 0;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === 'reserve_order_display_code') return { data: null, error: null };
      attempts++;
      if (!savedId) savedId = args.p_order.id;
      if (attempts === 1) return { data: null, error: { message: 'response lost after commit' } };
      expect(args.p_order.id).toBe(savedId);
      return { data: { id: savedId, total_amount: 13 }, error: null };
    });
    let root = await mount();
    await act(async () => { await expect(submission.mutateAsync(input)).rejects.toThrow('response lost'); });
    await act(async () => root.unmount());
    root = await mount();
    await act(async () => { await expect(submission.mutateAsync(input)).resolves.toMatchObject({ orderId: savedId }); });
    expect(attempts).toBe(2);
    await act(async () => root.unmount());
  });
});
