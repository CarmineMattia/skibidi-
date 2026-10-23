import { createContext, useContext, type ReactNode } from 'react';
import type { FiscalConfig } from '@/types/fiscal.types';
import { getFiscalService, type FiscalService } from '@/lib/fiscal/FiscalService';
import { supabase } from '@/lib/api/supabase';
import { fiscalProviderLabel, issueReceipt, type RpcClient } from '@/lib/fiscal/issueReceipt';
import { Alert } from 'react-native';

/**
 * Fiscal Context Interface
 */
interface FiscalContextValue {
    service: FiscalService;
    isHealthy: boolean;
    isChecking: boolean;
    checkHealth: () => Promise<void>;
    processOrder: (orderId: string) => Promise<boolean>;
    retryFailedOrders: () => Promise<number>;
}

const FiscalContext = createContext<FiscalContextValue | undefined>(undefined);

/**
 * Fiscal Provider Props
 */
interface FiscalProviderProps {
    children: ReactNode;
    config?: Partial<FiscalConfig>;
}

/**
 * Fiscal Context Provider
 * Provides fiscal service and operations throughout the app
 */
export function FiscalProvider({ children, config }: FiscalProviderProps) {
    const service = getFiscalService();

    // Update config if provided
    if (config) {
        service.updateConfig(config);
    }

    /**
     * Check if fiscal provider is healthy
     */
    const checkHealth = async (): Promise<void> => {
        const isHealthy = await service.healthCheck();
        if (!isHealthy) {
            console.warn('Fiscal provider is not healthy');
        }
    };

    /**
     * Emit the receipt for a saved order (staff only). Order data, role and
     * company checks and the outcome all go through the server RPCs
     * (lib/fiscal/issueReceipt.ts); order notes are never written.
     */
    const processOrder = async (orderId: string): Promise<boolean> => {
        try {
            const result = await issueReceipt(orderId, {
                rpc: supabase as unknown as RpcClient,
                emitter: service,
                paymentMethod: 'cash',
                provider: fiscalProviderLabel(service.getConfig()),
            });
            if (result.outcome === 'failed') {
                Alert.alert('Errore Fiscalizzazione', result.error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error processing order:', error);
            return false;
        }
    };

    /**
     * Retry all failed fiscal orders
     */
    const retryFailedOrders = async (): Promise<number> => {
        try {
            // Fetch orders with fiscal error status
            const { data: failedOrders, error } = await supabase
                .from('orders')
                .select('id')
                .eq('fiscal_status', 'error')
                .order('created_at', { ascending: true })
                .limit(10);

            if (error) {
                console.error('Failed to fetch failed orders:', error);
                return 0;
            }

            if (!failedOrders || failedOrders.length === 0) {
                Alert.alert('Info', 'Nessun ordine da ritentare');
                return 0;
            }

            let successCount = 0;

            for (const order of failedOrders) {
                const success = await processOrder(order.id);
                if (success) {
                    successCount++;
                }
                // Small delay between retries
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            Alert.alert(
                'Ripristino Completato',
                `${successCount}/${failedOrders.length} ordini fiscalizzati con successo`,
            );

            return successCount;
        } catch (error) {
            console.error('Error retrying failed orders:', error);
            return 0;
        }
    };

    const value: FiscalContextValue = {
        service,
        isHealthy: true, // Could be tracked with state
        isChecking: false, // Could be tracked with state
        checkHealth,
        processOrder,
        retryFailedOrders,
    };

    return <FiscalContext.Provider value={value}>{children}</FiscalContext.Provider>;
}

/**
 * Hook to access fiscal context
 */
export function useFiscal(): FiscalContextValue {
    const context = useContext(FiscalContext);

    if (!context) {
        throw new Error('useFiscal must be used within FiscalProvider');
    }

    return context;
}

/**
 * Hook to process an order with loading state
 */
export function useFiscalProcessOrder() {
    const { processOrder } = useFiscal();

    return async (orderId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const success = await processOrder(orderId);
            return { success };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    };
}
