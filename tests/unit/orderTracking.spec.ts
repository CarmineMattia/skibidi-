import { describe, expect, it } from 'vitest';
import { getTrackingSummary } from '../../lib/utils/orderTracking';

describe('orderTracking', () => {
  it('shows explicit pending confirmation message', () => {
    const summary = getTrackingSummary('🍕 Margherita #1', 'delivery', 'pending');
    expect(summary).toBe('Il tuo ordine è in attesa di conferma. Non chiudere la pagina.');
  });

  it('keeps ready copy for take away orders', () => {
    const summary = getTrackingSummary('🍕 Bufala #9', 'take_away', 'ready');
    expect(summary).toContain('pronto per il ritiro');
  });
});
