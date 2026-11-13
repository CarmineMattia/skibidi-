import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { requestOrderConfirmationEmail } from '../../lib/utils/orderConfirmationRequest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), storage: new Map<string, unknown>() }));
vi.mock('@/lib/api/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'customer-1' } } }) },
  rpc: mocks.rpc,
  functions: { invoke: mocks.invoke },
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
const input = {
  items: [{ product: { id: 'pizza-1', company_id: 'restaurant-1', name: 'Diavola', price: 6.5 }, quantity: 1, notes: '' }],
  orderType: 'take_away', skipFiscal: true,
} as Parameters<typeof submission.mutateAsync>[0];

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.storage.clear();
  mocks.rpc.mockReset();
  mocks.invoke.mockReset();
  mocks.invoke.mockResolvedValue({ data: { ok: true, sent: true }, error: null });
});

async function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let root: ReturnType<typeof create>;
  await act(async () => { root = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  return root!;
}

describe('richiesta email dopo l’ordine', () => {
  it('non rilancia se il provider rifiuta o non risponde', () => {
    expect(() => requestOrderConfirmationEmail('not-an-id', mocks.invoke)).not.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
    mocks.invoke.mockImplementation(() => { throw new Error('functions missing'); });
    expect(() => requestOrderConfirmationEmail('00000000-0000-4000-8000-0000000000ab', mocks.invoke)).not.toThrow();
    mocks.invoke.mockRejectedValue(new Error('network'));
    expect(() => requestOrderConfirmationEmail('00000000-0000-4000-8000-0000000000ab', mocks.invoke)).not.toThrow();
    mocks.invoke.mockReturnValue(new Promise(() => undefined));
    expect(() => requestOrderConfirmationEmail('00000000-0000-4000-8000-0000000000ab', mocks.invoke)).not.toThrow();
  });

  it('dopo create_order_with_items chiede l’email e non aspetta l’esito', async () => {
    let release: (value: unknown) => void = () => undefined;
    mocks.invoke.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    mocks.rpc.mockImplementation(async (_name, args) => ({
      data: { id: args.p_order.id, display_code: 'Ordine #4', total_amount: 6.5 },
      error: null,
    }));
    const root = await mount();
    let result: Awaited<ReturnType<typeof submission.mutateAsync>> | undefined;
    await act(async () => { result = await submission.mutateAsync(input); });
    expect(result?.orderId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('send-order-confirmation', { body: { orderId: result!.orderId } });
    expect(submission.isSuccess).toBe(true);
    release({ data: { ok: true, sent: true }, error: null });
    await act(async () => root.unmount());
  });

  it('un errore dell’email non fa fallire l’ordine, e un ordine rifiutato non parte', async () => {
    mocks.invoke.mockRejectedValue(new Error('resend down'));
    mocks.rpc.mockImplementation(async (_name, args) => ({
      data: { id: args.p_order.id, display_code: 'Ordine #4', total_amount: 6.5 },
      error: null,
    }));
    let root = await mount();
    await act(async () => {
      await expect(submission.mutateAsync(input)).resolves.toMatchObject({ fiscalStatus: 'pending' });
    });
    await act(async () => root.unmount());

    mocks.invoke.mockClear();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'server unavailable' } });
    root = await mount();
    await act(async () => { await expect(submission.mutateAsync(input)).rejects.toThrow(); });
    expect(mocks.invoke).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
