/**
 * Utility telefono — riconoscimento numeri italiani (fisso vs cellulare)
 * e varianti di formato per il lookup cliente.
 */

export type PhoneKind = 'mobile' | 'landline' | 'unknown';

export interface PhoneClassification {
  kind: PhoneKind;
  label: string;
  /** Numero nazionale normalizzato (solo cifre, senza prefisso internazionale) */
  national: string;
}

/**
 * Estrae il numero nazionale: rimuove spazi/simboli e il prefisso
 * internazionale italiano SOLO se indicato esplicitamente (+39 / 0039).
 * Nota: i cellulari italiani possono iniziare con 39 (es. 392...), quindi
 * il prefisso si rimuove solo quando preceduto da + o 00.
 */
export function normalizeItalianPhone(raw: string): string {
  const trimmed = raw.trim().replaceAll(/[\s\-().]/g, '');
  if (trimmed.startsWith('+39')) return trimmed.slice(3).replaceAll(/\D/g, '');
  if (trimmed.startsWith('0039')) return trimmed.slice(4).replaceAll(/\D/g, '');
  if (trimmed.startsWith('+')) return trimmed.slice(1).replaceAll(/\D/g, '');
  return trimmed.replaceAll(/\D/g, '');
}

/** Classifica un numero italiano come cellulare o fisso. */
export function classifyItalianPhone(raw: string): PhoneClassification {
  const national = normalizeItalianPhone(raw);

  if (national.startsWith('3') && national.length >= 9 && national.length <= 10) {
    return { kind: 'mobile', label: 'Cellulare', national };
  }
  if (national.startsWith('0') && national.length >= 6 && national.length <= 11) {
    return { kind: 'landline', label: 'Fisso', national };
  }
  return { kind: 'unknown', label: 'Numero', national };
}

/**
 * Varianti di formato con cui lo stesso numero può essere stato salvato
 * (checkout salva +39..., ordini manuali possono essere senza prefisso).
 */
export function buildPhoneVariants(raw: string): string[] {
  const national = normalizeItalianPhone(raw);
  if (national.length < 6) return [];

  const variants = new Set<string>([
    national,
    `+39${national}`,
    `39${national}`,
    `0039${national}`,
  ]);

  return [...variants];
}

/**
 * Accetta un numero mentre si digita. Le cifre pure restano invariate
 * (il checkout e i test possono confrontare "3331234567").
 * Spazi, trattini, parentesi e il prefisso +39 / 0039 vengono tolti.
 */
export function acceptPhoneTyping(raw: string, maxDigits = 15): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const digits = /^\d+$/.test(trimmed) ? trimmed : normalizeItalianPhone(trimmed);
  return digits.slice(0, Math.max(0, maxDigits));
}

/** Raggruppa un numero italiano: 0522 171 7681, 333 123 4567. */
export function formatItalianPhoneChunks(raw: string): string {
  const national = normalizeItalianPhone(raw);
  if (!national) return '';

  if (national.startsWith('3')) {
    if (national.length <= 3) return national;
    if (national.length <= 6) return `${national.slice(0, 3)} ${national.slice(3)}`;
    const head = `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 10)}`;
    return national.length > 10 ? `${head} ${national.slice(10)}`.trim() : head;
  }

  if (national.startsWith('0')) {
    const areaLen = national.startsWith('02') || national.startsWith('06')
      ? 2
      : national.length >= 10
        ? 4
        : 3;
    const area = national.slice(0, areaLen);
    const rest = national.slice(areaLen);
    if (!rest) return area;
    if (rest.length <= 3) return `${area} ${rest}`;
    if (rest.length <= 7) return `${area} ${rest.slice(0, 3)} ${rest.slice(3)}`;
    return `${area} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }

  return chunkDigits(national);
}

/** Anteprima raggruppata, solo quando il numero è abbastanza lungo da spezzarsi. */
export function phoneChunkHint(raw: string): string | null {
  const chunks = formatItalianPhoneChunks(raw);
  if (!chunks.includes(' ')) return null;
  return chunks;
}

/**
 * Numero da salvare in ordine: cellulare/fisso italiano diventa +39…,
 * gli altri prefissi internazionali restano con il +.
 */
export function toCheckoutPhone(raw: string): string {
  const trimmed = raw.trim();
  const national = normalizeItalianPhone(trimmed);
  if (!national) return '';
  if (trimmed.startsWith('+') && !trimmed.startsWith('+39') && !trimmed.startsWith('+0039')) {
    return `+${national}`;
  }
  if (/^[03]/.test(national)) return `+39${national}`;
  return national;
}

function chunkDigits(digits: string, size = 3): string {
  if (digits.length <= size) return digits;
  const parts: string[] = [];
  let rest = digits;
  while (rest.length > size) {
    parts.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
  }
  if (rest) parts.unshift(rest);
  return parts.join(' ');
}
