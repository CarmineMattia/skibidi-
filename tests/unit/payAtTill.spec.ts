import { describe, expect, test } from 'vitest';
import { PAY_AT_TILL_LABEL_IT, PAY_AT_TILL_METHOD, PAY_AT_TILL_NOTE } from '../../lib/payments/payAtTill';

describe('pagamento alla cassa (v1)', () => {
  test('metodo fiscale compatibile', () => {
    expect(PAY_AT_TILL_METHOD).toBe('cash');
    expect(PAY_AT_TILL_LABEL_IT).toBe('Paghi alla cassa al ritiro');
  });
  test('nota ordine leggibile dalla stampa', () => {
    expect(PAY_AT_TILL_NOTE.toLowerCase()).toContain('pagamento: alla cassa');
  });
});
