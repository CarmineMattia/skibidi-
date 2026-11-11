import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canReadCustomerInsights,
  consentAllowsPersonalisation,
  consentErrorMessage,
  emptyConsentChoices,
  formatConsentHistoryLine,
  formatHour,
  parseInactiveCustomers,
  parseInactiveDays,
  parseMyConsent,
  parsePersonalisedOffer,
  parseTopProducts,
  parseWeekHourStats,
  personalisedOfferLine,
  weekdayLabel,
} from '../../lib/privacy/consent';
import { CONSENT_DRAFT_BODY, CONSENT_DRAFT_VERSION } from '../../lib/privacy/consentDraft';

const root = path.resolve(__dirname, '../..');

describe('bozza di informativa', () => {
  it('è la stessa nel documento, nella migration e nell’app', () => {
    const doc = fs.readFileSync(path.join(root, 'docs/PRIVACY-CONSENSO-BOZZA.md'), 'utf8');
    const sql = fs.readFileSync(
      path.join(root, 'supabase/migrations/20261111220000_gdpr_consent_profiling.sql'),
      'utf8',
    );
    const seeded = sql.match(/\$consent_body\$\n([\s\S]*?)\n\$consent_body\$/);
    expect(seeded?.[1]).toBe(CONSENT_DRAFT_BODY);
    expect(doc).toContain(CONSENT_DRAFT_BODY);
    expect(CONSENT_DRAFT_BODY).toContain('BOZZA DA FAR RILEGGERE');
    expect(CONSENT_DRAFT_BODY).toContain('NON È UN PARERE LEGALE');
    expect(CONSENT_DRAFT_BODY).toContain('Pizzeria Ambrosia');
    expect(CONSENT_DRAFT_BODY).toContain('[RAGIONE SOCIALE]');
    expect(CONSENT_DRAFT_BODY).toContain('[PARTITA IVA]');
    expect(CONSENT_DRAFT_BODY).toContain('[SEDE LEGALE]');
    expect(CONSENT_DRAFT_BODY).toContain('[EMAIL PRIVACY]');
    expect(CONSENT_DRAFT_BODY).not.toContain('12345678901');
    expect(sql).toContain(CONSENT_DRAFT_VERSION);
    expect(sql).not.toMatch(/create\s+(or\s+replace\s+)?function\s+public\.create_order_with_items/i);
  });
});

describe('chi vede cosa', () => {
  it('andamento e inattivi li vedono admin e proprietario della piattaforma', () => {
    expect(canReadCustomerInsights({ isAdmin: true, isPlatformOwner: false })).toBe(true);
    expect(canReadCustomerInsights({ isAdmin: false, isPlatformOwner: true })).toBe(true);
    expect(canReadCustomerInsights({ isAdmin: false, isPlatformOwner: false })).toBe(false);
  });

  it('l’offerta su misura chiede entrambi i consensi', () => {
    const base = emptyConsentChoices();
    expect(consentAllowsPersonalisation(base)).toBe(false);
    expect(consentAllowsPersonalisation(base.map((choice) => ({ ...choice, granted: choice.purpose === 'marketing' })))).toBe(false);
    expect(consentAllowsPersonalisation(base.map((choice) => ({ ...choice, granted: true })))).toBe(true);
  });
});

describe('risposte delle RPC', () => {
  it('tiene le caselle vuote se non c’è una riga, e non mostra un prodotto senza consenso', () => {
    const choices = parseMyConsent([
      { purpose: 'marketing', granted: 'true', document_version: 'x', updated_at: '2026-11-01T10:00:00Z' },
    ]);
    expect(choices.find((choice) => choice.purpose === 'marketing')?.granted).toBe(false);
    expect(choices.find((choice) => choice.purpose === 'profiling')?.granted).toBe(false);
    expect(parsePersonalisedOffer([{ has_consent: false, product_name: 'Margherita', quantity_total: '4' }])).toEqual({
      hasConsent: false,
      productName: null,
      quantity: 0,
    });
    expect(
      personalisedOfferLine({ hasConsent: true, productName: 'Margherita', quantity: 3 }),
    ).toBe('In base ai tuoi ordini, la tua preferita è Margherita (3 pezzi).');
  });

  it('normalizza elenco, orari e prodotti senza inventare persone', () => {
    expect(
      parseInactiveCustomers([
        { customer_id: 'abc', full_name: ' Ada ', email: 'ada@example.test', last_order_at: '2026-08-01T10:00:00Z', days_since_order: '90' },
        { full_name: 'Senza id' },
      ]),
    ).toEqual([
      {
        customerId: 'abc',
        fullName: ' Ada ',
        email: 'ada@example.test',
        lastOrderAt: '2026-08-01T10:00:00Z',
        daysSinceOrder: 90,
      },
    ]);
    expect(parseWeekHourStats([{ weekday: '2', hour: 15, order_count: '4' }, { weekday: 0, hour: 3, order_count: 1 }])).toEqual([
      { weekday: 2, hour: 15, orderCount: 4 },
    ]);
    expect(parseTopProducts([{ product_name: 'Margherita', quantity_total: '9' }])).toEqual([
      { productName: 'Margherita', quantityTotal: 9 },
    ]);
    expect(weekdayLabel(2)).toBe('Martedì');
    expect(formatHour(15)).toBe('15:00');
  });

  it('accetta solo una soglia intera tra 7 e 730 giorni', () => {
    expect(parseInactiveDays('60')).toBe(60);
    expect(parseInactiveDays('7')).toBe(7);
    expect(parseInactiveDays('730')).toBe(730);
    expect(parseInactiveDays('6')).toBeNull();
    expect(parseInactiveDays('731')).toBeNull();
    expect(parseInactiveDays('60.5')).toBeNull();
    expect(parseInactiveDays('')).toBeNull();
  });

  it('traduce gli errori senza passi operativi', () => {
    expect(consentErrorMessage('CONSENT_VERSION_STALE', '22023')).toContain('informativa');
    expect(consentErrorMessage('CONSENT_FORBIDDEN', '42501')).toContain('tuo consenso');
    expect(consentErrorMessage('Could not find the function', 'PGRST202')).toContain('non è stata salvata');
    expect(formatConsentHistoryLine({
      purpose: 'profiling',
      granted: false,
      documentVersion: CONSENT_DRAFT_VERSION,
      createdAt: '2026-11-11T18:00:00Z',
    })).toContain('consenso revocato');
  });
});

describe('caselle non pre-spuntate', () => {
  it('parte da due scelte vuote', () => {
    const choices = emptyConsentChoices();
    expect(choices.map((choice) => choice.granted)).toEqual([false, false]);
    expect(choices.map((choice) => choice.purpose)).toEqual(['marketing', 'profiling']);
  });
});
