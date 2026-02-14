/**
 * Digital Receipt Component
 * Displays fiscal receipt with PDF download option
 */

import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/api/supabase';
import type { Database } from '@/types/database.types';
import { useQuery } from '@tanstack/react-query';
import { FontAwesome } from '@expo/vector-icons';
import { Linking, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';

type Order = Database['public']['Tables']['orders']['Row'];

interface DigitalReceiptProps {
    visible: boolean;
    orderId: string;
    onClose: () => void;
}

export function DigitalReceipt({ visible, orderId, onClose }: DigitalReceiptProps) {
    // Fetch order with items for receipt display
    const { data: order, isLoading, error } = useQuery({
        queryKey: ['receipt', orderId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        quantity,
                        unit_price,
                        total_price,
                        notes,
                        products!inner (
                            name,
                            price,
                            category
                        )
                    )
                `)
                .eq('id', orderId)
                .single();

            if (error) {
                console.error('Failed to fetch receipt data:', error);
                throw error;
            }

            return data;
        },
        enabled: visible && !!orderId,
    });

    const handleDownloadPdf = async (): Promise<void> => {
        if (!order?.pdf_url) {
            console.error('No PDF URL available');
            return;
        }

        try {
            await Linking.openURL(order.pdf_url);
        } catch (error) {
            console.error('Failed to open PDF:', error);
        }
    };

    const handleShareReceipt = async (): Promise<void> => {
        if (!order) return;

        const receiptText = formatReceiptText(order);

        try {
            await Share.share({
                message: receiptText,
                title: 'Scontrino',
            });
        } catch (error) {
            console.error('Failed to share receipt:', error);
        }
    };

    const formatReceiptText = (orderData: Order): string => {
        const date = new Date(orderData.created_at).toLocaleString('it-IT');
        const items = orderData.order_items || [];

        let text = `SKIBIDI ORDERS - SCONTRINO\n`;
        text += `=================================\n`;
        text += `Data: ${date}\n`;
        text += `Ordine: #${orderData.id.slice(0, 8)}\n`;
        text += `=================================\n\n`;

        if (orderData.customer_name) {
            text += `Cliente: ${orderData.customer_name}\n`;
            text += `---------------------------------\n\n`;
        }

        items.forEach((item, index) => {
            const price = item.unit_price?.toFixed(2) || '0.00';
            const total = item.total_price?.toFixed(2) || '0.00';
            text += `${index + 1}. ${item.product?.name || 'Product'}\n`;
            text += `   ${item.quantity} x €${price} = €${total}\n`;
            if (item.notes) {
                text += `   (${item.notes})\n`;
            }
        });

        text += `\n`;
        text += `---------------------------------\n`;
        text += `TOTALE: €${orderData.total_amount?.toFixed(2) || '0.00'}\n`;

        if (orderData.fiscal_status === 'success') {
            text += `IVA: €${((orderData.total_amount || 0) * 0.22).toFixed(2)}\n`;
            text += `Scontrino #${orderData.fiscal_external_id || 'N/A'}\n`;
        } else if (orderData.fiscal_status === 'error') {
            text += `⚠️ ERRORE FISCALIZZAZIONE\n`;
        }

        text += `\n`;
        text += `=================================\n`;
        text += `Grazie per l'acquisto!\n`;

        return text;
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <Pressable onPress={onClose} className="flex-1 bg-black/50">
                <View className="flex-1 justify-center items-center p-4">
                    <View className="bg-card w-full max-w-md rounded-2xl shadow-2xl max-h-[90%]">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-4 border-b border-border">
                            <Text className="text-xl font-bold text-card-foreground">
                                Scontrino
                            </Text>
                            <Pressable onPress={onClose}>
                                <FontAwesome name="times" size={24} color="#6b7280" />
                            </Pressable>
                        </View>

                        {/* Content */}
                        <ScrollView className="flex-1">
                            {isLoading ? (
                                <View className="items-center justify-center py-12">
                                    <FontAwesome name="spinner" size={48} color="#3b82f6" />
                                    <Text className="text-card-foreground mt-4">
                                        Caricamento scontrino...
                                    </Text>
                                </View>
                            ) : error ? (
                                <View className="items-center justify-center py-12">
                                    <FontAwesome name="exclamation-triangle" size={48} color="#ef4444" />
                                    <Text className="text-card-foreground mt-4">
                                        Errore nel caricamento dello scontrino
                                    </Text>
                                </View>
                            ) : order ? (
                                <View className="p-4">
                                    {/* Receipt Header */}
                                    <View className="border border-border rounded-lg p-4 mb-4 bg-background">
                                        <Text className="text-center text-card-foreground font-bold mb-2">
                                            SKIBIDI ORDERS
                                        </Text>
                                        <Text className="text-center text-muted-foreground text-xs">
                                            Scontrino Fiscale
                                        </Text>
                                    </View>

                                    {/* Order Info */}
                                    <View className="border border-border rounded-lg p-3 mb-4 bg-background">
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Text className="text-muted-foreground text-sm">
                                                Data:
                                            </Text>
                                            <Text className="text-card-foreground text-sm font-medium">
                                                {new Date(order.created_at).toLocaleString('it-IT')}
                                            </Text>
                                        </View>
                                        <View className="flex-row justify-between items-center">
                                            <Text className="text-muted-foreground text-sm">
                                                Ordine:
                                            </Text>
                                            <Text className="text-card-foreground text-sm font-medium">
                                                #{order.id.slice(0, 8)}
                                            </Text>
                                        </View>
                                        {order.customer_name && (
                                            <View className="flex-row justify-between items-center mt-1">
                                                <Text className="text-muted-foreground text-sm">
                                                    Cliente:
                                                </Text>
                                                <Text className="text-card-foreground text-sm font-medium">
                                                    {order.customer_name}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Items */}
                                    <View className="border border-border rounded-lg overflow-hidden mb-4">
                                        <View className="flex-row bg-muted/20 p-2">
                                            <Text className="flex-1 text-muted-foreground text-xs font-semibold">
                                                Descrizione
                                            </Text>
                                            <View className="w-20 text-center">
                                                <Text className="text-muted-foreground text-xs font-semibold">
                                                    Qta
                                                </Text>
                                            </View>
                                            <View className="w-20 text-center">
                                                <Text className="text-muted-foreground text-xs font-semibold">
                                                    Prezzo
                                                </Text>
                                            </View>
                                            <View className="w-20 text-center">
                                                <Text className="text-muted-foreground text-xs font-semibold">
                                                    Totale
                                                </Text>
                                            </View>
                                        </View>

                                        {(order.order_items || []).map((item, index) => (
                                            <View
                                                key={index}
                                                className="flex-row p-3 border-b border-border"
                                            >
                                                <View className="flex-1">
                                                    <Text className="text-card-foreground font-medium">
                                                        {item.product?.name || 'Product'}
                                                    </Text>
                                                    {item.notes && (
                                                        <Text className="text-muted-foreground text-xs mt-1">
                                                            {item.notes}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View className="w-20 text-center">
                                                    <Text className="text-card-foreground">
                                                        {item.quantity}
                                                    </Text>
                                                </View>
                                                <View className="w-20 text-center">
                                                    <Text className="text-card-foreground">
                                                        €{item.unit_price?.toFixed(2) || '0.00'}
                                                    </Text>
                                                </View>
                                                <View className="w-20 text-center">
                                                    <Text className="text-card-foreground font-semibold">
                                                        €{item.total_price?.toFixed(2) || '0.00'}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Totals */}
                                    <View className="border border-border rounded-lg p-4 mb-4 bg-background">
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="text-muted-foreground">
                                                Subtotale:
                                            </Text>
                                            <Text className="text-card-foreground font-semibold">
                                                €{order.total_amount?.toFixed(2) || '0.00'}
                                            </Text>
                                        </View>
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="text-muted-foreground">
                                                IVA (22%):
                                            </Text>
                                            <Text className="text-card-foreground">
                                                €{((order.total_amount || 0) * 0.18).toFixed(2)}
                                            </Text>
                                        </View>
                                        <View className="flex-row justify-between items-center pt-2 border-t border-border">
                                            <Text className="text-card-foreground font-bold text-lg">
                                                TOTALE:
                                            </Text>
                                            <Text className="text-card-foreground font-bold text-lg">
                                                €{order.total_amount?.toFixed(2) || '0.00'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Fiscal Status */}
                                    <View
                                        className={`border rounded-lg p-4 ${
                                            order.fiscal_status === 'success'
                                                ? 'border-green-500 bg-green-50'
                                                : order.fiscal_status === 'error'
                                                    ? 'border-red-500 bg-red-50'
                                                    : 'border-yellow-500 bg-yellow-50'
                                        }`}
                                    >
                                        <View className="flex-row items-center mb-2">
                                            {order.fiscal_status === 'success' ? (
                                                <FontAwesome name="check-circle" size={20} color="#22c55e" />
                                            ) : order.fiscal_status === 'error' ? (
                                                <FontAwesome name="exclamation-circle" size={20} color="#ef4444" />
                                            ) : (
                                                <FontAwesome name="clock-o" size={20} color="#f59e0b" />
                                            )}
                                            <Text
                                                className={`ml-2 font-semibold ${
                                                    order.fiscal_status === 'success'
                                                        ? 'text-green-700'
                                                        : order.fiscal_status === 'error'
                                                            ? 'text-red-700'
                                                            : 'text-yellow-700'
                                                }`}
                                            >
                                                {order.fiscal_status === 'success'
                                                    ? 'Fiscalizzato con successo'
                                                    : order.fiscal_status === 'error'
                                                        ? 'Errore di fiscalizzazione'
                                                        : 'In attesa di fiscalizzazione'}
                                            </Text>
                                        </View>
                                        {order.fiscal_status === 'success' && order.fiscal_external_id && (
                                            <View className="mt-2">
                                                <Text className="text-muted-foreground text-sm">
                                                    Numero scontrino: {order.fiscal_external_id}
                                                </Text>
                                            </View>
                                        )}
                                        {order.fiscal_status === 'error' && (
                                            <View className="mt-2">
                                                <Text className="text-red-700 text-sm">
                                                    L'ordine è stato salvato ma la fiscalizzazione è fallita.
                                                    Contatta l'amministratore per riprovare.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            ) : null}
                        </ScrollView>

                        {/* Footer Actions */}
                        <View className="p-4 border-t border-border gap-3">
                            <View className="flex-row gap-3">
                                <Button
                                    title="Scarica PDF"
                                    variant="outline"
                                    onPress={handleDownloadPdf}
                                    disabled={!order?.pdf_url || order.fiscal_status !== 'success'}
                                    className="flex-1"
                                >
                                    <FontAwesome
                                        name="download"
                                        size={18}
                                        color={order?.pdf_url ? '#3b82f6' : '#9ca3af'}
                                        style={{ marginRight: 8 }}
                                    />
                                </Button>
                                <Button
                                    title="Condividi"
                                    variant="outline"
                                    onPress={handleShareReceipt}
                                    className="flex-1"
                                >
                                    <FontAwesome
                                        name="share-alt"
                                        size={18}
                                        color="#6b7280"
                                        style={{ marginRight: 8 }}
                                    />
                                </Button>
                            </View>
                            <Button
                                title="Chiudi"
                                variant="default"
                                onPress={onClose}
                            />
                        </View>
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}
