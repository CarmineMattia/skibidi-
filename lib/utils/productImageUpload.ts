/** Product photo upload: company prefix, real MIME type, 5 MB cap. */

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const CANONICAL_MIME = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/x-png': 'image/png',
  'image/webp': 'image/webp',
} as const;

const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type ProductImageMime = keyof typeof EXTENSION_BY_MIME;
export type ProductImageExtension = (typeof EXTENSION_BY_MIME)[ProductImageMime];

const COMPANY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProductImageCheck =
  | { ok: true; mimeType: ProductImageMime; extension: ProductImageExtension }
  | { ok: false; message: string };

function mimeFromName(fileName: string | null | undefined): string | null {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}

export const PRODUCT_IMAGE_NOT_AN_IMAGE = 'Il file non è un\'immagine JPEG, PNG o WebP.';
export const PRODUCT_IMAGE_MISMATCH = 'Il contenuto del file non corrisponde al formato dichiarato.';

export function decodedBase64Bytes(base64: string): number {
  const cleaned = base64.replace(/\s/g, '');
  if (!cleaned) return 0;
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.floor((cleaned.length * 3) / 4) - padding;
}

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** MIME comes from the file header, not from the name the picker reports. */
export function mimeFromMagicBytes(bytes: Uint8Array): ProductImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateProductImage(input: {
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  base64?: string | null;
}): ProductImageCheck {
  const raw = (input.mimeType || mimeFromName(input.fileName) || '').toLowerCase().split(';')[0].trim();
  const declared = CANONICAL_MIME[raw as keyof typeof CANONICAL_MIME] ?? null;
  if (input.sizeBytes != null && input.sizeBytes > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: 'Immagine troppo grande. Il massimo è 5 MB.' };
  }
  if (!input.base64) {
    return { ok: false, message: declared ? 'Immagine non valida.' : PRODUCT_IMAGE_NOT_AN_IMAGE };
  }
  const bytes = bytesFromBase64(input.base64);
  if (bytes.length <= 0) return { ok: false, message: 'Immagine non valida.' };
  if (bytes.length > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: 'Immagine troppo grande. Il massimo è 5 MB.' };
  }
  const sniffed = mimeFromMagicBytes(bytes);
  if (!sniffed) return { ok: false, message: PRODUCT_IMAGE_NOT_AN_IMAGE };
  if (declared && declared !== sniffed) return { ok: false, message: PRODUCT_IMAGE_MISMATCH };
  return { ok: true, mimeType: sniffed, extension: EXTENSION_BY_MIME[sniffed] };
}

/** Object key inside the products bucket. The first segment is the company id. */
export function productImageObjectPath(
  companyId: string,
  productKey: string,
  extension: ProductImageExtension,
  now: number,
): string {
  if (!COMPANY_ID_RE.test(companyId)) {
    throw new Error('company id non valido');
  }
  const safeKey = productKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'foto';
  return `${companyId}/${safeKey}-${now}.${extension}`;
}

/** Message for the editor, including a storage 400. */
export function formatStorageUploadError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Caricamento immagine fallito. Verifica i permessi Storage.';
  }
  const detail = error as { message?: string; statusCode?: string | number; error?: string };
  const text = detail.message || detail.error || 'Caricamento immagine fallito. Verifica i permessi Storage.';
  const status = detail.statusCode != null && String(detail.statusCode) !== '' ? String(detail.statusCode) : '';
  return status ? `${status}: ${text}` : text;
}
