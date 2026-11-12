import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MISMATCH,
  PRODUCT_IMAGE_NOT_AN_IMAGE,
  decodedBase64Bytes,
  formatStorageUploadError,
  mimeFromMagicBytes,
  productImageObjectPath,
  validateProductImage,
} from '../../lib/utils/productImageUpload';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const OTHER = '00000000-0000-0000-0000-000000000002';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');
const JPEG = b64([0xff, 0xd8, 0xff, 0x00]);
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = b64([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

describe('upload foto prodotto', () => {
  it('ricava il MIME dai magic byte, non dal nome', () => {
    expect(mimeFromMagicBytes(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(validateProductImage({ mimeType: 'image/jpeg', base64: JPEG })).toEqual({
      ok: true,
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(validateProductImage({ mimeType: 'image/jpg', base64: JPEG })).toMatchObject({
      ok: true,
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(validateProductImage({ mimeType: 'image/png; charset=binary', fileName: 'a.png', base64: PNG })).toMatchObject({
      ok: true,
      mimeType: 'image/png',
      extension: 'png',
    });
    expect(validateProductImage({ fileName: 'x.bin', base64: WEBP })).toEqual({
      ok: true,
      mimeType: 'image/webp',
      extension: 'webp',
    });
  });

  it('rifiuta PDF, SVG travestito da jpg, il MIME che non torna e i file oltre 5 MB', () => {
    const pdf = validateProductImage({ mimeType: 'application/pdf', fileName: 'menu.pdf', sizeBytes: 20 });
    expect(pdf).toEqual({ ok: false, message: PRODUCT_IMAGE_NOT_AN_IMAGE });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64');
    expect(validateProductImage({ mimeType: 'image/jpeg', fileName: 'foto.jpg', base64: svg })).toEqual({
      ok: false,
      message: PRODUCT_IMAGE_NOT_AN_IMAGE,
    });
    expect(validateProductImage({ mimeType: 'image/png', base64: JPEG })).toEqual({
      ok: false,
      message: PRODUCT_IMAGE_MISMATCH,
    });
    expect(validateProductImage({ mimeType: 'image/gif', sizeBytes: 10 })).toEqual({
      ok: false,
      message: PRODUCT_IMAGE_NOT_AN_IMAGE,
    });
    expect(validateProductImage({ mimeType: 'image/png', sizeBytes: PRODUCT_IMAGE_MAX_BYTES + 1 })).toEqual({
      ok: false,
      message: 'Immagine troppo grande. Il massimo è 5 MB.',
    });
    const tooBig = Buffer.alloc(PRODUCT_IMAGE_MAX_BYTES + 1).toString('base64');
    expect(validateProductImage({ mimeType: 'image/webp', base64: tooBig }).ok).toBe(false);
    expect(decodedBase64Bytes(Buffer.from('hi').toString('base64'))).toBe(2);
  });

  it('il path inizia con la company e non è piatto', () => {
    expect(productImageObjectPath(COMPANY, 'prod-1', 'webp', 50)).toBe(`${COMPANY}/prod-1-50.webp`);
    expect(productImageObjectPath(COMPANY, '../other', 'jpg', 1).startsWith(`${COMPANY}/`)).toBe(true);
    expect(productImageObjectPath(COMPANY, '../other', 'jpg', 1)).not.toContain(OTHER);
    expect(() => productImageObjectPath('not-a-uuid', 'x', 'png', 1)).toThrow(/company id/);
  });

  it('l\'editor mostra l\'errore nel modale e usa il MIME vero', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../components/features/EditProductModal.tsx'), 'utf8');
    expect(src).toContain('productImageObjectPath');
    expect(src).toContain('contentType: mimeType');
    expect(src).toContain('imageMessage.text');
    expect(src).toContain('text-red-600');
    expect(src).toContain('reportImageError(checked.message)');
    expect(src).not.toContain('if (!asset?.base64) return');
    expect(src).not.toContain("contentType: 'image/jpeg'");
  });

  it('mostra il 400 di storage', () => {
    expect(formatStorageUploadError({ statusCode: 400, message: 'mime type image/gif is not supported' })).toBe(
      '400: mime type image/gif is not supported',
    );
    expect(formatStorageUploadError({ statusCode: '413', error: 'Payload too large' })).toBe('413: Payload too large');
  });
});
