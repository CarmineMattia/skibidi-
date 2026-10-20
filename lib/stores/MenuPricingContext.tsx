/**
 * MenuPricingContext
 * Loads the pizzeria listino (public.menu_pricing.config) — the same data the
 * server uses to price orders — and applies it to the client pricing
 * constants. Until it arrives (or if it can't be read) the built-in defaults
 * are used; they equal the migration seed.
 */

import { supabase } from '@/lib/api/supabase';
import { applyMenuPricingConfig } from '@/lib/data/menuPricing';
import { useTenant } from '@/lib/stores/TenantContext';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

/** Bumps when the server listino has been applied: use it as a memo dependency. */
const MenuPricingVersionContext = createContext(0);

export function useMenuPricingVersion(): number {
  return useContext(MenuPricingVersionContext);
}

export function MenuPricingProvider({ children }: { children: ReactNode }) {
  const { companyId } = useTenant();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('menu_pricing')
          .select('config')
          .eq('company_id', companyId)
          .maybeSingle();
        if (cancelled || error || !data) return;
        if (applyMenuPricingConfig(data.config)) setVersion((current) => current + 1);
      } catch {
        // Keep the built-in listino.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return <MenuPricingVersionContext.Provider value={version}>{children}</MenuPricingVersionContext.Provider>;
}
