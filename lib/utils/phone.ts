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
