import { describe, expect, it, vi } from 'vitest';
import {
  RECEIPT_ERROR_MESSAGES,
  claimToFiscalData,
  fiscalProviderLabel,
  isReceiptIssuable,
  issueReceipt,
  receiptErrorMessage,
  type ReceiptClaim,
  type RpcClient,
} from '@/lib/fiscal/issueReceipt';

const ORDER = '00000000-0000-0000-0000-000000000104';
const CLAIM: ReceiptClaim = {
  order_id: ORDER,
  already_issued: false,
  claim_id: 'claim-1',
  display_code: 'A4',
  customer_name: 'Mario',
  created_at: '2026-10-23T12:00:00Z',
  fiscal_status: 'pending',
  total_amount: 12.5,
  items: [
    { product_id: 'p1', name: 'Margherita', quantity: 2, unit_price: 5, total_price: 10 },
    { product_id: null, name: '', quantity: 1, unit_price: 2.5, total_price: 2.5 },
  ],
};

type Call = { fn: string; args: Record<string, unknown> };

function fakeRpc(responses: Record<string, { data?: unknown; error?: { message: string; details?: string } | null }>) {
  const calls: Call[] = [];
  const client: RpcClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      const r = responses[fn] ?? { data: null, error: { message: 'unexpected' } };
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
  };
  return { client, calls };
}

describe('claimToFiscalData', () => {
  it('uses the server data, in cents, with 22% VAT', () => {
    const data = claimToFiscalData(CLAIM, 'card');
    expect(data.order_id).toBe(ORDER);
    expect(data.customer_name).toBe('Mario');
    expect(data.total_amount).toBe(1250);
    expect(data.total_vat).toBe(Math.round((1250 * 22) / 122));
    expect(data.payment_method).toBe('card');
    expect(data.items).toEqual([
      { product_id: 'p1', name: 'Margherita', quantity: 2, unit_price: 500, total_price: 1000, vat_rate: 22 },
      { product_id: '', name: 'Prodotto', quantity: 1, unit_price: 250, total_price: 250, vat_rate: 22 },
    ]);
  });
});

