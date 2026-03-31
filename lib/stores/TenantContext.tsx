/**
 * TenantContext
 * Resolves and exposes the current company_id for multi-tenant isolation.
 *
 * Resolution order:
 *  1. EXPO_PUBLIC_COMPANY_ID env var  (all platforms, highest priority)
 *  2. Hostname subdomain slug lookup  (web only, e.g. pizzeriamario.skibidiorders.com)
 *  3. Dev fallback: default company   (localhost / missing config)
 */

import { supabase } from '@/lib/api/supabase';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const ENV_COMPANY_ID = process.env.EXPO_PUBLIC_COMPANY_ID ?? null;
// Default company created during multi-tenant migration
const DEV_FALLBACK_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

interface TenantContextType {
  companyId: string | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [companyId, setCompanyId] = useState<string | null>(ENV_COMPANY_ID);
  const [isLoading, setIsLoading] = useState(ENV_COMPANY_ID === null);

  useEffect(() => {
    // Already resolved from env var — nothing to do
    if (ENV_COMPANY_ID) return;

    if (Platform.OS !== 'web') {
      // Native builds must use EXPO_PUBLIC_COMPANY_ID
      console.warn('[Tenant] EXPO_PUBLIC_COMPANY_ID is not set. Native builds require this env var.');
      setIsLoading(false);
      return;
    }

    // Web: resolve from subdomain slug
    const resolveFromHostname = async (): Promise<void> => {
      try {
        const hostname = globalThis?.window?.location?.hostname ?? '';
        const parts = hostname.split('.');

        // Expect <slug>.skibidiorders.com → parts[0] is slug
        // localhost or single-segment hostname → use dev fallback
        const slug = parts.length >= 3 ? parts[0] : null;

        if (!slug) {
          setCompanyId(DEV_FALLBACK_COMPANY_ID);
          return;
        }

        const { data, error } = await supabase
          .from('companies')
          .select('id')
          .eq('slug', slug)
          .eq('active', true)
          .single();

        if (error || !data) {
          console.error('[Tenant] Could not resolve company for slug:', slug, error?.message);
          setCompanyId(DEV_FALLBACK_COMPANY_ID);
          return;
        }

        setCompanyId(data.id);
      } catch (err) {
        console.error('[Tenant] Hostname resolution failed:', err);
        setCompanyId(DEV_FALLBACK_COMPANY_ID);
      } finally {
        setIsLoading(false);
      }
    };

    resolveFromHostname();
  }, []);

  return (
    <TenantContext.Provider value={{ companyId, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
