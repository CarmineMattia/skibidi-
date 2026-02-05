/**
 * Fiscal Retry Panel
 * Admin panel for retrying failed fiscal orders
 */

import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/api/supabase';
import { getFiscalService } from '@/lib/fiscal/FiscalService';
import type { Database } from '@/types/database.types';
import type { FiscalOrderData } from '@/types/fiscal.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

type Order = Database['public']['Tables']['orders']['Row'];

interface FiscalRetryPanelProps {
    visible: boolean;
    onClose: () => void;
}

export function FiscalRetryPanel({ visible, onClose }: FiscalRetryPanelProps) {
    const queryClient = useQueryClient();
    const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

    // Fetch failed orders
    const { data: failedOrders, error, refetch } = useQuery({
        queryKey: ['fiscal-failed-orders'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        product_id,
                        quantity,
                        unit_price,
                        total_price,
                        products!inner (
                            name
                        )
                    )
                `)
                .eq('fiscal_status', 'error')
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Failed to fetch failed orders:', error);
                return [];
            }

            return data || [];
        },
        enabled: visible,
    });

    // Retry single order
    const retryMutation = useMutation({
        mutationFn: async (orderId: string): Promise<boolean> => {
            setRetryingOrderId(orderId);

            // Fetch order with items
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        product_id,
                        quantity,
                        unit_price,
                        total_price,
                        products!inner (
                            name
                        )
                    )
                `)
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                console.error('Failed to fetch order:', orderError);
                throw new Error('Impossibile recuperare i dettagli dell\'ordine');
            }

            // Calculate totals
            const totalAmount = order.order_items?.reduce(
                (sum, item) => sum + item.total_price,
                0,
            ) || 0;
            const totalVat = Math.round((totalAmount * 22) / 122);

            // Build fiscal order data
            const fiscalData: FiscalOrderData = {
                order_id: order.id,
                customer_name: order.customer_name || undefined,
                items: (order.order_items || []).map(item => ({
                    product_id: item.product_id,
                    name: item.product?.name || 'Product',
                    quantity: item.quantity,
                    unit_price: Math.round(item.unit_price * 100),
                    total_price: Math.round(item.total_price * 100),
                    vat_rate: 22,
                })),
                total_amount: Math.round(totalAmount * 100),
                total_vat: Math.round(totalVat * 100),
                payment_method: 'cash',
                timestamp: order.created_at,
            };

            // Call fiscal service
            const fiscalService = getFiscalService();
            const result = await fiscalService.emitReceipt(fiscalData);

            if (result.success) {
                // Update order with success
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        fiscal_status: 'success',
                        fiscal_external_id: result.external_id,
                        pdf_url: result.pdf_url,
                    })
                    .eq('id', orderId);

                if (updateError) {
                    throw new Error('Fiscalizzazione completata ma impossibile aggiornare il database');
                }

                return true;
            } else {
                // Update with new error message
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        notes: `${order.notes || ''} | Fiscal retry error: ${result.error}`,
                    })
                    .eq('id', orderId);

                if (updateError) {
                    console.error('Failed to update error notes:', updateError);
                }

                throw new Error(result.error || 'Impossibile fiscalizzare l\'ordine');
            }
        },
        onSuccess: () => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: (error) => {
            Alert.alert('Errore', error instanceof Error ? error.message : 'Errore sconosciuto');
        },
        onSettled: () => {
            setRetryingOrderId(null);
        },
    });

    // Retry all orders
    const retryAll = async (): Promise<void> => {
        if (!failedOrders || failedOrders.length === 0) {
            Alert.alert('Info', 'Nessun ordine da ritentare');
            return;
        }

        const successCount = failedOrders.length;

        for (const order of failedOrders) {
            await retryMutation.mutateAsync(order.id);
            // Small delay between retries
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        Alert.alert(
            'Ripristino Completato',
            `${successCount}/${failedOrders.length} ordini fiscalizzati con successo`,
        );
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <Pressable onPress={onClose} className="flex-1 bg-black/50">
                <View className="flex-1 bg-transparent justify-end">
                    <View className="bg-card w-full max-h-[80%] rounded-t-3xl border-t border-border shadow-2xl">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-4 border-b border-border">
                            <Text className="text-xl font-bold text-card-foreground">
                                Ordini Fiscalizzati Falliti
                            </Text>
                            <Pressable onPress={onClose}>
                                <FontAwesome name="times" size={20} color="#6b7280" />
                            </Pressable>
                        </View>

                        {/* Content */}
                        <ScrollView className="flex-1 p-4">
                            {error ? (
                                <View className="items-center justify-center py-8">
                                    <FontAwesome name="exclamation-circle" size={48} color="#ef4444" />
                                    <Text className="text-card-foreground mt-4">
                                        Errore nel caricamento degli ordini
                                    </Text>
                                </View>
                            ) : !failedOrders || failedOrders.length === 0 ? (
                                <View className="items-center justify-center py-8">
                                    <FontAwesome name="check-circle" size={48} color="#22c55e" />
                                    <Text className="text-card-foreground mt-4">
                                        Nessun ordine con errori di fiscalizzazione
                                    </Text>
                                </View>
                            ) : (
                                <View className="gap-3">
                                    {failedOrders.map((order, index) => (
                                        <View
                                            key={order.id}
                                            className="bg-background border border-border rounded-lg p-4"
                                        >
                                            <View className="flex-row justify-between items-start">
                                                <View className="flex-1">
                                                    <Text className="text-card-foreground font-semibold">
                                                        Ordine #{order.id.slice(0, 8)}
                                                    </Text>
                                                    <Text className="text-muted-foreground text-sm mt-1">
                                                        {new Date(order.created_at).toLocaleString('it-IT')}
                                                    </Text>
                                                    <Text className="text-muted-foreground text-sm mt-1">
                                                        €{order.total_amount?.toFixed(2)}
                                                    </Text>
                                                </View>
                                                <View className="flex items-center">
                                                    <Text
                                                        className={`text-sm font-medium ${
                                                            order.fiscal_status === 'error'
                                                                ? 'text-yellow-700'
                                                                : 'text-green-700'
                                                        }`}
                                                    >
                                                        {order.fiscal_status === 'error'
                                                            ? 'Errore fiscalizzazione'
                                                            : 'Fiscalizzato'}
                                                    </Text>
                                                    {retryingOrderId === order.id ? (
                                                        <FontAwesome
                                                            name="spinner"
                                                            size={20}
                                                            color="#6b7280"
                                                        />
                                                    ) : (
                                                        <Pressable
                                                            onPress={() => retryMutation.mutate(order.id)}
                                                            className="ml-2"
                                                        >
                                                            <FontAwesome name="refresh" size={20} color="#3b82f6" />
                                                        </Pressable>
                                                    )}
                                                </View>
                                            </View>
                                            {order.notes && (
                                                <Text className="text-muted-foreground text-xs mt-2">
                                                    Note: {order.notes}
                                                </Text>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        {/* Footer */}
                        <View className="p-4 border-t border-border gap-3">
                            <Button
                                title={
                                    retryMutation.isPending
                                        ? 'Riprova in corso...'
                                        : 'Riprova Tutti'
                                }
                                variant="default"
                                onPress={retryAll}
                                disabled={retryMutation.isPending || !failedOrders || failedOrders.length === 0}
                            />
                            <Button
                                title="Chiudi"
                                variant="outline"
                                onPress={onClose}
                            />
                        </View>
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}
