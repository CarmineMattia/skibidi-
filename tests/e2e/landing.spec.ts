import { expect, test, type Page } from '@playwright/test';

const WA_PREFIX = 'https://wa.me/3905221717681';

/** WhatsApp: vero <a href> (Invio, pressione lunga), sopra la piega e fuori dalla tab bar. */
async function expectWhatsAppAboveFold(page: Page) {
  const wa = page.getByRole('link', { name: 'Scrivici su WhatsApp' });
  await wa.waitFor({ timeout: 15_000 });
  await expect(wa).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Ordina le pizze' })).toBeInViewport({ ratio: 1 });
  await expect(wa).toHaveAttribute('href', new RegExp(`^${WA_PREFIX}\\?text=`));
  await expect(wa).toHaveAttribute('target', '_blank');
  await expect(wa).toHaveAttribute('rel', /noopener/);

  // La CTA non deve finire sotto la tab bar in basso (se presente).
  const waBox = await wa.boundingBox();
  const tabBarTop = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"], [role="tablist"]'));
    const tops = tabs.map((el) => el.getBoundingClientRect().top).filter((t) => t > 0);
    return tops.length ? Math.min(...tops) : window.innerHeight;
  });
  expect(waBox!.y + waBox!.height).toBeLessThanOrEqual(tabBarTop + 1);

  // Invio da tastiera apre la chat (popup intercettato: nessuna richiesta reale).
  await page.context().route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }));
  const popupPromise = page.context().waitForEvent('page');
  await wa.focus();
  await page.keyboard.press('Enter');
  const popup = await popupPromise;
  expect(popup.url()).toContain(WA_PREFIX);
}

/** Le etichette della barra in alto non devono essere troncate ("Offer…"). */
async function expectNavLabelsNotTruncated(page: Page) {
  for (const name of ['Menu', 'Offerte']) {
    await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible({ timeout: 15_000 });
  }
  const truncated = await page.evaluate(() =>
    ['Menu', 'Offerte', 'Chiama']
      .map((label) => {
        const el = Array.from(document.querySelectorAll('a, [role="link"]'))
          .flatMap((a) => Array.from(a.querySelectorAll('div')))
          .find((d) => d.textContent === label && d.children.length === 0);
        if (!el) return `manca ${label}`;
        return el.scrollWidth > el.clientWidth + 1 ? label : null;
      })
      .filter(Boolean),
  );
  expect(truncated).toEqual([]);
}

test.describe('Landing Ambrosia', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('mostra identità, servizi e contatti pubblici', async ({ page }) => {
    await expect(page.getByText('Il nettare', { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Tradizione nel forno', { exact: false })).toBeVisible();
    await expect(page.getByText('€2,50').first()).toBeVisible();

    await expect(page.getByText('Orari di apertura')).toBeAttached();
    await expect(page.getByText('0522 171 7681').first()).toBeVisible();
  });

  test('barra in alto: solo Menu, Offerte e Chiama', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Menu', exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'Offerte', exact: true }).first()).toBeVisible();
    const call = page.getByRole('link', { name: 'Chiama 0522 171 7681' }).first();
    await expect(call).toBeVisible();
    await expect(call).toHaveAttribute('href', 'tel:+3905221717681');
    await expect(page.getByRole('link', { name: 'Gallery' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Contatti', exact: true })).toHaveCount(0);
  });

  test('WhatsApp visibile subito accanto a "Ordina le pizze"', async ({ page }) => {
    await expectWhatsAppAboveFold(page);
  });

  test('da tastiera: Invio su Offerte apre /offers', async ({ page }) => {
    const offers = page.getByRole('link', { name: 'Offerte', exact: true }).first();
    await offers.waitFor({ timeout: 15_000 });
    await expect(offers).toHaveAttribute('href', '/offers');
    await offers.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/offers(?:\?.*)?$/, { timeout: 15_000 });
  });

  test('porta dal hero al menu ordini', async ({ page }) => {
    const hero = page.getByRole('button', { name: 'Ordina le pizze' });
    await hero.waitFor({ timeout: 15_000 });
    await hero.click();
    await expect(page).toHaveURL(/\/menu(?:\?.*)?$/, { timeout: 15_000 });
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`Landing Ambrosia mobile ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });

    test.beforeEach(async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    });

    test('barra: Menu / Offerte / Chiama senza etichette troncate', async ({ page }) => {
      await expectNavLabelsNotTruncated(page);
      await expect(page.getByRole('link', { name: 'Gallery' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Contatti', exact: true })).toHaveCount(0);
    });

    test('WhatsApp e "Ordina le pizze" sopra la piega', async ({ page }) => {
      await expectWhatsAppAboveFold(page);
    });
  });
}
