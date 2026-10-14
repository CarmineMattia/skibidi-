import type { Page } from '@playwright/test';

/**
 * Blocca tutto il traffico verso Supabase: letture vuote, nessuna mutazione.
 * Chiamare PRIMA di mockLoggedInUser (le rotte registrate dopo hanno priorità).
 */
export async function mockEmptyBackend(page: Page) {
  await page.route('**/rest/v1/**', (route) =>
    route.request().method() === 'GET' || route.request().method() === 'HEAD'
      ? route.fulfill({ json: [] })
      : route.fulfill({ status: 503, json: { error: 'Test: no backend mutations' } }),
  );
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, json: { error: 'test only' } }));
  await page.route('**/realtime/v1/**', (route) => route.abort());
}
