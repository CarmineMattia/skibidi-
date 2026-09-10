import { describe, expect, it } from 'vitest';
import { getTrackingSteps, getTrackingSummary } from '../../lib/utils/orderTracking';

describe('orderTracking', () => {
  it('shows explicit pending confirmation message', () => {
    const summary = getTrackingSummary('🍕 Margherita #1', 'delivery', 'pending');
    expect(summary).toBe('Il tuo ordine è in attesa di conferma. Non chiudere la pagina.');
  });

  it('keeps ready copy for take away orders', () => {
    const summary = getTrackingSummary('🍕 Bufala #9', 'take_away', 'ready');
    expect(summary).toContain('pronto per il ritiro');
  });

  it('marks eat-in ready with Pronto active and Preparato completed', () => {
    const steps = getTrackingSteps('eat_in', 'ready');
    expect(steps.map((step) => ({ key: step.key, label: step.label, state: step.state, icon: step.icon }))).toEqual([
      { key: 'confirmed', label: 'Confermato', state: 'completed', icon: 'check-circle' },
      { key: 'preparing', label: 'Preparato', state: 'completed', icon: 'check-circle' },
      { key: 'ready', label: 'Pronto', state: 'active', icon: 'bell' },
    ]);
  });
});
