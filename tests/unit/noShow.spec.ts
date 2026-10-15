import { describe, expect, test, vi } from 'vitest';
import { canMarkNoShow, fetchMarkedNoShowOrderIds, markOrderNoShow, mergeMarkedOrderIds, noShowResultMessage } from '../../lib/orders/noShow';

describe('non ritirato', () => {
  test('solo ordini pronti con account cliente', () => {
    expect(canMarkNoShow({ id: 'o1', status: 'ready', customer_id: 'c1' })).toBe(true);
    expect(canMarkNoShow({ id: 'o1', status: 'ready', customer_id: null })).toBe(false);
    for (const status of ['pending', 'preparing', 'delivered', 'cancelled']) {
      expect(canMarkNoShow({ id: 'o1', status, customer_id: 'c1' })).toBe(false);
    }
  });

  test('chiama mark_order_no_show con id e nota', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { customer_id: 'c1', no_show_count: 2, blocked: false }, error: null });
    const result = await markOrderNoShow({ rpc }, 'o1', 'non è passato');
    expect(rpc).toHaveBeenCalledWith('mark_order_no_show', { p_order_id: 'o1', p_note: 'non è passato' });
    expect(result).toEqual({ customer_id: 'c1', no_show_count: 2, blocked: false });
    await markOrderNoShow({ rpc }, 'o2');
    expect(rpc).toHaveBeenLastCalledWith('mark_order_no_show', { p_order_id: 'o2', p_note: null });
  });

  test('errori del server e risposte inattese', async () => {
    const denied = vi.fn().mockResolvedValue({ data: null, error: { message: 'Only an admin can mark a no-show' } });
    await expect(markOrderNoShow({ rpc: denied }, 'o1')).rejects.toThrow('Only an admin');
    const empty = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(markOrderNoShow({ rpc: empty }, 'o1')).rejects.toThrow('risposta inattesa');
  });

  test('messaggio per l\'admin', () => {
    expect(noShowResultMessage({ customer_id: 'c', no_show_count: 1, blocked: false })).toBe('Segnato. Il cliente ha 1 mancato ritiro.');
    expect(noShowResultMessage({ customer_id: 'c', no_show_count: 3, blocked: true })).toBe('Segnato. Cliente bloccato (3 mancati ritiri).');
  });

  test('dopo il successo il bottone sparisce e resta nascosto dopo un refetch', async () => {
    const order = { id: 'o1', status: 'ready', customer_id: 'c1' };
    // Subito dopo il successo: solo stato locale.
    const local = new Set(['o1']);
    expect(canMarkNoShow(order, mergeMarkedOrderIds(undefined, local))).toBe(false);
    // Dopo un refetch (o un ricaricamento, stato locale perso): record sul server.
    const inFn = vi.fn().mockResolvedValue({ data: [{ order_id: 'o1' }], error: null });
    const select = vi.fn(() => ({ in: inFn }));
    const client = { from: vi.fn(() => ({ select })) };
    const server = await fetchMarkedNoShowOrderIds(client, ['o1', 'o2']);
    expect(client.from).toHaveBeenCalledWith('order_no_shows');
    expect(inFn).toHaveBeenCalledWith('order_id', ['o1', 'o2']);
    expect(canMarkNoShow(order, mergeMarkedOrderIds(server, new Set()))).toBe(false);
    expect(canMarkNoShow({ ...order, id: 'o2' }, mergeMarkedOrderIds(server, new Set()))).toBe(true);
  });

  test('nessuna query senza ordini, errori propagati', async () => {
    const client = { from: vi.fn() };
    expect(await fetchMarkedNoShowOrderIds(client as never, [])).toEqual(new Set());
    expect(client.from).not.toHaveBeenCalled();
    const failing = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: 'denied' } }) }) }) };
    await expect(fetchMarkedNoShowOrderIds(failing, ['o1'])).rejects.toThrow('denied');
  });
});
