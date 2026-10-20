/**
 * Order line details: modifiers (extras / removals / builder choices) are persisted
 * on `order_items.notes`. These helpers keep cart → DB → kitchen/print consistent.
 */

const MODIFIER_LINE =
  /^(No\s+|Extra\s+|\+\s+|Taglia:|Impasto:|Base:|Gusto(?:\s+\d+)?:|Cottura:)/i;

const FREE_NOTE_PREFIX = /^Nota:\s*/i;
const PRODUCT_NAME_PREFIX = /^\[P\]\s*/i;

/** Customer note on one line: newlines / tabs / repeated spaces collapsed. */
export function sanitizeFreeNote(notes?: string | null): string {
  return (notes ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\s\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .trim();
}

/** Serialize cart notes + modifiers for `order_items.notes`. */
export function formatOrderItemNotes(
  notes?: string | null,
  modifiers?: string[] | null,
  productName?: string | null
): string | null {
  const lines: string[] = [];

  const trimmedProduct = productName?.trim();
  if (trimmedProduct) {
    lines.push(`[P] ${trimmedProduct}`);
  }

  for (const modifier of modifiers ?? []) {
    const trimmed = modifier.trim();
    if (trimmed) lines.push(trimmed);
  }

  // The customer note is one line, always last: the kitchen shows it as plain
  // text and the server never prices it (create_order_with_items refuses
  // anything after it).
  const freeNote = sanitizeFreeNote(notes);
  if (freeNote) {
    lines.push(`Nota: ${freeNote}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

export type ParsedOrderItemNotes = {
  productName: string | null;
  modifiers: string[];
  freeNote: string | null;
};

/**
 * Parse kitchen-facing details from `order_items.notes`.
 * Supports the new newline format and the legacy `"note | mod1, mod2"` shape.
 */
export function parseOrderItemNotes(raw?: string | null): ParsedOrderItemNotes {
  if (!raw?.trim()) {
    return { productName: null, modifiers: [], freeNote: null };
  }

  const text = raw.trim();

  // New format: one modifier/note/product per line. Only the lines before the
  // first "Nota:" line are options; that line and everything after it is the
  // customer's text, shown as is (never parsed into modifiers, never split on
  // commas).
  if (text.includes('\n') || PRODUCT_NAME_PREFIX.test(text) || FREE_NOTE_PREFIX.test(text)) {
    const lines = text.split('\n').map((line) => line.trim());
    const noteIndex = lines.findIndex((line) => FREE_NOTE_PREFIX.test(line));
    const optionLines = (noteIndex === -1 ? lines : lines.slice(0, noteIndex)).filter(Boolean);
    const productLine = optionLines.length > 0 && PRODUCT_NAME_PREFIX.test(optionLines[0]) ? optionLines[0] : null;
    const modifiers = productLine ? optionLines.slice(1) : optionLines;
    const freeNote =
      noteIndex === -1
        ? null
        : [lines[noteIndex].replace(FREE_NOTE_PREFIX, ''), ...lines.slice(noteIndex + 1)]
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' ') || null;
    return {
      productName: productLine ? productLine.replace(PRODUCT_NAME_PREFIX, '').trim() || null : null,
      modifiers,
      freeNote,
    };
  }

  // Legacy single-line shapes below: only orders saved before the server
  // validated options (20261020150000) can have them.
  // Legacy: free note separated from modifiers with " | "
  if (text.includes(' | ')) {
    const parts = text.split(' | ').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      return { productName: null, modifiers: [], freeNote: null };
    }

    if (MODIFIER_LINE.test(parts[0])) {
      return {
        productName: null,
        modifiers: parts.flatMap((part) => splitLegacyModifiers(part)),
        freeNote: null,
      };
    }

    const [freeNote, ...modifierParts] = parts;
    return {
      productName: null,
      freeNote: freeNote || null,
      modifiers: modifierParts.flatMap((part) => splitLegacyModifiers(part)),
    };
  }

  // Legacy: comma-separated modifiers only
  if (MODIFIER_LINE.test(text) || /,\s*(\+|No\s+|Extra\s+|Taglia:|Impasto:|Base:|Gusto|Cottura:)/i.test(text)) {
    return { productName: null, modifiers: splitLegacyModifiers(text), freeNote: null };
  }

  return { productName: null, modifiers: [], freeNote: text };
}

function splitLegacyModifiers(blob: string): string[] {
  return blob
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Strip technical tokens from order-level notes for kitchen UI. */
export function cleanKitchenOrderNotes(notes?: string | null): string {
  if (!notes) return '';
  return notes
    .replace(/\[FULFILLMENT:[^\]]+\]/g, '')
    .replace(/\[CAPACITY_UNITS:[^\]]+\]/g, '')
    .replace(/Metodo di pagamento:\s*[^|]+/gi, '')
    .replace(/Delivery fee:\s*[^|]+/gi, '')
    .replace(/Fulfillment:\s*[^|]+/gi, '')
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' · ');
}
