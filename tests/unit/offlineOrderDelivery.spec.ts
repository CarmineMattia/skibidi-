import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { createElement } from 'react';

const mocks = vi.hoisted(() => ({
  submit: vi.fn(), storage: new Map<string, string>(), replace: vi.fn(),
  companyId: 'restaurant-1', router: { replace: vi.fn() },
}));
vi.mock('@/lib/hooks/useCreateOrder', () => ({ useCreateOrder: () => ({ mutateAsync: mocks.submit }) }));
vi.mock('@/lib/stores/TenantContext', () => ({ useTenant: () => ({ companyId: mocks.companyId }) }));
vi.mock('expo-router', () => ({ useRouter: () => mocks.router }));
vi.mock('react-native', () => ({ View: 'div', Text: 'span', ActivityIndicator: 'span', Alert: { alert: vi.fn() } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => mocks.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mocks.storage.set(key, value); },
} }));
import { OfflineQueueProvider, useOfflineQueue } from '../../lib/hooks/useOfflineQueue';
let queue: ReturnType<typeof useOfflineQueue>;
function Probe() { queue = useOfflineQueue(); return null; }
async function mount() {
  let root: ReturnType<typeof create>;
  await act(async () => { root = create(createElement(OfflineQueueProvider, null, createElement(Probe))); });
  return root!;
}
const input = { items: [{ product: { id: 'pizza', company_id: 'restaurant-1', name: 'Diavola', price: 6.5 }, quantity: 1 }], orderType: 'take_away', paymentMethod: 'cash' } as Parameters<typeof queue.addToQueue>[0];
beforeEach(() => {
  mocks.submit.mockReset(); mocks.storage.clear(); mocks.router.replace.mockReset(); mocks.companyId = 'restaurant-1';
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('window', new EventTarget());
});
describe('offline delivery', () => {
  it('actually submits on reconnect and navigates using the server order id', async () => {
    const root = await mount();
    await act(async () => { await queue.addToQueue(input); });
    const id = queue.pendingOrders[0].id;
    expect(mocks.submit).not.toHaveBeenCalled();
    mocks.submit.mockResolvedValue({ orderId: id });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ orderId: id, items: input.items }));
    expect(queue.pendingCount).toBe(0);
    expect(mocks.router.replace).toHaveBeenCalledWith(expect.stringContaining(`orderId=${id}`));
    await act(async () => root.unmount());
  });
  it('keeps failed orders and retries with the same id without inventing success', async () => {
    const root = await mount();
    await act(async () => { await queue.addToQueue(input); });
    const id = queue.pendingOrders[0].id;
    mocks.submit.mockRejectedValue(new Error('backend unavailable'));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(queue.pendingOrders[0]).toMatchObject({ id, syncAttempts: 1, error: 'backend unavailable' });
    expect(mocks.router.replace).not.toHaveBeenCalled();
    mocks.submit.mockResolvedValue({ orderId: id });
    await act(async () => { await queue.retryOrder(id); });
    expect(mocks.submit.mock.calls.map(call => call[0].orderId)).toEqual([id, id]);
    expect(queue.pendingCount).toBe(0);
    await act(async () => root.unmount());
  });
  it('does not send a stored order under another restaurant', async () => {
    const root = await mount();
    await act(async () => { await queue.addToQueue(input); });
    mocks.companyId = 'restaurant-2';
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(queue.pendingCount).toBe(1);
    await act(async () => root.unmount());
  });
});
