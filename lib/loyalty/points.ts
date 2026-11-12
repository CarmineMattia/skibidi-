/**
 * Skibidi Coin, fase 1. Punti interni della pizzeria, fuori dalla blockchain.
 * Il totale mostrato in cassa non cambia: lo sconto esiste solo dopo la conferma dello staff.
 */

export const LOYALTY_RULES = {
  pointsPerEuro: 1,
  pointsPerRedeemUnit: 100,
  redeemValueEur: 5,
  expiryMonths: 12,
  expiringSoonDays: 30,
} as const;

export const POINTS_REQUEST_CAPTION = 'da confermare in cassa';

export type LoyaltyLedgerType = 'earn_order' | 'redeem' | 'gift' | 'reversal' | 'expire';

export interface LoyaltySummary {
  enabled: boolean;
  balance: number;
  expiringSoon: number;
  nextExpiresAt: string | null;
  pointsPerEuro: number;
  pointsPerRedeemUnit: number;
  redeemValueEur: number;
  expiryMonths: number;
  companyId: string | null;
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

/** 1 punto per euro intero di merce. La consegna non entra in questo totale. */
export function earnPoints(merchandiseTotal: number, pointsPerEuro: number = LOYALTY_RULES.pointsPerEuro): number {
  if (!Number.isFinite(merchandiseTotal) || merchandiseTotal <= 0) return 0;
  if (!Number.isFinite(pointsPerEuro) || pointsPerEuro <= 0) return 0;
  return Math.floor(merchandiseTotal) * pointsPerEuro;
}

export function discountEur(
  points: number,
  unit: number = LOYALTY_RULES.pointsPerRedeemUnit,
  valueEur: number = LOYALTY_RULES.redeemValueEur,
): number {
  if (!Number.isFinite(points) || points <= 0 || unit <= 0 || valueEur <= 0) return 0;
  return Math.floor(points / unit) * valueEur;
}

/** Il massimo multiplo chiedibile: non supera il saldo né la merce. */
export function maxRedeemablePoints(
  balance: number,
  unit: number,
  merchandiseSubtotal: number,
  valueEur: number,
): number {
  if (balance < unit || unit <= 0 || valueEur <= 0 || merchandiseSubtotal <= 0) return 0;
  const byBalance = Math.floor(balance / unit) * unit;
  const byMerchandise = Math.floor(merchandiseSubtotal / valueEur) * unit;
  return Math.max(0, Math.min(byBalance, byMerchandise));
}

export function clampPointsRequest(requested: number, maxPoints: number, unit: number): number {
  if (requested <= 0 || maxPoints < unit || unit <= 0) return 0;
  return Math.floor(Math.min(requested, maxPoints) / unit) * unit;
}

export function pointsRequestCaption(): string {
  return POINTS_REQUEST_CAPTION;
}

/**
 * Il totale che il cliente vede. La richiesta punti non lo riduce:
 * lo sconto lo scrive la cassa, e comunque accanto al totale, non al posto suo.
 */
export function displayedCheckoutTotal(merchandise: number, deliveryFee: number, _pointsRequested = 0): number {
  const goods = Number.isFinite(merchandise) ? merchandise : 0;
  const delivery = Number.isFinite(deliveryFee) && deliveryFee > 0 ? deliveryFee : 0;
  return goods + delivery;
}

export function isExpiringSoon(
  expiresAt: string | Date | null | undefined,
  now = new Date(),
  withinDays = LOYALTY_RULES.expiringSoonDays,
): boolean {
  if (!expiresAt) return false;
  const at = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (!Number.isFinite(at)) return false;
  const delta = at - now.getTime();
  return delta > 0 && delta <= withinDays * 24 * 60 * 60 * 1000;
}

export function ledgerTypeLabel(type: string): string {
  switch (type) {
    case 'earn_order': return 'Accredito ordine';
    case 'redeem': return 'Sconto in cassa';
    case 'gift': return 'Omaggio';
    case 'reversal': return 'Storno';
    case 'expire': return 'Scadenza';
    default: return 'Movimento';
  }
}

export function canRequestPoints(input: {
  authenticated: boolean;
  role: string | null | undefined;
  enabled: boolean;
}): boolean {
  return input.authenticated && input.role === 'customer' && input.enabled;
}

export const POINTS_REQUESTED_LINE = 'Punti richiesti: da confermare in cassa';
export const AMOUNT_DUE_LABEL = 'Importo da pagare';

export type PointsTrackingKind = 'requested' | 'confirmed' | 'not_applied';

export interface PointsTrackingStatus {
  kind: PointsTrackingKind;
  label: string;
}

/** Stato mostrato nel tracking. Senza i campi punti il payload è quello vecchio e non si inventa una riga. */
export function pointsTrackingStatus(input: {
  pointsRequested?: number | null;
  pointsRedeemed?: number | null;
  pointsDiscountEur?: number | null;
  pointsConfirmedAt?: string | null;
  orderStatus?: string | null;
}): PointsTrackingStatus | null {
  const hasPointsFields = input.pointsRequested != null
    || input.pointsRedeemed != null
    || input.pointsConfirmedAt != null
    || input.pointsDiscountEur != null;
  if (!hasPointsFields) return null;

  const redeemed = Number(input.pointsRedeemed ?? 0);
  const confirmed = input.pointsConfirmedAt != null || (input.pointsRedeemed != null && redeemed > 0);
  if (confirmed) {
    const discount = Number(input.pointsDiscountEur ?? 0);
    return {
      kind: 'confirmed',
      label: discount > 0
        ? `Sconto punti confermato in cassa: €${discount.toFixed(2)}`
        : 'Sconto punti confermato in cassa',
    };
  }

  const requested = Number(input.pointsRequested ?? 0);
  const closed = input.orderStatus === 'cancelled' || input.orderStatus === 'rejected';
  if (requested > 0 && !closed) {
    return { kind: 'requested', label: POINTS_REQUESTED_LINE };
  }
  return { kind: 'not_applied', label: 'Sconto punti non applicato' };
}

export function pointsDiscountLine(discountEur: number): string {
  return `Sconto punti Skibidi Coin -€${discountEur.toFixed(2)}`;
}

/** Quanto resta da pagare in cassa. Il total_amount dell'ordine non cambia. */
export function receiptAmountDue(totalAmount: number, discountEur: number): number {
  const total = Number.isFinite(totalAmount) ? totalAmount : 0;
  const discount = Number.isFinite(discountEur) && discountEur > 0 ? discountEur : 0;
  const due = total - discount;
  return Math.round((due < 0 ? 0 : due) * 100) / 100;
}

export type ReceiptPointsView =
  | { kind: 'confirmed'; discountLine: string; discountEur: number; amountDue: number }
  | { kind: 'requested'; line: string }
  | { kind: 'none' };

export function receiptPointsView(input: {
  totalAmount: number;
  pointsRequested?: number | null;
  pointsRedeemed?: number | null;
  pointsDiscountEur?: number | null;
}): ReceiptPointsView {
  const discount = Number(input.pointsDiscountEur ?? 0);
  const redeemed = Number(input.pointsRedeemed ?? 0);
  if (input.pointsRedeemed != null && redeemed > 0 && discount > 0) {
    return {
      kind: 'confirmed',
      discountLine: pointsDiscountLine(discount),
      discountEur: discount,
      amountDue: receiptAmountDue(input.totalAmount, discount),
    };
  }
  if (Number(input.pointsRequested ?? 0) > 0) {
    return { kind: 'requested', line: POINTS_REQUESTED_LINE };
  }
  return { kind: 'none' };
}

export function parseLoyaltySummary(raw: unknown): LoyaltySummary {
  const row = asRecord(raw);
  return {
    enabled: row.enabled === true,
    balance: asNumber(row.balance, 0),
    expiringSoon: asNumber(row.expiring_soon, 0),
    nextExpiresAt: typeof row.next_expires_at === 'string' ? row.next_expires_at : null,
    pointsPerEuro: asNumber(row.points_per_euro, LOYALTY_RULES.pointsPerEuro),
    pointsPerRedeemUnit: asNumber(row.points_per_redeem_unit, LOYALTY_RULES.pointsPerRedeemUnit),
    redeemValueEur: asNumber(row.redeem_value_eur, LOYALTY_RULES.redeemValueEur),
    expiryMonths: asNumber(row.expiry_months, LOYALTY_RULES.expiryMonths),
    companyId: typeof row.company_id === 'string' ? row.company_id : null,
  };
}