describe('issueReceipt', () => {
  it('claims, emits with the claimed data and records success', async () => {
    const { client, calls } = fakeRpc({
      claim_order_receipt: { data: CLAIM },
      record_order_receipt: { data: { fiscal_status: 'success', external_id: 'MOCK-1', pdf_url: 'https://x/r.pdf' } },
    });
    const emitter = { emitReceipt: vi.fn().mockResolvedValue({ success: true, external_id: 'MOCK-1', pdf_url: 'https://x/r.pdf' }) };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash' });

    expect(result).toEqual({ outcome: 'issued', externalId: 'MOCK-1', pdfUrl: 'https://x/r.pdf' });
    expect(emitter.emitReceipt).toHaveBeenCalledWith(expect.objectContaining({ order_id: ORDER, total_amount: 1250 }));
    expect(calls.map((c) => c.fn)).toEqual(['claim_order_receipt', 'record_order_receipt']);
    expect(calls[1].args).toEqual({
      p_order_id: ORDER,
      p_claim_id: 'claim-1',
      p_success: true,
      p_external_id: 'MOCK-1',
      p_pdf_url: 'https://x/r.pdf',
      p_provider: 'mock',
      p_error: null,
      p_error_code: null,
    });
  });

  it('records a provider failure as error and reports it', async () => {
    const { client, calls } = fakeRpc({
      claim_order_receipt: { data: CLAIM },
      record_order_receipt: { data: { fiscal_status: 'error' } },
    });
    const emitter = { emitReceipt: vi.fn().mockResolvedValue({ success: false, error: 'Servizio non disponibile', error_code: 'SERVICE_UNAVAILABLE' }) };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash', provider: 'acube' });

    expect(result).toEqual({ outcome: 'failed', error: 'Scontrino non emesso: Servizio non disponibile' });
    expect(calls[1].args).toMatchObject({ p_success: false, p_external_id: null, p_pdf_url: null, p_provider: 'acube', p_error: 'Servizio non disponibile', p_error_code: 'SERVICE_UNAVAILABLE' });
  });

  it('treats a thrown provider error as a failure and still releases the claim', async () => {
    const { client, calls } = fakeRpc({
      claim_order_receipt: { data: CLAIM },
      record_order_receipt: { data: { fiscal_status: 'error' } },
    });
    const emitter = { emitReceipt: vi.fn().mockRejectedValue(new Error('timeout')) };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash' });

    expect(result.outcome).toBe('failed');
    expect(calls[1].args).toMatchObject({ p_success: false, p_error: 'timeout', p_error_code: 'SERVICE_ERROR' });
  });

  it('treats success without an external id as a failure', async () => {
    const { client, calls } = fakeRpc({
      claim_order_receipt: { data: CLAIM },
      record_order_receipt: { data: { fiscal_status: 'error' } },
    });
    const emitter = { emitReceipt: vi.fn().mockResolvedValue({ success: true }) };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash' });

    expect(result.outcome).toBe('failed');
    expect(calls[1].args).toMatchObject({ p_success: false, p_external_id: null });
  });

  it('does not emit again when the receipt is already issued', async () => {
    const { client, calls } = fakeRpc({
      claim_order_receipt: { data: { order_id: ORDER, already_issued: true, external_id: 'MOCK-0', pdf_url: null } },
    });
    const emitter = { emitReceipt: vi.fn() };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash' });

    expect(result).toEqual({ outcome: 'already_issued', externalId: 'MOCK-0', pdfUrl: null });
    expect(emitter.emitReceipt).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it.each(Object.keys(RECEIPT_ERROR_MESSAGES))('maps %s from the claim to an Italian message without emitting', async (code) => {
    const { client } = fakeRpc({ claim_order_receipt: { error: { message: 'denied', details: code } } });
    const emitter = { emitReceipt: vi.fn() };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash' });

    expect(result).toEqual({ outcome: 'failed', error: RECEIPT_ERROR_MESSAGES[code] });
    expect(emitter.emitReceipt).not.toHaveBeenCalled();
  });

  it('reports a record error (e.g. expired claim)', async () => {
    const { client } = fakeRpc({
      claim_order_receipt: { data: CLAIM },
      record_order_receipt: { error: { message: 'x', details: 'RECEIPT_CLAIM_INVALID' } },
    });
    const emitter = { emitReceipt: vi.fn().mockResolvedValue({ success: true, external_id: 'MOCK-1' }) };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash' });

    expect(result).toEqual({ outcome: 'failed', error: RECEIPT_ERROR_MESSAGES.RECEIPT_CLAIM_INVALID });
  });

  it('rejects an unexpected claim payload', async () => {
    const { client } = fakeRpc({ claim_order_receipt: { data: { order_id: ORDER, already_issued: false } } });
    const emitter = { emitReceipt: vi.fn() };

    const result = await issueReceipt(ORDER, { rpc: client, emitter, paymentMethod: 'cash' });

    expect(result.outcome).toBe('failed');
    expect(emitter.emitReceipt).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('receiptErrorMessage falls back to the server message', () => {
    expect(receiptErrorMessage({ message: 'boom' })).toBe('Scontrino non emesso: boom');
    expect(receiptErrorMessage(null)).toBe('Scontrino non emesso: errore sconosciuto');
  });

  it('isReceiptIssuable only for accepted+ orders with a pending or failed receipt', () => {
    expect(isReceiptIssuable({ status: 'accepted', fiscal_status: 'pending' })).toBe(true);
    expect(isReceiptIssuable({ status: 'delivered', fiscal_status: 'error' })).toBe(true);
    expect(isReceiptIssuable({ status: 'pending', fiscal_status: 'pending' })).toBe(false);
    expect(isReceiptIssuable({ status: 'cancelled', fiscal_status: 'pending' })).toBe(false);
    expect(isReceiptIssuable({ status: 'ready', fiscal_status: 'success' })).toBe(false);
  });

  it('fiscalProviderLabel reports mock while mock mode is on', () => {
    expect(fiscalProviderLabel({ enabled: true, mock_mode: true, provider: 'acube' })).toBe('mock');
    expect(fiscalProviderLabel({ enabled: true, mock_mode: false, provider: 'acube' })).toBe('acube');
    expect(fiscalProviderLabel({ enabled: false, mock_mode: true, provider: 'acube' })).toBe('disabled');
  });
});
