import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Orders are locked for customers after creation (20261020160000_customer_order_update_lock):
// the only customer UPDATE the app sends is the receipt outcome.
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), emitReceipt: vi.fn() }));
vi.mock('@/lib/api/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'customer-1' } } }) },
  rpc: mocks.rpc,
  from: () => ({ update: (patch: unknown) => { mocks.update(patch); return { eq: async () => ({ error: null }) }; } }),
} }));
vi.mock('@/lib/stores/TenantContext', () => ({ useTenant: () => ({ companyId: 'restaurant-1' }) }));
vi.mock('@/lib/stores/AppSettingsContext', () => ({ useAppSettings: () => ({ deliveryFee: 2, language: 'it' }) }));
vi.mock('@/lib/stores/CartContext', () => ({ getCartItemUnitPrice: (item: { product: { price: number } }) => item.product.price }));
vi.mock('@/lib/fiscal/FiscalService', () => ({ getFiscalService: () => ({ emitReceipt: mocks.emitReceipt }) }));
vi.mock('@/lib/utils/storage', () => ({ readJsonStorage: () => null, writeJsonStorage: () => undefined }));

import { useCreateOrder } from '../../lib/hooks/useCreateOrder';
let submission: ReturnType<typeof useCreateOrder>;
function Probe() { submission = useCreateOrder(); return null; }
const input = {
  items: [{ product: { id: 'pizza-1', company_id: 'restaurant-1', name: 'Diavola', price: 6.5 }, quantity: 1, notes: '' }],
  orderType: 'take_away', skipFiscal: false, notes: 'Citofono rotto',
} as Parameters<typeof submission.mutateAsync>[0];
const allowed = ['fiscal_status', 'fiscal_external_id', 'pdf_url'];

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.update.mockReset();
  mocks.emitReceipt.mockReset();
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation(async (_name, args) => ({ data: { id: args.p_order.id, display_code: 'Ordine #1', total_amount: 6.5 }, error: null }));
});

describe('customer order updates after checkout', () => {
  it.each([
    ['receipt ok', () => mocks.emitReceipt.mockResolvedValue({ success: true, external_id: 'RT-1', pdf_url: 'https://x/r.pdf' })],
    ['receipt refused', () => mocks.emitReceipt.mockResolvedValue({ success: false, error: 'printer offline' })],
    ['receipt service throws', () => mocks.emitReceipt.mockRejectedValue(new Error('timeout'))],
  ])('%s: only the receipt outcome is updated (never notes or other columns)', async (_label, setup) => {
    setup();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    let root: ReturnType<typeof create>;
    await act(async () => { root = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
    await act(async () => { await submission.mutateAsync(input); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const patch = mocks.update.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(patch).every((k) => allowed.includes(k))).toBe(true);
    expect(patch).toHaveProperty('fiscal_status');
    await act(async () => root!.unmount());
  });
});
