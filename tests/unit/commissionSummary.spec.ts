import { describe, expect, it } from 'vitest';
import {
  canEditCommissionRate,
  canReadCommissionSummary,
  commissionErrorMessage,
  commissionPanelState,
  formatCommissionMonth,
  formatEuro,
  formatRateBreakdown,
  parseCommissionMonths,
  parseDateInput,
  parseRateInput,
} from '../../lib/utils/commissionSummary';

describe('accesso al resoconto', () => {
  it('lo leggono titolare (admin) e proprietario della piattaforma', () => {
    expect(canReadCommissionSummary({ isAdmin: true, isPlatformOwner: false })).toBe(true);
    expect(canReadCommissionSummary({ isAdmin: false, isPlatformOwner: true })).toBe(true);
    expect(canReadCommissionSummary({ isAdmin: true, isPlatformOwner: true })).toBe(true);
  });

  it('cliente, cassa e anonimo non lo leggono', () => {
    expect(canReadCommissionSummary({ isAdmin: false, isPlatformOwner: false })).toBe(false);
  });

  it('solo il proprietario della piattaforma cambia l’aliquota', () => {
    expect(canEditCommissionRate(true)).toBe(true);
    expect(canEditCommissionRate(false)).toBe(false);
  });
});

describe('formato italiano', () => {
  it('formatta euro, mese e aliquote senza ricalcolare', () => {
    expect(formatEuro(140)).toContain('140,00');
    expect(formatEuro(140)).toContain('€');
    expect(formatCommissionMonth('2026-11-01').toLowerCase()).toContain('novembre');
    expect(formatCommissionMonth('2026-11-01')).toContain('2026');
    expect(formatRateBreakdown([{ rate_percent: 5, order_count: 2, gross_total: 100, commission_total: 5 }])).toBe('5%');
    expect(
      formatRateBreakdown([
        { rate_percent: 5, order_count: 1, gross_total: 100, commission_total: 5 },
        { rate_percent: 10, order_count: 2, gross_total: 40, commission_total: 4 },
      ])
    ).toBe('5% su 1 ordine, 10% su 2 ordini');
    expect(
      formatRateBreakdown([
        { rate_percent: 5, order_count: 1, gross_total: 100, commission_total: 5, effective_from: '2026-11-01T12:00:00.000Z' },
        { rate_percent: 5, order_count: 1, gross_total: 40, commission_total: 2, effective_from: '2026-11-21T12:00:00.000Z' },
      ])
    ).toBe('5% dal 01/11/2026 su 1 ordine, 5% dal 21/11/2026 su 1 ordine');
  });

  it('accetta la percentuale con la virgola e rifiuta i valori fuori scala', () => {
    expect(parseRateInput('5')).toBe(5);
    expect(parseRateInput('4,5')).toBe(4.5);
    expect(parseRateInput('4.25')).toBe(4.25);
    expect(parseRateInput('100')).toBe(100);
    expect(parseRateInput('0')).toBe(0);
    expect(parseRateInput('4.555')).toBeNull();
    expect(parseRateInput('-1')).toBeNull();
    expect(parseRateInput('101')).toBeNull();
    expect(parseRateInput('cinque')).toBeNull();
  });

  it('accetta solo una data di calendario', () => {
    expect(parseDateInput('2026-12-01')).toBe('2026-12-01');
    expect(parseDateInput('2026-02-31')).toBeNull();
    expect(parseDateInput('01/12/2026')).toBeNull();
  });
});

describe('risposta della RPC', () => {
  it('normalizza i numeric arrivati come stringa e le aliquote json', () => {
    const [month] = parseCommissionMonths([
      {
        month_start: '2026-10-01',
        order_count: '2',
        gross_total: '140.00',
        commission_total: '9.00',
        unrated_order_count: '0',
        unrated_gross: '0',
        is_preview: false,
        generated_at: '2026-11-11T10:00:00.000Z',
        rates: '[{"rate_percent":5,"order_count":1,"gross_total":100,"commission_total":5,"effective_from":"2026-10-01T00:00:00.000Z"}]',
      },
    ]);
    expect(month.order_count).toBe(2);
    expect(month.gross_total).toBe(140);
    expect(month.commission_total).toBe(9);
    expect(month.is_preview).toBe(false);
    expect(month.rates[0].rate_percent).toBe(5);
    expect(month.rates[0].effective_from).toBe('2026-10-01T00:00:00.000Z');
  });

  it('traduce gli errori senza mostrare cifre', () => {
    expect(commissionErrorMessage('COMMISSION_FORBIDDEN')).toBe('Non hai accesso a questo resoconto.');
    expect(commissionErrorMessage('missing', 'PGRST202')).toContain('migration');
    expect(commissionErrorMessage('COMMISSION_RATE_BACKDATE')).toContain('passato');
    expect(commissionErrorMessage('boom', undefined, 'rates')).toBe('Impossibile leggere le aliquote. Riprova.');
  });
});

describe('stati della schermata', () => {
  it('mostra errore, elenco vuoto o mesi', () => {
    expect(commissionPanelState({ isLoading: true, isError: false, count: 0 })).toBe('loading');
    expect(commissionPanelState({ isLoading: false, isError: true, count: 0 })).toBe('error');
    expect(commissionPanelState({ isLoading: false, isError: false, count: 0 })).toBe('empty');
    expect(commissionPanelState({ isLoading: false, isError: false, count: 2 })).toBe('ready');
  });
});
