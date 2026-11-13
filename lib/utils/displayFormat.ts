/**
 * Formattazione leggibile per totali e codici ordine (legge di Miller:
 * gruppi corti, non una stringa unica di cifre).
 */

/** Nome cliente: trim e spazi interni collassati. Non tocca le maiuscole. */
export function normalizeCustomerName(raw: string): string {
  return raw.trim().replaceAll(/\s+/g, ' ');
}

/**
 * Sotto €1000 resta il formato già usato nel menu (`€5.00`), così i prezzi
 * in lista non cambiano. Dai mille in su il totale si spezza in gruppi
 * italiani (`€1.234,50`).
 */
export function formatGroupedEuro(amount: number): string {
  if (!Number.isFinite(amount)) return '€0.00';
  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);
  const [whole, fraction] = absolute.toFixed(2).split('.');
  if (absolute < 1000) return `${sign}€${whole}.${fraction}`;
  const grouped = whole.replaceAll(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}€${grouped},${fraction}`;
}

export function chunkDigitGroups(digits: string, size = 3): string {
  const clean = digits.replaceAll(/\D/g, '');
  if (clean.length <= size) return clean;
  const parts: string[] = [];
  let rest = clean;
  while (rest.length > size) {
    parts.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
  }
  if (rest) parts.unshift(rest);
  return parts.join(' ');
}

/** Spezza solo le sequenze di 5+ cifre dentro un'etichetta già leggibile. */
export function formatReadableCode(label: string): string {
  return label.replaceAll(/\d{5,}/g, (run) => chunkDigitGroups(run));
}
