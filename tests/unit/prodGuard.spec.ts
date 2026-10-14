import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectProd, mustSkipRealAuth, refFromJwt, resolvedSupabaseUrl, targetsProd } from '../fixtures/prodGuard';

const REF = 'zqubwvhstobaugifzoyb';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;

const dirs: string[] = [];
function tmpProject(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prodguard-'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
const empty = () => tmpProject({});

describe('prodGuard', () => {
  it('placeholder: non è prod', () => {
    expect(targetsProd({ EXPO_PUBLIC_SUPABASE_URL: 'https://e2e-placeholder.supabase.co' }, empty())).toBe(false);
    expect(targetsProd({}, empty())).toBe(false);
  });

  it('ref di prod nel URL, in qualsiasi maiuscolo/minuscolo', () => {
    expect(detectProd([{ EXPO_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co` }])).toBe(true);
    expect(detectProd([{ EXPO_PUBLIC_SUPABASE_URL: `https://${REF.toUpperCase()}.SUPABASE.CO` }])).toBe(true);
    expect(detectProd([{ EXPO_PUBLIC_SUPABASE_URL: 'https://ZqUbWvHsToBaUgIfZoYb.supabase.co' }])).toBe(true);
  });

  it('custom domain di prod configurato', () => {
    const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://API.Ambrosia.example/', E2E_PROD_SUPABASE_HOSTS: 'db.other.example, api.ambrosia.example' };
    expect(detectProd([env])).toBe(true);
    expect(detectProd([{ ...env, EXPO_PUBLIC_SUPABASE_URL: 'https://staging.ambrosia.example' }])).toBe(false);
  });

  it('ref di prod decodificato dalla anon key JWT (anche con URL custom)', () => {
    expect(refFromJwt(jwt({ ref: REF, role: 'anon' }))).toBe(REF);
    expect(detectProd([{ EXPO_PUBLIC_SUPABASE_URL: 'https://api.custom.example', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: REF }) }])).toBe(true);
    expect(detectProd([{ SUPABASE_ANON_KEY: jwt({ ref: REF.toUpperCase() }) }])).toBe(true);
    expect(detectProd([{ EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: 'abcdefghijklmnopqrst' }) }])).toBe(false);
    expect(refFromJwt('e2e-placeholder-anon-key')).toBeNull();
  });

  it('SUPABASE_URL senza prefisso EXPO_PUBLIC_', () => {
    expect(targetsProd({ SUPABASE_URL: `https://${REF}.supabase.co` }, empty())).toBe(true);
  });

  it('legge sia .env sia .env.local', () => {
    expect(targetsProd({}, tmpProject({ '.env': `EXPO_PUBLIC_SUPABASE_URL=https://${REF}.supabase.co\n` }))).toBe(true);
    const local = tmpProject({ '.env.local': `SUPABASE_URL="https://${REF}.supabase.co"\n` });
    expect(targetsProd({}, local)).toBe(true);
    expect(resolvedSupabaseUrl({}, local)).toBe(`https://${REF}.supabase.co`);
    expect(targetsProd({}, tmpProject({ '.env.local': `EXPO_PUBLIC_SUPABASE_ANON_KEY=${jwt({ ref: REF })}\n` }))).toBe(true);
  });

  it('base URL: sito di prod e preview Vercel', () => {
    expect(detectProd([{ PLAYWRIGHT_BASE_URL: 'https://skibidi-eight-virid.vercel.app' }])).toBe(true);
    expect(detectProd([{ PLAYWRIGHT_BASE_URL: 'https://skibidi-a1b2c3d4e-carminemattias-projects.vercel.app/menu' }])).toBe(true);
    expect(detectProd([{ PLAYWRIGHT_BASE_URL: 'https://skibidi-git-feat-x-carminemattias-projects.vercel.app' }])).toBe(true);
    expect(detectProd([{ PLAYWRIGHT_BASE_URL: 'http://localhost:8081' }])).toBe(false);
  });

  it('opt-in E2E_ALLOW_PROD=1 disattiva lo skip', () => {
    const dir = empty();
    expect(mustSkipRealAuth({ SUPABASE_URL: `https://${REF}.supabase.co` }, dir)).toBe(true);
    expect(mustSkipRealAuth({ SUPABASE_URL: `https://${REF}.supabase.co`, E2E_ALLOW_PROD: '1' }, dir)).toBe(false);
  });
});
