import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRODUCT_IMAGE_MAX_BYTES,
  decodedBase64Bytes,
  formatStorageUploadError,
  productImageObjectPath,
  validateProductImage,
} from '../../lib/utils/productImageUpload';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const OTHER = '00000000-0000-0000-0000-000000000002';

describe('upload foto prodotto', () => {
  it('accetta jpeg, png e webp e manda il MIME canonico', () => {
    expect(validateProductImage({ mimeType: 'image/jpeg', sizeBytes: 100 })).toEqual({
      ok: true,
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(validateProductImage({ mimeType: 'image/jpg', sizeBytes: 100 })).toMatchObject({
      ok: true,
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(validateProductImage({ mimeType: 'image/png; charset=binary', fileName: 'a.png', sizeBytes: 20 })).toMatchObject({
      ok: true,
      mimeType: 'image/png',
      extension: 'png',
    });
    expect(validateProductImage({ fileName: 'foto.webp', sizeBytes: 20 })).toMatchObject({
      ok: true,
      mimeType: 'image/webp',
      extension: 'webp',
    });
  });

  it('rifiuta gif e i file oltre 5 MB', () => {
    expect(validateProductImage({ mimeType: 'image/gif', sizeBytes: 10 })).toEqual({
      ok: false,
      message: 'Formato non supportato. Usa JPEG, PNG o WebP.',
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
    expect(src).not.toContain("contentType: 'image/jpeg'");
  });

  it('mostra il 400 di storage', () => {
    expect(formatStorageUploadError({ statusCode: 400, message: 'mime type image/gif is not supported' })).toBe(
      '400: mime type image/gif is not supported',
    );
    expect(formatStorageUploadError({ statusCode: '413', error: 'Payload too large' })).toBe('413: Payload too large');
  });
});
