import { supabase } from '@/lib/api/supabase';
import type { Database } from '@/types/database.types.generated';
import { useQuery } from '@tanstack/react-query';

type Order = Database['public']['Tables']['orders']['Row'];

export interface DashboardStats {
    todayRevenue: number;
    todayOrdersCount: number;
    recentOrders: Order[];
}

export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async (): Promise<DashboardStats> => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            // Fetch today's orders for stats
            const { data: todayOrders, error: statsError } = await supabase
                .from('orders')
                .select('total_amount, status')
                .gte('created_at', todayIso)
                .neq('status', 'cancelled');

            if (statsError) throw statsError;

            const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total_amount, 0);
            const todayOrdersCount = todayOrders.length;

            // Fetch recent orders
            const { data: recentOrders, error: recentError } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;

            return {
                todayRevenue,
                todayOrdersCount,
                recentOrders: recentOrders || [],
            };
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    });
}
