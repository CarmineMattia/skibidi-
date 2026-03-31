import { supabase } from '@/lib/api/supabase';
import { useTenant } from '@/lib/stores/TenantContext';
import type { Database } from '@/types/database.types.generated';
import { useQuery } from '@tanstack/react-query';

type Order = Database['public']['Tables']['orders']['Row'];

export interface DashboardStats {
    todayRevenue: number;
    todayOrdersCount: number;
    recentOrders: Order[];
}

export function useDashboardStats() {
    const { companyId } = useTenant();

    return useQuery({
        queryKey: ['dashboard-stats', companyId],
        queryFn: async (): Promise<DashboardStats> => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            const { data: todayOrders, error: statsError } = await supabase
                .from('orders')
                .select('total_amount, status')
                .eq('company_id', companyId!)
                .gte('created_at', todayIso)
                .neq('status', 'cancelled');

            if (statsError) throw statsError;

            const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total_amount, 0);
            const todayOrdersCount = todayOrders.length;

            const { data: recentOrders, error: recentError } = await supabase
                .from('orders')
                .select('*')
                .eq('company_id', companyId!)
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;

            return {
                todayRevenue,
                todayOrdersCount,
                recentOrders: recentOrders || [],
            };
        },
        refetchInterval: 30000,
        enabled: !!companyId,
    });
}
