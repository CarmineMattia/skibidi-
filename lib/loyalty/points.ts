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
