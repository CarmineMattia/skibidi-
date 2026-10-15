import { mustSkipRealAuth, PROD_OPT_IN_ENV, targetsProd } from './fixtures/prodGuard';

export default async function globalSetup() {
  if (!targetsProd()) return;
  if (mustSkipRealAuth()) {
    console.warn(`\n⚠️  E2E contro PROD: i test con login reali o scritture verranno saltati (opt-in: ${PROD_OPT_IN_ENV}=1).\n`);
  } else {
    if (process.env.CI) throw new Error(`${PROD_OPT_IN_ENV}=1 non è ammesso in CI`);
    console.warn(`\n🚨 E2E contro PROD con ${PROD_OPT_IN_ENV}=1: login reali e scritture ABILITATI.\n`);
  }
}
