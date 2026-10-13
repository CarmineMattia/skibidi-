import { describe, expect, it } from 'vitest';
import { ORDER_STATUS_LABEL_IT, canTransition, getNextForwardStatus, isTerminalStatus } from '../../lib/utils/orderStatus';
import { getTrackingSteps, getTrackingBadge } from '../../lib/utils/orderTracking';
import { buildAdminOrderRealtimeNotice } from '../../lib/utils/orderRealtimeNotifications';

describe('manual approval order states', () => {
  it('labels every state in Italian', () => {
    expect(ORDER_STATUS_LABEL_IT).toEqual({
      pending: 'In attesa di conferma', accepted: 'Accettato', preparing: 'In preparazione', ready: 'Pronto',
      delivered: 'Ritirato e pagato', rejected: 'Rifiutato', cancelled: 'Annullato',
    });
  });
  it('never lets a pending order skip manual acceptance', () => {
    expect(canTransition('pending', 'preparing')).toBe(false);
    expect(canTransition('pending', 'ready')).toBe(false);
    expect(canTransition('pending', 'accepted')).toBe(true);
    expect(canTransition('pending', 'rejected')).toBe(true);
    expect(getNextForwardStatus('pending')).toBeNull();
  });
  it('walks accepted → preparing → ready → ritirato e pagato', () => {
    expect(getNextForwardStatus('accepted')).toBe('preparing');
    expect(getNextForwardStatus('preparing')).toBe('ready');
    expect(getNextForwardStatus('ready')).toBe('delivered');
    expect(canTransition('accepted', 'rejected')).toBe(false);
  });
  it('treats delivered, rejected and cancelled as terminal', () => {
    for (const s of ['delivered', 'rejected', 'cancelled'] as const) {
      expect(isTerminalStatus(s)).toBe(true);
      expect(canTransition(s, 'pending')).toBe(false);
    }
  });
  it('shows accepted as confirmed but not yet preparing to the customer', () => {
    const steps = getTrackingSteps('take_away', 'accepted');
    expect(steps.find((s) => s.key === 'confirmed')).toMatchObject({ label: 'Accettato', state: 'completed' });
    expect(steps.find((s) => s.key === 'preparing')?.state).toBe('upcoming');
    expect(getTrackingBadge('take_away', 'rejected').label).toBe('Ordine rifiutato');
    expect(getTrackingBadge('take_away', 'delivered').label).toBe('Ritirato e pagato');
  });
  it('notifies admins on acceptance and rejection', () => {
    expect(buildAdminOrderRealtimeNotice({ previousStatus: 'pending', nextStatus: 'accepted', orderCode: 'X' })?.title).toBe('Ordine accettato');
    expect(buildAdminOrderRealtimeNotice({ previousStatus: 'pending', nextStatus: 'rejected', orderCode: 'X' })?.title).toBe('Ordine rifiutato');
  });
});
