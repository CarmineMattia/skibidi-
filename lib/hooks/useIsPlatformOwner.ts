import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';
import { useAuth } from '@/lib/stores/AuthContext';

/** True solo se la RPC conferma la riga in platform_owners. Un errore (migration assente) non apre l'accesso. */
export function useIsPlatformOwner() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: ['is-platform-owner', user?.id ?? null],
    enabled: Boolean(isAuthenticated && user?.id),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_owner');
      if (error) return false;
      return data === true;
    },
  });
}
