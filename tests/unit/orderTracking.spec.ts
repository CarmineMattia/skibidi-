import { describe, expect, it } from 'vitest';
import { getOrderConfirmation, getTrackingBadge, getTrackingSteps, getTrackingSummary } from '../../lib/utils/orderTracking';

describe('orderTracking', () => {
  it('shows explicit pending confirmation message', () => {
    const summary = getTrackingSummary('🍕 Margherita #1', 'delivery', 'pending');
    expect(summary).toBe('Il tuo ordine è stato inviato al sistema della pizzeria. La cucina deve ancora accettarlo.');
  });

  it('keeps ready copy for take away orders', () => {
    const summary = getTrackingSummary('🍕 Bufala #9', 'take_away', 'ready');
    expect(summary).toContain('pronto per il ritiro');
  });

  it('marks eat-in ready with Pronto active and Preparato completed', () => {
    const steps = getTrackingSteps('eat_in', 'ready');
    expect(steps.map((step) => ({ key: step.key, label: step.label, state: step.state, icon: step.icon }))).toEqual([
      { key: 'received', label: 'Ordine inviato', state: 'completed', icon: 'check-circle' },
      { key: 'confirmed', label: 'Accettato', state: 'completed', icon: 'check-circle' },
      { key: 'preparing', label: 'Preparato', state: 'completed', icon: 'check-circle' },
      { key: 'ready', label: 'Pronto', state: 'active', icon: 'bell' },
    ]);
  });
});


describe('honest customer confirmation', () => {
  it('does not call a pending order accepted or preparing', () => {
    expect(getOrderConfirmation('pending').accepted).toBe(false);
    expect(getTrackingBadge('delivery', 'pending').label).toBe('In attesa di accettazione');
    expect(getTrackingSteps('delivery', 'pending').find(step => step.key === 'confirmed')).toMatchObject({ label: 'In attesa di accettazione', state: 'active' });
  });
  it('does not claim success if tracking is unavailable', () => {
    expect(getOrderConfirmation(null).accepted).toBe(false);
    expect(getTrackingSteps('delivery', null)).toEqual([]);
    expect(getTrackingSummary('test', 'delivery', null)).toContain('Non è possibile verificare');
  });
  it('only confirms acceptance from a saved kitchen status', () => {
    expect(getOrderConfirmation('preparing')).toMatchObject({ accepted: true, title: 'Ordine accettato' });
    expect(getOrderConfirmation('cancelled')).toMatchObject({ accepted: false, title: 'Ordine non accettato' });
  });
});
