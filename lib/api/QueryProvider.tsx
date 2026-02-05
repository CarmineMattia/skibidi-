/**
 * Query Provider
 * Provider per TanStack Query (React Query)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Configurazione ottimizzata per POS
      staleTime: 1000 * 60 * 5, // 5 minuti
      gcTime: 1000 * 60 * 10, // 10 minuti (ex cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
