const { chromium, devices } = require('playwright');

async function run() {
  const base = process.env.BASE_URL || 'http://localhost:8091';
  const out = [];
  const push = (name, ok, detail) => {
    out.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${name} :: ${detail}`);
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  async function gotoRetry(path) {
    let lastError;
    for (let i = 0; i < 6; i += 1) {
      try {
        await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);
        return;
      } catch (error) {
        lastError = error;
        await page.waitForTimeout(2000);
      }
    }
    throw lastError;
  }

  async function tryLogin(email, password) {
    await gotoRetry('/login');
    const emailInput = page.locator('input[type=\"email\"]').first();
    const passInput = page.locator('input[type=\"password\"]').first();
    if ((await emailInput.count()) === 0 || (await passInput.count()) === 0) return false;

    await emailInput.click({ timeout: 10000 });
    await emailInput.fill(email, { timeout: 10000 });
    await passInput.click({ timeout: 10000 });
    await passInput.fill(password, { timeout: 10000 });
    await page.getByRole('button', { name: /Accedi|Login/i }).first().click();
    await page.waitForTimeout(2500);
    return !page.url().includes('/login');
  }

  try {
    await gotoRetry('/');
    await page.screenshot({ path: 'test-mobile-user-home.png', fullPage: true });
    push('Mobile home loads', true, page.url());

    await gotoRetry('/menu');
    const addBtn = page.getByRole('button', { name: /Aggiungi/i }).first();
    await addBtn.waitFor({ timeout: 45000 });
    await addBtn.click();
    await page.waitForTimeout(1200);

    // In this UI flow, tapping add first opens product details modal on mobile.
    const hasDetailsModal = (await page.getByText(/Aggiungi al carrello|Dettagli|Ingredienti/i).count()) > 0;
    push(
      'Open product details/modal',
      hasDetailsModal,
      hasDetailsModal ? 'product modal/details opened' : 'product modal/details not detected'
    );

    const cartCta = page.getByText(/Vedi Carrello/i);
    if ((await cartCta.count()) > 0) {
      await cartCta.first().click();
      await page.waitForTimeout(1500);
      const hasCarrello = (await page.getByText(/Carrello/i).count()) > 0;
      push('Open cart modal', hasCarrello, hasCarrello ? 'cart modal opened' : 'cart modal not opened');
    }

    await page.screenshot({ path: 'test-mobile-user-menu-cart.png', fullPage: true });
  } catch (error) {
    push('User flow', false, String(error.message || error).slice(0, 180));
  }

  let adminLogged = false;
  try {
    // Use a clean mobile session for admin flow.
    await context.close();
    const adminContext = await browser.newContext({ ...devices['iPhone 12'] });
    const adminPage = await adminContext.newPage();
    adminPage.setDefaultTimeout(25000);

    const gotoRetryAdmin = async (path) => {
      let lastError;
      for (let i = 0; i < 6; i += 1) {
        try {
          await adminPage.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await adminPage.waitForTimeout(1200);
          return;
        } catch (error) {
          lastError = error;
          await adminPage.waitForTimeout(2000);
        }
      }
      throw lastError;
    };

    const tryLoginAdmin = async (email, password) => {
      await gotoRetryAdmin('/login');
      const emailInput = adminPage.locator('input[type=\"email\"]').first();
      const passInput = adminPage.locator('input[type=\"password\"]').first();
      if ((await emailInput.count()) === 0 || (await passInput.count()) === 0) return false;
      await emailInput.fill(email, { timeout: 10000 });
      await passInput.fill(password, { timeout: 10000 });
      await adminPage.getByRole('button', { name: /Accedi|Login/i }).first().click();
      await adminPage.waitForTimeout(2500);
      return !adminPage.url().includes('/login');
    };

    const credentials = [
      ['admin@skibidi.com', 'password123'],
      ['admin@skibidi.com', 'Admin123!'],
    ];

    for (const [email, password] of credentials) {
      if (await tryLoginAdmin(email, password)) {
        adminLogged = true;
        push('Admin login', true, `${email} authenticated`);
        break;
      }
    }

    if (!adminLogged) {
      push('Admin login', false, 'credentials failed (password123/Admin123!)');
    } else {
      await gotoRetryAdmin('/menu');
      const addVisible = (await adminPage.getByRole('button', { name: /Aggiungi/i }).count()) > 0;
      push('Admin menu visible', addVisible, addVisible ? 'products/actions visible' : 'menu actions missing');

      await gotoRetryAdmin('/kitchen');
      const kitchenTitle = (await adminPage.getByText(/Cucina/i).count()) > 0;
      push('Kitchen screen opens', kitchenTitle, kitchenTitle ? 'kitchen loaded' : 'kitchen title missing');

      const actionBtn = adminPage.getByRole('button', { name: /Inizia Preparazione|Segna come Pronto/i }).first();
      if ((await actionBtn.count()) > 0) {
        await actionBtn.click();
        await adminPage.waitForTimeout(1200);
        push('Kitchen primary action clickable', true, 'button click executed');
      } else {
        push('Kitchen primary action clickable', false, 'no action button found');
      }

      await adminPage.screenshot({ path: 'test-mobile-admin-kitchen.png', fullPage: true });
    }
    await adminContext.close();
  } catch (error) {
    push('Admin flow', false, String(error.message || error).slice(0, 180));
  }

  await browser.close();
  console.log(`RESULT_JSON:${JSON.stringify(out)}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
