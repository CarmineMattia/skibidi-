/**
 * Consenso GDPR: lettura delle risposte RPC e regole di accesso usate dalle schermate.
 * Il calcolo (chi è inattivo, quale prodotto proporre) sta nel database.
 */

import { CONSENT_DRAFT_VERSION, CONSENT_PURPOSES, type ConsentPurpose } from '@/lib/privacy/consentDraft';

export type { ConsentPurpose };

export const DEFAULT_INACTIVE_DAYS = 60;
export const MIN_INACTIVE_DAYS = 7;
export const MAX_INACTIVE_DAYS = 730;

export type ConsentChoice = {
  purpose: ConsentPurpose;
  granted: boolean;
  documentVersion: string | null;
  updatedAt: string | null;
};

export type ConsentHistoryEvent = {
  purpose: ConsentPurpose;
  granted: boolean;
  documentVersion: string;
  createdAt: string;
};

export type ConsentDocument = {
  version: string;
  title: string;
  body: string;
};

export type PersonalisedOffer = {
  hasConsent: boolean;
  productName: string | null;
  quantity: number;
};

export type InactiveCustomer = {
  customerId: string;
  fullName: string | null;
  email: string | null;
  lastOrderAt: string;
  daysSinceOrder: number;
};

export type WeekHourStat = {
  weekday: number | null;
  hour: number | null;
  orderCount: number;
};

export type TopProductStat = {
  productName: string;
  quantityTotal: number | null;
  orderCount: number;
};

const WEEKDAY_LABELS = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const romeStamp = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Rome',
});

export function canReadCustomerInsights(input: { isAdmin: boolean; isPlatformOwner: boolean }): boolean {
  return input.isAdmin || input.isPlatformOwner;
}

export function consentAllowsPersonalisation(choices: readonly ConsentChoice[]): boolean {
  return choices.every((choice) => choice.granted) && choices.length === CONSENT_PURPOSES.length;
}

export function consentTextIsDraft(version: string, body: string): boolean {
  return version.includes('draft') || body.includes('BOZZA');
}

