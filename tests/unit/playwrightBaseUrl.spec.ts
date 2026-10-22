import { describe, expect, test } from 'vitest';
import { normalizePlaywrightBaseURL } from '../fixtures/playwrightBaseUrl';

describe('Playwright baseURL', () => {
  test('127.0.0.1 diventa localhost (porta e percorso invariati)', () => {
    expect(normalizePlaywrightBaseURL('http://127.0.0.1:4173')).toBe('http://localhost:4173');
    expect(normalizePlaywrightBaseURL('http://127.0.0.1:8081/menu')).toBe('http://localhost:8081/menu');
    expect(normalizePlaywrightBaseURL('http://127.0.0.1')).toBe('http://localhost');
    expect(normalizePlaywrightBaseURL(' https://127.0.0.1:4173 ')).toBe('https://localhost:4173');
  });
  test('gli altri host restano uguali', () => {
    expect(normalizePlaywrightBaseURL('http://localhost:4173')).toBe('http://localhost:4173');
    expect(normalizePlaywrightBaseURL('http://127.0.0.10:4173')).toBe('http://127.0.0.10:4173');
    expect(normalizePlaywrightBaseURL('https://skibidi-eight-virid.vercel.app')).toBe('https://skibidi-eight-virid.vercel.app');
  });
  test('vuoto = server di sviluppo di default', () => {
    expect(normalizePlaywrightBaseURL(undefined)).toBeUndefined();
    expect(normalizePlaywrightBaseURL('  ')).toBeUndefined();
  });
});
