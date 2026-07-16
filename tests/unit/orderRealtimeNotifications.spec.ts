import { describe, expect, it } from 'vitest';
import { buildAdminOrderRealtimeNotice } from '../../lib/utils/orderRealtimeNotifications';

describe('orderRealtimeNotifications', () => {
  it('creates pending notice for brand-new order', () => {
    const notice = buildAdminOrderRealtimeNotice({
      previousStatus: null,
      nextStatus: 'pending',
      orderCode: '🍕 Margherita #2',
    });

    expect(notice).toEqual({
      title: 'Nuovo ordine in arrivo',
      message: '🍕 Margherita #2 è in attesa di conferma in cucina.',
      tone: 'warning',
    });
  });

  it('creates notice for status transition', () => {
    const notice = buildAdminOrderRealtimeNotice({
      previousStatus: 'pending',
      nextStatus: 'preparing',
      orderCode: '🍕 Bufala #7',
    });

    expect(notice).toEqual({
      title: 'Ordine preso in carico',
      message: '🍕 Bufala #7 è passato in preparazione.',
      tone: 'info',
    });
  });

  it('returns null when status does not change', () => {
    const notice = buildAdminOrderRealtimeNotice({
      previousStatus: 'ready',
      nextStatus: 'ready',
      orderCode: '🍕 Diavola #3',
    });

    expect(notice).toBeNull();
  });
});
