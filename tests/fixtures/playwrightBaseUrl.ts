/**
 * Base URL per Playwright. `127.0.0.1` diventa `localhost`: TenantContext legge l'hostname
 * a punti `127.0.0.1` come sottodominio di una pizzeria (slug "127"), fa una query in più su
 * `companies` e i test con i mock vedono richieste inattese. `localhost` usa subito la company
 * di sviluppo. Gli altri host (prod, preview) restano come sono: la guardia prod è in prodGuard.ts.
 */
export function normalizePlaywrightBaseURL(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value.replace(/^(https?:\/\/)127\.0\.0\.1(?=[:/]|$)/i, '$1localhost');
}
