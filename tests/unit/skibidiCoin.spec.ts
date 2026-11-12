import { describe, expect, test } from 'vitest';
import * as loyalty from '../../lib/loyalty/points';

describe('Skibidi Coin fase 1', () => {
  test('un punto per euro intero di merce, senza i centesimi e senza la consegna', () => {
    expect(loyalty.earnPoints(12.9)).toBe(12);
    expect(loyalty.earnPoints(0.4)).toBe(0);
    expect(loyalty.earnPoints(20)).toBe(20);
    expect(loyalty.earnPoints(-3)).toBe(0);
    expect(loyalty.displayedCheckoutTotal(12.9, 3, 100)).toBe(15.9);
  });

  test('100 punti valgono 5 euro e non si chiede più del saldo o della merce', () => {
    expect(loyalty.discountEur(100)).toBe(5);
    expect(loyalty.discountEur(250)).toBe(10);
    expect(loyalty.discountEur(50)).toBe(0);
    expect(loyalty.maxRedeemablePoints(112, 100, 20, 5)).toBe(100);
    expect(loyalty.maxRedeemablePoints(250, 100, 4, 5)).toBe(0);
    expect(loyalty.maxRedeemablePoints(50, 100, 30, 5)).toBe(0);
    expect(loyalty.clampPointsRequest(100, 100, 100)).toBe(100);
    expect(loyalty.clampPointsRequest(0, 200, 100)).toBe(0);
  });

  test('la richiesta resta da confermare in cassa e il totale non scende', () => {
    expect(loyalty.pointsRequestCaption()).toBe('da confermare in cassa');
    expect(loyalty.displayedCheckoutTotal(25, 0, 100)).toBe(25);
    expect(loyalty.displayedCheckoutTotal(20, 5, 100)).toBe(25);
  });

  test('in scadenza vuol dire entro 30 giorni, non già scaduto', () => {
    const now = new Date('2026-11-12T12:00:00.000Z');
    expect(loyalty.isExpiringSoon('2026-12-01T12:00:00.000Z', now)).toBe(true);
    expect(loyalty.isExpiringSoon('2026-12-13T12:00:00.000Z', now)).toBe(false);
    expect(loyalty.isExpiringSoon('2026-11-01T12:00:00.000Z', now)).toBe(false);
    expect(loyalty.isExpiringSoon(null, now)).toBe(false);
  });

  test('solo un cliente con il programma acceso può chiedere i punti', () => {
    expect(loyalty.canRequestPoints({ authenticated: true, role: 'customer', enabled: true })).toBe(true);
    expect(loyalty.canRequestPoints({ authenticated: true, role: 'kiosk', enabled: true })).toBe(false);
    expect(loyalty.canRequestPoints({ authenticated: true, role: 'admin', enabled: true })).toBe(false);
    expect(loyalty.canRequestPoints({ authenticated: false, role: 'customer', enabled: true })).toBe(false);
    expect(loyalty.canRequestPoints({ authenticated: true, role: 'customer', enabled: false })).toBe(false);
  });

  test('lo storico parla italiano e il riepilogo ha i valori di Carmine', () => {
    expect(loyalty.ledgerTypeLabel('earn_order')).toBe('Accredito ordine');
    expect(loyalty.ledgerTypeLabel('redeem')).toBe('Sconto in cassa');
    expect(loyalty.ledgerTypeLabel('gift')).toBe('Omaggio');
    expect(loyalty.ledgerTypeLabel('reversal')).toBe('Storno');
    expect(loyalty.ledgerTypeLabel('expire')).toBe('Scadenza');
    expect(loyalty.parseLoyaltySummary({
      enabled: true,
      balance: 112,
      expiring_soon: 20,
      next_expires_at: '2027-11-12T00:00:00.000Z',
      points_per_euro: 1,
      points_per_redeem_unit: 100,
      redeem_value_eur: 5,
      expiry_months: 12,
      company_id: '00000000-0000-0000-0000-000000000001',
    })).toMatchObject({
      enabled: true,
      balance: 112,
      expiringSoon: 20,
      pointsPerRedeemUnit: 100,
      redeemValueEur: 5,
      expiryMonths: 12,
    });
    expect(loyalty.parseLoyaltySummary(null)).toMatchObject({ enabled: false, balance: 0 });
  });

  test('fase 1 non espone un acquisto di punti', () => {
    expect(Object.keys(loyalty).sort()).toEqual([
      'LOYALTY_RULES',
      'POINTS_REQUEST_CAPTION',
      'canRequestPoints',
      'clampPointsRequest',
      'discountEur',
      'displayedCheckoutTotal',
      'earnPoints',
      'isExpiringSoon',
      'ledgerTypeLabel',
      'maxRedeemablePoints',
      'parseLoyaltySummary',
      'pointsRequestCaption',
    ]);
  });
});
