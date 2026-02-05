import { createContext, useContext, type ReactNode } from 'react';
import type { FiscalConfig } from '@/types/fiscal.types';
import { getFiscalService, type FiscalService } from '@/lib/fiscal/FiscalService';
import { supabase } from '@/lib/api/supabase';
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
     * Process an order through fiscalization
     * Fetches order details from database and calls fiscal provider
     */
    const processOrder = async (orderId: string): Promise<boolean> => {
        try {
            // Fetch order with items
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        product_id,
                        quantity,
                        unit_price,
                        total_price
                    ),
                    products:order_items (
                        product:products (
                            name,
                            ingredients
                        )
                    )
                `)
                .eq('id', orderId)
                .single();

            if (orderError) {
                console.error('Failed to fetch order:', orderError);
                return false;
            }

            if (!order) {
                console.error('Order not found:', orderId);
                return false;
            }

            // Convert order to fiscal format
            const orderData = {
                order_id: order.id,
                timestamp: order.created_at,
                payment_method: 'cash' as const, // Default, could be stored in order
                items: (order.order_items || []).map((item: any) => ({
                    product_id: item.product_id,
                    name: item.product?.name || 'Product',
                    quantity: item.quantity,
                    unit_price: Math.round(item.unit_price * 100), // Convert to cents
                    total_price: Math.round(item.total_price * 100),
                    vat_rate: 22, // Default VAT rate, could be product-specific
                })),
                total_amount: Math.round(order.total_amount * 100),
                total_vat: Math.round((order.total_amount * 22) / 122 * 100), // Simplified VAT calc
            };

            // Call fiscal service
            const result = await service.emitReceipt(orderData);

            if (result.success) {
                // Update order with fiscal success
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        fiscal_status: 'success',
                        fiscal_external_id: result.external_id,
                        pdf_url: result.pdf_url,
                    })
                    .eq('id', orderId);

                if (updateError) {
                    console.error('Failed to update order fiscal status:', updateError);
                }

                return true;
            } else {
                // Update order with fiscal error
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        fiscal_status: 'error',
                        notes: `Fiscal error: ${result.error}`,
                    })
                    .eq('id', orderId);

                if (updateError) {
                    console.error('Failed to update order fiscal status:', updateError);
                }

                Alert.alert(
                    'Errore Fiscalizzazione',
                    result.error || 'Impossibile fiscalizzare l\'ordine',
                );

                return false;
            }
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
