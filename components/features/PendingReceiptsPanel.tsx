/**
 * Scontrini da emettere (solo admin).
 *
 * Elenca gli ordini della pizzeria già accettati con scontrino in attesa o in
 * errore e li fa emettere dallo staff alla cassa, tramite le RPC lato server
 * (lib/fiscal/issueReceipt.ts). Il provider resta quello configurato (mock).
 */

import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/api/supabase';
import { getFiscalService } from '@/lib/fiscal/FiscalService';
import {
  BILLABLE_ORDER_STATUSES,
  ISSUABLE_FISCAL_STATUSES,
  fiscalProviderLabel,
  issueReceipt,
  type RpcClient,
} from '@/lib/fiscal/issueReceipt';
import { getOrderDisplayCode } from '@/lib/utils/orderDisplayCode';
import type { PaymentMethod } from '@/types/fiscal.types';
import { FontAwesome } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

type PendingReceiptOrder = {
  id: string;
  display_code: string | null;
  customer_name: string | null;
  created_at: string;
  status: string;
  fiscal_status: string | null;
  total_amount: number;
};

interface PendingReceiptsPanelProps {
  visible: boolean;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Accettato',
  preparing: 'In preparazione',
  ready: 'Pronto',
  delivered: 'Consegnato',
};

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Contanti' },
  { value: 'card', label: 'Carta' },
];

const rpcClient = supabase as unknown as RpcClient;

export function PendingReceiptsPanel({ visible, onClose }: PendingReceiptsPanelProps) {
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [issuingOrderId, setIssuingOrderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ orderId: string; ok: boolean; text: string } | null>(null);

  const { data: orders, error, isLoading, refetch } = useQuery({
    queryKey: ['pending-receipts'],
    queryFn: async (): Promise<PendingReceiptOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, display_code, customer_name, created_at, status, fiscal_status, total_amount')
        .in('fiscal_status', [...ISSUABLE_FISCAL_STATUSES])
        .in('status', [...BILLABLE_ORDER_STATUSES])
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as PendingReceiptOrder[];
    },
    enabled: visible,
  });

  // Synchronous lock: the button is disabled only after the re-render, so fast
  // repeated clicks would otherwise send several claims for the same order.
  const issuingRef = useRef(false);

  const issueMutation = useMutation({
    mutationFn: async (orderId: string) => {
      setIssuingOrderId(orderId);
      setFeedback(null);
      const service = getFiscalService();
      return issueReceipt(orderId, {
        rpc: rpcClient,
        emitter: service,
        paymentMethod,
        provider: fiscalProviderLabel(service.getConfig()),
      });
    },
    onSuccess: (result, orderId) => {
      if (result.outcome === 'failed') {
        setFeedback({ orderId, ok: false, text: result.error });
      } else {
        setFeedback({
          orderId,
          ok: true,
          text: result.outcome === 'issued' ? 'Scontrino emesso.' : 'Scontrino già emesso.',
        });
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err, orderId) => {
      setFeedback({ orderId, ok: false, text: err instanceof Error ? err.message : 'Errore sconosciuto' });
    },
    onSettled: () => {
      issuingRef.current = false;
      setIssuingOrderId(null);
    },
  });

  const handleIssue = (orderId: string) => {
    if (issuingRef.current) return;
    issuingRef.current = true;
    issueMutation.mutate(orderId);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Chiudi" />
        <View className="bg-card w-full max-h-[80%] rounded-t-3xl border-t border-border shadow-2xl">
          <View className="flex-row justify-between items-center p-4 border-b border-border">
            <Text className="text-xl font-bold text-card-foreground">Scontrini da emettere</Text>
            <Pressable onPress={onClose} accessibilityLabel="Chiudi">
              <FontAwesome name="times" size={20} color="#6b7280" />
            </Pressable>
          </View>

          <View className="flex-row items-center gap-2 px-4 pt-3">
            <Text className="text-muted-foreground text-sm">Pagamento:</Text>
            {PAYMENT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: paymentMethod === option.value }}
                onPress={() => setPaymentMethod(option.value)}
                className={`rounded-full px-3 py-1.5 border ${
                  paymentMethod === option.value ? 'bg-[#8d171e] border-[#8d171e]' : 'border-border'
                }`}
              >
                <Text className={paymentMethod === option.value ? 'text-white font-semibold' : 'text-card-foreground'}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView className="flex-1 p-4">
            {error ? (
              <View className="items-center justify-center py-8">
                <FontAwesome name="exclamation-circle" size={48} color="#ef4444" />
                <Text className="text-card-foreground mt-4">Errore nel caricamento degli ordini</Text>
                <View className="mt-4">
                  <Button title="Riprova" size="sm" variant="outline" onPress={() => refetch()} />
                </View>
              </View>
            ) : isLoading ? (
              <Text className="text-muted-foreground text-center py-8">Caricamento…</Text>
            ) : !orders || orders.length === 0 ? (
              <View className="items-center justify-center py-8">
                <FontAwesome name="check-circle" size={48} color="#22c55e" />
                <Text className="text-card-foreground mt-4">Nessuno scontrino da emettere</Text>
              </View>
            ) : (
              <View className="gap-3">
                {orders.map((order) => {
                  const isError = order.fiscal_status === 'error';
                  const busy = issuingOrderId === order.id;
                  return (
                    <View key={order.id} className="bg-background border border-border rounded-lg p-4">
                      <View className="flex-row justify-between items-start gap-3">
                        <View className="flex-1">
                          <Text className="text-card-foreground font-semibold">
                            {getOrderDisplayCode(order)}
                            {order.customer_name ? ` · ${order.customer_name}` : ''}
                          </Text>
                          <Text className="text-muted-foreground text-sm mt-1">
                            {new Date(order.created_at).toLocaleString('it-IT')} · {STATUS_LABEL[order.status] ?? order.status}
                          </Text>
                          <Text className="text-card-foreground text-sm mt-1">€{Number(order.total_amount).toFixed(2)}</Text>
                          <Text className={`text-xs mt-1 ${isError ? 'text-red-600' : 'text-yellow-700'}`}>
                            {isError ? 'Ultimo tentativo fallito' : 'Scontrino in attesa'}
                          </Text>
                        </View>
                        <Button
                          title={busy ? 'Emissione…' : isError ? 'Riprova' : 'Emetti scontrino'}
                          size="sm"
                          variant="brand"
                          disabled={issueMutation.isPending}
                          onPress={() => handleIssue(order.id)}
                        />
                      </View>
                      {feedback?.orderId === order.id ? (
                        <Text className={`text-sm mt-2 ${feedback.ok ? 'text-green-700' : 'text-red-600'}`}>{feedback.text}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
            {feedback && !orders?.some((order) => order.id === feedback.orderId) ? (
              <Text className={`text-sm mt-3 text-center ${feedback.ok ? 'text-green-700' : 'text-red-600'}`}>{feedback.text}</Text>
            ) : null}
          </ScrollView>

          <View className="p-4 border-t border-border">
            <Button title="Chiudi" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