export function emptyConsentChoices(): ConsentChoice[] {
  return CONSENT_PURPOSES.map((purpose) => ({
    purpose: purpose.purpose,
    granted: false,
    documentVersion: null,
    updatedAt: null,
  }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isPurpose(value: unknown): value is ConsentPurpose {
  return value === 'marketing' || value === 'profiling';
}

export function parseConsentDocument(data: unknown): ConsentDocument | null {
  const row = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  if (!row) return null;
  if (typeof row.version !== 'string' || typeof row.title !== 'string' || typeof row.body !== 'string') return null;
  if (!row.version || !row.body) return null;
  return { version: row.version, title: row.title, body: row.body };
}

export function parseMyConsent(data: unknown): ConsentChoice[] {
  const rows = Array.isArray(data) ? data : [];
  return CONSENT_PURPOSES.map((purpose) => {
    const row = rows
      .map(asRecord)
      .find((item) => item?.purpose === purpose.purpose);
    return {
      purpose: purpose.purpose,
      granted: row?.granted === true,
      documentVersion: typeof row?.document_version === 'string' ? row.document_version : null,
      updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : null,
    };
  });
}

export function parseConsentHistory(data: unknown): ConsentHistoryEvent[] {
  if (!Array.isArray(data)) return [];
  const events: ConsentHistoryEvent[] = [];
  for (const item of data) {
    const row = asRecord(item);
    if (!row || !isPurpose(row.purpose) || typeof row.document_version !== 'string' || typeof row.created_at !== 'string') {
      continue;
    }
    events.push({
      purpose: row.purpose,
      granted: row.granted === true,
      documentVersion: row.document_version,
      createdAt: row.created_at,
    });
  }
  return events;
}

export function parsePersonalisedOffer(data: unknown): PersonalisedOffer {
  const row = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  const hasConsent = row?.has_consent === true;
  if (!hasConsent) return { hasConsent: false, productName: null, quantity: 0 };
  const name = typeof row?.product_name === 'string' ? row.product_name.trim() : '';
  return {
    hasConsent: true,
    productName: name || null,
    quantity: asNumber(row?.quantity_total),
  };
}

export function parseInactiveCustomers(data: unknown): InactiveCustomer[] {
  if (!Array.isArray(data)) return [];
  const rows: InactiveCustomer[] = [];
  for (const item of data) {
    const row = asRecord(item);
    if (!row || typeof row.customer_id !== 'string' || typeof row.last_order_at !== 'string') continue;
    rows.push({
      customerId: row.customer_id,
      fullName: typeof row.full_name === 'string' && row.full_name.trim() ? row.full_name : null,
      email: typeof row.email === 'string' && row.email.trim() ? row.email : null,
      lastOrderAt: row.last_order_at,
      daysSinceOrder: asNumber(row.days_since_order),
    });
  }
  return rows;
}

export function parseWeekHourStats(data: unknown): WeekHourStat[] {
  if (!Array.isArray(data)) return [];
  const rows: WeekHourStat[] = [];
  for (const item of data) {
    const row = asRecord(item);
    if (!row) continue;
    const other = row.weekday == null && row.hour == null;
    const weekday = other ? null : asNumber(row.weekday);
    const hour = other ? null : asNumber(row.hour);
    if (!other && (weekday == null || hour == null || weekday < 1 || weekday > 7 || hour < 0 || hour > 23)) continue;
    rows.push({ weekday, hour, orderCount: asNumber(row.order_count) });
  }
  return rows;
}

export function parseTopProducts(data: unknown): TopProductStat[] {
  if (!Array.isArray(data)) return [];
  const rows: TopProductStat[] = [];
  for (const item of data) {
    const row = asRecord(item);
    if (!row || typeof row.product_name !== 'string' || !row.product_name.trim()) continue;
    rows.push({
      productName: row.product_name,
      quantityTotal: row.quantity_total == null ? null : asNumber(row.quantity_total),
      orderCount: asNumber(row.order_count),
    });
  }
  return rows;
}

export function parseInactiveDays(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (value < MIN_INACTIVE_DAYS || value > MAX_INACTIVE_DAYS) return null;
  return value;
}

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? '';
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatConsentWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return romeStamp.format(date);
}

export function formatConsentHistoryLine(event: ConsentHistoryEvent): string {
  const label = event.purpose === 'marketing' ? 'Offerte personalizzate' : 'Profilazione';
  const action = event.granted ? 'consenso dato' : 'consenso revocato';
  const when = formatConsentWhen(event.createdAt);
  return when ? `${when} · ${label} · ${action}` : `${label} · ${action}`;
}

export function isMissingConsentRegistry(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as { message?: string; code?: string };
  const text = `${row.code ?? ''} ${row.message ?? ''}`;
  return text.includes('PGRST202') || text.includes('schema cache') || text.includes('Could not find the function');
}

export function consentErrorMessage(message: string, code?: string): string {
  const text = `${code ?? ''} ${message}`;
  if (isMissingConsentRegistry({ message, code })) {
    return 'Registro consensi non ancora attivo. La scelta non è stata salvata.';
  }
  if (text.includes('CONSENT_VERSION_STALE')) {
    return "Il testo dell'informativa è cambiato. Rileggi la versione attuale e riprova.";
  }
  if (text.includes('CONSENT_FORBIDDEN')) {
    return 'Puoi modificare solo il tuo consenso.';
  }
  if (text.includes('CONSENT_PURPOSE_INVALID') || text.includes('CONSENT_VALUE_INVALID')) {
    return 'Scelta non valida.';
  }
  return 'Non sono riuscito a salvare la scelta. Riprova.';
}

export function insightsErrorMessage(message: string, code?: string): string {
  const text = `${code ?? ''} ${message}`;
  if (isMissingConsentRegistry({ message, code })) {
    return 'Dati non disponibili: la migration non è ancora stata applicata.';
  }
  if (text.includes('CONSENT_FORBIDDEN')) return 'Non hai accesso a questi dati.';
  if (text.includes('CONSENT_DAYS_INVALID')) {
    return `I giorni devono essere un numero intero tra ${MIN_INACTIVE_DAYS} e ${MAX_INACTIVE_DAYS}.`;
  }
  return 'Impossibile leggere i dati. Riprova.';
}

export function personalisedOfferLine(offer: PersonalisedOffer): string | null {
  if (!offer.hasConsent || !offer.productName) return null;
  const pieces = offer.quantity === 1 ? '1 pezzo' : `${offer.quantity} pezzi`;
  return `In base ai tuoi ordini, la tua preferita è ${offer.productName} (${pieces}).`;
}

export const BUNDLED_CONSENT_VERSION = CONSENT_DRAFT_VERSION;
