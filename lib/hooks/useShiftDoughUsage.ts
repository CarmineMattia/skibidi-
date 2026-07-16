import { supabase } from '@/lib/api/supabase';
import { useTenant } from '@/lib/stores/TenantContext';
import { useQuery } from '@tanstack/react-query';

interface UseShiftDoughUsageOptions {
  shiftStartedAt: string | null;
  shiftDoughBallsTotal: number | null;
  enabled?: boolean;
}

export function useShiftDoughUsage({
  shiftStartedAt,
  shiftDoughBallsTotal,
  enabled = true,
}: UseShiftDoughUsageOptions) {
  const { companyId } = useTenant();
  const isTrackingEnabled =
    enabled && !!companyId && !!shiftStartedAt && shiftDoughBallsTotal !== null && shiftDoughBallsTotal > 0;

  const query = useQuery({
    queryKey: ['shift-dough-usage', companyId, shiftStartedAt],
    enabled: isTrackingEnabled,
    refetchInterval: 30_000,
    queryFn: async (): Promise<number> => {
      if (!companyId || !shiftStartedAt) return 0;

      const { data, error } = await supabase.rpc('get_shift_dough_usage', {
        p_company: companyId,
        p_since: shiftStartedAt,
      });

      if (error) throw error;
      const used = Number(data);
      return Number.isFinite(used) && used >= 0 ? used : 0;
    },
  });

  const rpcErrorCode =
    query.error && typeof query.error === 'object' && 'code' in query.error
      ? String((query.error as { code?: unknown }).code ?? '')
      : '';
  const isRpcMissing = isTrackingEnabled && rpcErrorCode === 'PGRST202';
  const hasTrackingError = isTrackingEnabled && !!query.error;
  const usedUnits = isTrackingEnabled ? (query.data ?? 0) : 0;
  const totalUnits = shiftDoughBallsTotal ?? 0;
  const remainingUnits =
    isTrackingEnabled && totalUnits > 0 && !hasTrackingError
      ? Math.max(0, Math.round((totalUnits - usedUnits) * 10) / 10)
      : null;

  return {
    usedUnits,
    totalUnits,
    remainingUnits,
    isTrackingEnabled,
    isRpcMissing,
    hasTrackingError,
    trackingError: query.error,
    isLoading: isTrackingEnabled && query.isLoading,
    refetch: query.refetch,
  };
}
