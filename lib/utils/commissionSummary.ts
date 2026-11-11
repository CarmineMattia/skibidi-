/**
 * Resoconto commissioni: formattazione e controlli di accesso usati dalla schermata.
 * I numeri arrivano dalla RPC; qui non si ricalcola la commissione.
 */

export type CommissionRateSlice = {
  rate_percent: number;
  order_count: number;
  gross_total: number;
  commission_total: number;
  effective_from?: string;
};

export type CommissionMonth = {
  month_start: string;
  order_count: number;
  gross_total: number;
  commission_total: number;
  unrated_order_count: number;
  unrated_gross: number;
  is_preview: boolean;
  generated_at: string;
  rates: CommissionRateSlice[];
};

export type CommissionRateRow = {
  rate_percent: number;
  effective_from: string;
  is_current: boolean;
  is_scheduled: boolean;
};

export function canReadCommissionSummary(input: { isAdmin: boolean; isPlatformOwner: boolean }): boolean {
  return input.isAdmin || input.isPlatformOwner;
}

export function canEditCommissionRate(isPlatformOwner: boolean): boolean {
  return isPlatformOwner;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asRateSlices(value: unknown): CommissionRateSlice[] {
  const raw = typeof value === 'string' ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      rate_percent: asNumber(row.rate_percent),
      order_count: asNumber(row.order_count),
      gross_total: asNumber(row.gross_total),
      commission_total: asNumber(row.commission_total),
      ...(typeof row.effective_from === 'string' && row.effective_from ? { effective_from: row.effective_from } : {}),
    };
  });
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseCommissionMonths(data: unknown): CommissionMonth[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      month_start: typeof row.month_start === 'string' ? row.month_start : '',
      order_count: asNumber(row.order_count),
      gross_total: asNumber(row.gross_total),
      commission_total: asNumber(row.commission_total),
      unrated_order_count: asNumber(row.unrated_order_count),
      unrated_gross: asNumber(row.unrated_gross),
      is_preview: row.is_preview === true,
      generated_at: typeof row.generated_at === 'string' ? row.generated_at : '',
      rates: asRateSlices(row.rates),
    };
  });
}

export function parseRateSchedule(data: unknown): CommissionRateRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      rate_percent: asNumber(row.rate_percent),
      effective_from: typeof row.effective_from === 'string' ? row.effective_from : '',
      is_current: row.is_current === true,
      is_scheduled: row.is_scheduled === true,
    };
  });
}

export function parseRateInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

export function parseDateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return trimmed;
}

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const percent = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const monthLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const romeStamp = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Rome',
});
const romeDate = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Rome',
});

export function formatEuro(value: number): string {
  return euro.format(value);
}

export function formatRatePercent(rate: number): string {
  return `${percent.format(rate)}%`;
}

export function formatCommissionMonth(monthStart: string): string {
  const [year, month, day] = monthStart.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return monthStart;
  return monthLabel.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatRomeDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return romeStamp.format(date);
}

export function formatRomeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return romeDate.format(date);
}

export type CommissionPanelState = 'loading' | 'error' | 'empty' | 'ready';

export function commissionPanelState(input: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}): CommissionPanelState {
  if (input.isLoading) return 'loading';
  if (input.isError) return 'error';
  if (input.count === 0) return 'empty';
  return 'ready';
}

function orderWord(count: number): string {
  return count === 1 ? 'ordine' : 'ordini';
}

export function formatRateBreakdown(rates: CommissionRateSlice[]): string {
  if (rates.length === 0) return 'Nessuna aliquota';
  if (rates.length === 1 && !rates[0].effective_from) return formatRatePercent(rates[0].rate_percent);
  return rates
    .map((rate) => {
      const from = rate.effective_from ? formatRomeDate(rate.effective_from) : '';
      const period = from ? ` dal ${from}` : '';
      return `${formatRatePercent(rate.rate_percent)}${period} su ${rate.order_count} ${orderWord(rate.order_count)}`;
    })
    .join(', ');
}

export function commissionErrorMessage(message: string, code?: string, kind: 'summary' | 'rates' = 'summary'): string {
  const text = `${code ?? ''} ${message}`;
  if (text.includes('COMMISSION_RATE_BACKDATE')) {
    return 'La decorrenza è nel passato. Usa «Da questo momento» oppure un giorno futuro.';
  }
  if (text.includes('COMMISSION_RATE_INVALID')) {
    return 'Percentuale non valida. Usa un numero tra 0 e 100, con al massimo due decimali.';
  }
  if (text.includes('COMMISSION_RATE_NOT_SCHEDULED')) {
    return 'Si può annullare solo un’aliquota che non è ancora in vigore.';
  }
  if (text.includes('COMMISSION_RATE_ORDER')) {
    return 'C’è già un’aliquota programmata dopo questa data. Annulla prima quella.';
  }
  if (text.includes('COMMISSION_FORBIDDEN')) {
    return 'Non hai accesso a questo resoconto.';
  }
  if (text.includes('PGRST202') || text.includes('commission_monthly_summary') || text.includes('commission_rate_schedule') || text.includes('schema cache')) {
    return kind === 'rates'
      ? 'Aliquote non disponibili: la migration non è ancora stata applicata.'
      : 'Resoconto non disponibile: la migration non è ancora stata applicata.';
  }
  return kind === 'rates' ? 'Impossibile leggere le aliquote. Riprova.' : 'Impossibile leggere il resoconto. Riprova.';
}
