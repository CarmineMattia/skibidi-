/**
 * Scontrino emesso dallo staff (admin) per un ordine già salvato.
 *
 * Il server decide tutto ciò che conta (20261023140000_staff_receipt_issue):
 *   1. claim_order_receipt: controlla ruolo / pizzeria / stato, prenota
 *      l'ordine (lease di 2 minuti, niente doppio scontrino) e restituisce
 *      righe e totale letti dal DB, non dal client;
 *   2. il provider fiscale (oggi il mock, nessuna config prod cambiata)
 *      emette lo scontrino con quei dati;
 *   3. record_order_receipt: salva l'esito (success / error) e una riga in
 *      fiscal_audit_log. Le note dell'ordine non vengono mai toccate.
 */
import type { FiscalOrderData, FiscalProviderResult, PaymentMethod } from '@/types/fiscal.types';

export type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; details?: string | null; code?: string | null } | null }>;
};

export type ReceiptEmitter = {
  readonly name?: string;
  emitReceipt: (data: FiscalOrderData) => Promise<FiscalProviderResult>;
};

export type ReceiptClaimItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type ReceiptClaim = {
  order_id: string;
  already_issued: boolean;
  claim_id?: string;
  display_code?: string | null;
  customer_name?: string | null;
  created_at?: string;
  fiscal_status?: string;
  total_amount?: number;
  items?: ReceiptClaimItem[];
  external_id?: string | null;
  pdf_url?: string | null;
};

export type IssueReceiptResult =
  | { outcome: 'issued'; externalId: string; pdfUrl: string | null }
  | { outcome: 'already_issued'; externalId: string | null; pdfUrl: string | null }
  | { outcome: 'failed'; error: string };

export const RECEIPT_ERROR_MESSAGES: Record<string, string> = {
  RECEIPT_FORBIDDEN: 'Solo lo staff della pizzeria può emettere lo scontrino.',
  RECEIPT_NOT_ISSUABLE: 'Questo ordine non è in attesa di scontrino.',
  RECEIPT_ORDER_NOT_BILLABLE: "Accetta prima l'ordine: lo scontrino si emette solo per ordini accettati.",
  RECEIPT_ORDER_EMPTY: 'Ordine senza prodotti: niente scontrino da emettere.',
  RECEIPT_IN_PROGRESS: 'Scontrino già in emissione da un altro dispositivo. Riprova tra 2 minuti.',
  RECEIPT_CLAIM_INVALID: 'Prenotazione scaduta: riapri la lista e riprova.',
  RECEIPT_INVALID_RESULT: 'Risposta del provider fiscale non valida.',
};

const VAT_RATE = 22;

export function receiptErrorMessage(error: { message?: string; details?: string | null } | null | undefined): string {
  const code = error?.details ?? '';
  return RECEIPT_ERROR_MESSAGES[code] ?? `Scontrino non emesso: ${error?.message ?? 'errore sconosciuto'}`;
}

const toCents = (euros: number) => Math.round(Number(euros) * 100);

/** Dati per il provider, solo da quello che ha letto il server. */
export function claimToFiscalData(claim: ReceiptClaim, paymentMethod: PaymentMethod): FiscalOrderData {
  const total = toCents(claim.total_amount ?? 0);
  return {
    order_id: claim.order_id,
    customer_name: claim.customer_name ?? undefined,
    items: (claim.items ?? []).map((item) => ({
      product_id: item.product_id ?? '',
      name: item.name || 'Prodotto',
      quantity: item.quantity,
      unit_price: toCents(item.unit_price),
      total_price: toCents(item.total_price),
      vat_rate: VAT_RATE,
    })),
    total_amount: total,
    total_vat: Math.round((total * VAT_RATE) / (100 + VAT_RATE)),
    payment_method: paymentMethod,
    timestamp: new Date().toISOString(),
  };
}

export async function issueReceipt(
  orderId: string,
  options: { rpc: RpcClient; emitter: ReceiptEmitter; paymentMethod: PaymentMethod; provider?: string },
): Promise<IssueReceiptResult> {
  const { rpc, emitter, paymentMethod } = options;
  const provider = (options.provider ?? 'mock').slice(0, 50);

  const claimed = await rpc.rpc('claim_order_receipt', { p_order_id: orderId });
  if (claimed.error) return { outcome: 'failed', error: receiptErrorMessage(claimed.error) };
  const claim = claimed.data as ReceiptClaim | null;
  if (!claim || typeof claim !== 'object') return { outcome: 'failed', error: 'Scontrino non emesso: risposta inattesa dal server.' };
  if (claim.already_issued) {
    return { outcome: 'already_issued', externalId: claim.external_id ?? null, pdfUrl: claim.pdf_url ?? null };
  }
  if (!claim.claim_id) return { outcome: 'failed', error: 'Scontrino non emesso: risposta inattesa dal server.' };

  let result: FiscalProviderResult;
  try {
    result = await emitter.emitReceipt(claimToFiscalData(claim, paymentMethod));
  } catch (error) {
    result = { success: false, error: error instanceof Error ? error.message : 'Errore del provider fiscale', error_code: 'SERVICE_ERROR' };
  }

  const ok = Boolean(result.success && result.external_id);
  const recorded = await rpc.rpc('record_order_receipt', {
    p_order_id: orderId,
    p_claim_id: claim.claim_id,
    p_success: ok,
    p_external_id: ok ? result.external_id : null,
    p_pdf_url: ok ? result.pdf_url ?? null : null,
    p_provider: provider,
    p_error: ok ? null : (result.error ?? 'Scontrino non emesso').slice(0, 500),
    p_error_code: ok ? null : (result.error_code ?? 'PROVIDER_ERROR').slice(0, 50),
  });
  if (recorded.error) return { outcome: 'failed', error: receiptErrorMessage(recorded.error) };

  const saved = (recorded.data ?? {}) as { fiscal_status?: string; external_id?: string | null; pdf_url?: string | null; already_issued?: boolean };
  if (saved.already_issued) {
    return { outcome: 'already_issued', externalId: saved.external_id ?? null, pdfUrl: saved.pdf_url ?? null };
  }
  if (ok && saved.fiscal_status === 'success') {
    return { outcome: 'issued', externalId: String(saved.external_id ?? result.external_id), pdfUrl: saved.pdf_url ?? null };
  }
  return { outcome: 'failed', error: `Scontrino non emesso: ${result.error ?? 'errore del provider fiscale'}` };
}

/** Ordini che il pannello mostra: in attesa o in errore, già accettati. */
export const BILLABLE_ORDER_STATUSES = ['accepted', 'preparing', 'ready', 'delivered'] as const;
export const ISSUABLE_FISCAL_STATUSES = ['pending', 'error'] as const;

export function isReceiptIssuable(order: { status: string; fiscal_status: string | null }): boolean {
  return (
    (BILLABLE_ORDER_STATUSES as readonly string[]).includes(order.status) &&
    (ISSUABLE_FISCAL_STATUSES as readonly string[]).includes(order.fiscal_status ?? '')
  );
}

/** Nome del provider per fiscal_audit_log (oggi sempre 'mock'). */
export function fiscalProviderLabel(config: { enabled: boolean; mock_mode: boolean; provider: string }): string {
  if (!config.enabled) return 'disabled';
  return config.mock_mode ? 'mock' : config.provider;
}
