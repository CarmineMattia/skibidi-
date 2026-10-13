import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mocks = vi.hoisted(() => ({ single: vi.fn(), eq: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/stores/TenantContext', () => ({ useTenant: () => ({ companyId: 'restaurant-1' }) }));
vi.mock('@/lib/api/supabase', () => ({ supabase: { from: () => {
  const query = { update: (input: unknown) => { mocks.update(input); return query; }, eq: (...args: unknown[]) => { mocks.eq(...args); return query; }, select: () => query, single: mocks.single };
  return query;
} } }));
import { useUpdateOrderStatus } from '../../lib/hooks/useUpdateOrderStatus';
let mutation: ReturnType<typeof useUpdateOrderStatus>;
function Probe() { mutation = useUpdateOrderStatus(); return null; }
async function mount() {
  let root: ReturnType<typeof create>;
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () => { root = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  return root!;
}
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); mocks.single.mockReset(); mocks.eq.mockClear(); });
describe('verified kitchen acceptance', () => {
  it('rejects a successful HTTP response that did not update any row', async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    const root = await mount();
    await act(async () => { await expect(mutation.mutateAsync({ orderId: 'order-1', status: 'preparing' })).rejects.toThrow('non è stato salvato'); });
    expect(mocks.eq).toHaveBeenCalledWith('company_id', 'restaurant-1');
    await act(async () => root.unmount());
  });
  it('confirms acceptance only from the returned saved row', async () => {
    mocks.single.mockResolvedValue({ data: { id: 'order-1', status: 'preparing' }, error: null });
    const root = await mount();
    await act(async () => { await expect(mutation.mutateAsync({ orderId: 'order-1', status: 'preparing' })).resolves.toMatchObject({ id: 'order-1', status: 'preparing' }); });
    await act(async () => root.unmount());
  });
});
