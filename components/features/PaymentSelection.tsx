/**
 * Payment Selection Component
 * Enhanced payment method selection with mock Stripe integration
 */

import { usePayment, type PaymentProvider } from '@/lib/hooks/usePayment';
import { Pressable, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import type { CartItem } from '@/lib/stores/CartContext';

interface PaymentSelectionProps {
  amount: number;
  items: CartItem[];
  selectedProvider: PaymentProvider;
  onSelectProvider: (provider: PaymentProvider) => void;
  onPaymentComplete: (result: { success: boolean; transactionId?: string }) => void;
  disabled?: boolean;
}

export function PaymentSelection({
  amount,
  items,
  selectedProvider,
  onSelectProvider,
  onPaymentComplete,
  disabled = false,
}: PaymentSelectionProps): ReactNode {
  const payment = usePayment({
    onSuccess: (result) => {
      console.log('[PaymentSelection] Payment successful:', result);
      onPaymentComplete({ success: true, transactionId: result.transactionId });
    },
    onError: (error) => {
      console.error('[PaymentSelection] Payment failed:', error);
      onPaymentComplete({ success: false });
    },
  });

  const handlePayment = async (): Promise<void> => {
    if (selectedProvider === 'cash') {
      // For cash, just complete without processing
      onPaymentComplete({ success: true, transactionId: `cash_${Date.now()}` });
      return;
    }

    // Process card payment
    await payment.mutateAsync({
      amount,
      currency: 'eur',
      provider: selectedProvider,
      metadata: {
        itemCount: items.length.toString(),
        firstItem: items[0]?.product.name ?? 'unknown',
      },
    });
  };

  const providers: Array<{
    id: PaymentProvider;
    icon: string;
    title: string;
    subtitle: string;
  }> = [
    {
      id: 'stripe',
      icon: 'credit-card',
      title: 'Carta di Credito/Debito',
      subtitle: 'Visa, Mastercard, American Express',
    },
    {
      id: 'terminal',
      icon: 'mobile',
      title: 'POS Fisico',
      subtitle: 'Paga con il terminale in cassa',
    },
    {
      id: 'cash',
      icon: 'money',
      title: 'Contanti',
      subtitle: 'Paga alla cassa',
    },
  ];

  return (
    <View className="gap-4">
      <Text className="text-xl font-bold text-foreground mb-2">
        Metodo di Pagamento
      </Text>

      <View className="gap-3">
        {providers.map((provider) => (
          <Pressable
            key={provider.id}
            className={`p-5 rounded-2xl border-2 flex-row items-center gap-4 transition-all ${
              selectedProvider === provider.id
                ? 'bg-primary/10 border-primary'
                : 'bg-card border-border'
            } ${disabled ? 'opacity-50' : ''}`}
            onPress={() => !disabled && onSelectProvider(provider.id)}
            disabled={disabled}
          >
            <View
              className={`w-12 h-12 rounded-full items-center justify-center ${
                selectedProvider === provider.id
                  ? 'bg-primary'
                  : 'bg-secondary'
              }`}
            >
              <FontAwesome
                name={provider.icon as any}
                size={24}
                color={selectedProvider === provider.id ? '#FFFFFF' : '#000000'}
              />
            </View>

            <View className="flex-1">
              <Text
                className={`font-bold text-lg ${
                  selectedProvider === provider.id
                    ? 'text-primary'
                    : 'text-foreground'
                }`}
              >
                {provider.title}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {provider.subtitle}
              </Text>
            </View>

            {selectedProvider === provider.id && (
              <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                <View className="w-2 h-2 rounded-full bg-white" />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Security note for card payments */}
      {selectedProvider === 'stripe' && (
        <View className="bg-secondary/20 rounded-xl p-4 flex-row items-center gap-3">
          <FontAwesome name="lock" size={16} color="#10B981" />
          <Text className="text-muted-foreground text-sm flex-1">
            Pagamento sicuro crittografato con Stripe
          </Text>
        </View>
      )}

      {/* Process button */}
      <Pressable
        className={`bg-primary rounded-xl p-4 items-center shadow-lg active:scale-95 transition-transform mt-4 ${
          payment.isPending ? 'opacity-50' : ''
        }`}
        onPress={handlePayment}
        disabled={payment.isPending || disabled}
      >
        {payment.isPending ? (
          <View className="flex-row items-center gap-3">
            <View className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <Text className="text-primary-foreground font-bold text-lg">
              Elaborazione...
            </Text>
          </View>
        ) : (
          <Text className="text-primary-foreground font-bold text-lg">
            Paga €{(amount / 100).toFixed(2)}
          </Text>
        )}
      </Pressable>

      {/* Error display */}
      {payment.isError && (
        <View className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <Text className="text-destructive font-medium">
            Errore nel pagamento. Riprova.
          </Text>
        </View>
      )}
    </View>
  );
}

// Import ReactNode for TypeScript
import type { ReactNode } from 'react';