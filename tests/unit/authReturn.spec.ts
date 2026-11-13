import { describe, expect, it } from 'vitest';
import {
  AUTH_REQUIRED_ROUTES,
  authReturnFromStored,
  authRouteKey,
  resolveAuthRedirect,
  returnPathFromLocation,
  safeAuthReturnPath,
} from '../../lib/utils/authReturn';

const ORDER_ID = '00000000-0000-4000-8000-0000000000ab';
const TRACKING = `/order-tracking?orderId=${ORDER_ID}`;

describe('ritorno al tracking dopo il login Google', () => {
  it('accetta solo /order-tracking con un uuid e scarta il resto della query', () => {
    expect(safeAuthReturnPath(TRACKING)).toBe(TRACKING);
    expect(safeAuthReturnPath(`${TRACKING}&orderType=delivery&next=https://evil.example`)).toBe(`${TRACKING}&orderType=delivery`);
    expect(safeAuthReturnPath(`/order-tracking?orderId=${ORDER_ID.toUpperCase()}`)).toBe(TRACKING);
    for (const bad of [
      null,
      '',
      'https://evil.example/order-tracking?orderId=' + ORDER_ID,
      `//evil.example/order-tracking?orderId=${ORDER_ID}`,
      `/\\evil`,
      'order-tracking?orderId=' + ORDER_ID,
      '/order-tracking?orderId=not-a-uuid',
      '/menu',
      '/login',
      `javascript:alert(1)`,
      `/order-tracking/../login?orderId=${ORDER_ID}`,
    ]) {
      expect(safeAuthReturnPath(bad)).toBeNull();
    }
  });

  it('legge next solo se è il tracking, anche da /login', () => {
    const next = encodeURIComponent(TRACKING);
    expect(returnPathFromLocation(`/login?next=${next}`)).toBe(TRACKING);
    expect(returnPathFromLocation(`/login?next=${encodeURIComponent('https://evil.example')}`)).toBeNull();
    expect(returnPathFromLocation(TRACKING)).toBe(TRACKING);
  });

  it('manda al login e, dopo Google, di nuovo sul tracking', () => {
    expect(authRouteKey(['(tabs)', 'order-tracking'])).toBe('order-tracking');
    expect(AUTH_REQUIRED_ROUTES.has('order-tracking')).toBe(true);
    const loggedOut = resolveAuthRedirect({
      isLoading: false,
      isAuthenticated: false,
      route: 'order-tracking',
      location: TRACKING,
      storedReturn: null,
    });
    expect(loggedOut).toEqual({ action: 'login', remember: TRACKING });

    const back = resolveAuthRedirect({
      isLoading: false,
      isAuthenticated: true,
      route: 'login',
      location: '/login',
      storedReturn: TRACKING,
    });
    expect(back).toEqual({ action: 'replace', href: TRACKING, clearStored: true });
  });

  it('senza un ritorno valido il login porta al menu; il checkout non ricorda un next esterno', () => {
    expect(resolveAuthRedirect({
      isLoading: false,
      isAuthenticated: true,
      route: 'login',
      location: '/login',
      storedReturn: null,
    })).toEqual({ action: 'replace', href: '/(tabs)/menu', clearStored: false });
    expect(resolveAuthRedirect({
      isLoading: false,
      isAuthenticated: false,
      route: 'modal',
      location: '/modal',
      storedReturn: null,
    })).toEqual({ action: 'login', remember: null });
    expect(resolveAuthRedirect({
      isLoading: true,
      isAuthenticated: false,
      route: 'order-tracking',
      location: TRACKING,
      storedReturn: null,
    })).toEqual({ action: 'none', remember: null });
    expect(resolveAuthRedirect({
      isLoading: false,
      isAuthenticated: true,
      route: 'order-tracking',
      location: TRACKING,
      storedReturn: null,
    })).toEqual({ action: 'none', remember: null });
  });

  it('il ritorno salvato scade dopo 30 minuti', () => {
    const now = Date.parse('2026-11-13T10:00:00Z');
    expect(authReturnFromStored({ path: TRACKING, at: now }, now + 29 * 60 * 1000)).toBe(TRACKING);
    expect(authReturnFromStored({ path: TRACKING, at: now }, now + 31 * 60 * 1000)).toBeNull();
    expect(authReturnFromStored({ path: 'https://evil.example', at: now }, now)).toBeNull();
    expect(authReturnFromStored({ path: TRACKING, at: now + 120_000 }, now)).toBeNull();
  });
});
