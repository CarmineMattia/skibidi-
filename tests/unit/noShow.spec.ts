import { describe, expect, test, vi } from 'vitest';
import { canMarkNoShow, markOrderNoShow, noShowResultMessage } from '../../lib/orders/noShow';

describe('non ritirato', () => {
  test('solo ordini pronti con account cliente', () => {
    expect(canMarkNoShow({ status: 'ready', customer_id: 'c1' })).toBe(true);
    expect(canMarkNoShow({ status: 'ready', customer_id: null })).toBe(false);
    for (const status of ['pending', 'preparing', 'delivered', 'cancelled']) {
      expect(canMarkNoShow({ status, customer_id: 'c1' })).toBe(false);
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
});
