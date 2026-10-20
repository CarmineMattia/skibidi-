import { describe, expect, test } from 'vitest';
import {
  AntiabuseError,
  getAntiabuseCode,
  getAntiabuseMessage,
  getTurnstileSiteKey,
  isAntiabuseError,
  isTurnstileEnabled,
} from '../../lib/utils/antiabuse';

describe('antiabuso: errori del server', () => {
  test('riconosce i codici anche dentro il messaggio PostgREST', () => {
    expect(getAntiabuseCode('ANTIABUSE_RATE_LIMITED')).toBe('ANTIABUSE_RATE_LIMITED');
    expect(getAntiabuseCode('ERROR: P0001: ANTIABUSE_ACCOUNT_BLOCKED')).toBe('ANTIABUSE_ACCOUNT_BLOCKED');
    expect(getAntiabuseCode('Invalid order lines')).toBeNull();
    expect(getAntiabuseCode('ANTIABUSE_SOMETHING_ELSE')).toBeNull();
    expect(getAntiabuseCode(undefined)).toBeNull();
  });

  test('messaggi in italiano e inglese per tutti i codici', () => {
    for (const code of [
      'ANTIABUSE_LOGIN_REQUIRED',
      'ANTIABUSE_ACCOUNT_BLOCKED',
      'ANTIABUSE_ORDER_TOO_LARGE',
      'ANTIABUSE_TOO_MANY_OPEN_ORDERS',
      'ANTIABUSE_RATE_LIMITED',
      'ANTIABUSE_CAPTCHA_REQUIRED',
    ]) {
      expect(getAntiabuseMessage(code)).toBeTruthy();
      expect(getAntiabuseMessage(code, 'en')).toBeTruthy();
    }
    expect(getAntiabuseMessage('ANTIABUSE_ORDER_TOO_LARGE')).toContain('chiama la pizzeria');
  });

  test('AntiabuseError è riconoscibile', () => {
    expect(isAntiabuseError(new AntiabuseError('x'))).toBe(true);
    expect(isAntiabuseError(new Error('x'))).toBe(false);
    expect(isAntiabuseError('x')).toBe(false);
  });
});

describe('antiabuso: flag Turnstile', () => {
  test('spento senza site key', () => {
    expect(isTurnstileEnabled(undefined)).toBe(false);
    expect(isTurnstileEnabled('   ')).toBe(false);
    expect(getTurnstileSiteKey('')).toBeNull();
  });
  test('acceso con site key', () => {
    expect(isTurnstileEnabled('0x4AAAAAAA')).toBe(true);
    expect(getTurnstileSiteKey(' 0x4AAAAAAA ')).toBe('0x4AAAAAAA');
  });
});
