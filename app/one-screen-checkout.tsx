/**
 * One-Screen Checkout
 * Consolidates the entire checkout (order type, customer details, payment)
 * into a single screen so an order can be placed with the minimum number of
 * clicks. It reuses the same order-creation pipeline as the multi-step modal
 * checkout (useCreateOrder + paymentProviderToMethod).
 */

import { Button } from '@/components/ui/Button';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import {
  finalizeDeliveryAddress,
  getDeliveryZoneMessage,
  isAddressInDeliveryZone,
  looksLikeOutOfDeliveryZone,
} from '@/lib/utils/deliveryZone';
import {
  paymentProviderToMethod,
  type PaymentProvider,
} from '@/lib/hooks/usePayment';
import { getCartItemUnitPrice, useCart } from '@/lib/stores/CartContext';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type OrderType = 'eat_in' | 'take_away' | 'delivery';

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'eat_in', label: 'Da mangiare al locale' },
  { value: 'take_away', label: 'Asporto' },
  { value: 'delivery', label: 'Consegna a domicilio' },
];

const PAYMENT_OPTIONS: { value: PaymentProvider; label: string }[] = [
  { value: 'cash', label: 'Contanti' },
  { value: 'terminal', label: 'Terminale POS' },
  { value: 'stripe', label: 'Carta' },
  { value: 'satispay', label: 'Satispay' },
];

export default function OneScreenCheckout() {
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCart();
  const createOrder = useCreateOrder();

  const [orderType, setOrderType] = useState<OrderType>('take_away');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentProvider>('cash');
  const [isProcessing, setIsProcessing] = useState(false);

  const canSubmit = items.length > 0 && !isProcessing;

  const handleSubmit = useCallback(async () => {
    if (items.length === 0) {
      Alert.alert('Carrello vuoto', 'Aggiungi dei prodotti prima di procedere.');
      return;
    }
    if (!customerName.trim() || customerPhone.trim().length < 8) {
      Alert.alert(
        'Dati mancanti',
        'Inserisci il nome e un numero di telefono valido.'
      );
      return;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      Alert.alert('Indirizzo mancante', 'Inserisci l\u2019indirizzo di consegna.');
      return;
    }
    const resolvedDeliveryAddress = finalizeDeliveryAddress(deliveryAddress);
    if (orderType === 'delivery' && !isAddressInDeliveryZone(resolvedDeliveryAddress)) {
      Alert.alert('Zona non coperta', getDeliveryZoneMessage('it'));
      return;
    }

    setIsProcessing(true);
    try {
      const result = await createOrder.mutateAsync({
        items,
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress:
          orderType === 'delivery' ? resolvedDeliveryAddress.trim() : undefined,
        fulfillmentMode: 'asap',
        paymentMethod: paymentProviderToMethod(selectedPayment),
      });

      clearCart();
      router.replace(
        `/order-tracking?orderType=${encodeURIComponent(
          orderType
        )}&orderId=${encodeURIComponent(result.orderId)}`
      );
    } catch (error) {
      console.error('Order creation failed:', error);
      Alert.alert('Errore', 'Impossibile creare l\u2019ordine. Riprova.');
    } finally {
      setIsProcessing(false);
    }
  }, [
    items,
    orderType,
    customerName,
    customerPhone,
    deliveryAddress,
    selectedPayment,
    createOrder,
    clearCart,
    router,
  ]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4"
      >
        {/* Cart summary */}
        <View className="bg-card rounded-xl p-4 gap-2">
          <Text className="text-lg font-bold">Riepilogo</Text>
          {items.length === 0 ? (
            <Text className="text-muted-foreground">Carrello vuoto</Text>
          ) : (
            items.map((item, index) => (
              <View
                key={`${item.product.id}-${index}`}
                className="flex-row justify-between"
              >
                <Text className="flex-1 mr-2">
                  {item.quantity}× {item.product.name}
                </Text>
                <Text>
                  {(getCartItemUnitPrice(item) * item.quantity).toFixed(2)}€
                </Text>
              </View>
            ))
          )}
          <View className="flex-row justify-between border-t border-border pt-2 mt-2">
            <Text className="font-bold">Totale</Text>
            <Text className="font-bold">{totalAmount.toFixed(2)}€</Text>
          </View>
        </View>

        {/* Order type */}
        <View className="gap-2">
          <Text className="font-semibold">Tipo di ordine</Text>
          <View className="flex-row flex-wrap gap-2">
            {ORDER_TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setOrderType(opt.value)}
                className={`px-4 py-2 rounded-full border ${
                  orderType === opt.value
                    ? 'bg-primary border-primary'
                    : 'bg-card border-border'
                }`}
              >
                <Text
                  className={
                    orderType === opt.value
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Customer details */}
        <TextInput
          className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
          placeholder="Nome"
          placeholderTextColor="#999"
          value={customerName}
          onChangeText={setCustomerName}
        />
        <TextInput
          className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
          placeholder="Telefono"
          placeholderTextColor="#999"
          value={customerPhone}
          onChangeText={setCustomerPhone}
          keyboardType="phone-pad"
        />
        {orderType === 'delivery' && (
          <View className="gap-1">
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Indirizzo a Montecchio Emilia o Villa Aiola"
              placeholderTextColor="#999"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
            {looksLikeOutOfDeliveryZone(deliveryAddress) ? (
              <Text className="text-sm font-semibold text-red-600">{getDeliveryZoneMessage('it')}</Text>
            ) : (
              <Text className="text-xs text-muted-foreground">
                {getDeliveryZoneMessage('it')}
              </Text>
            )}
          </View>
        )}

        {/* Payment method */}
        <View className="gap-2">
          <Text className="font-semibold">Metodo di pagamento</Text>
          <View className="flex-row flex-wrap gap-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setSelectedPayment(opt.value)}
                className={`px-4 py-2 rounded-full border ${
                  selectedPayment === opt.value
                    ? 'bg-primary border-primary'
                    : 'bg-card border-border'
                }`}
              >
                <Text
                  className={
                    selectedPayment === opt.value
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Confirm bar */}
      <View className="p-4 bg-card border-t border-border">
        <Button
          title={
            isProcessing
              ? 'Elaborazione...'
              : `Paga e ordina (${totalAmount.toFixed(2)}€)`
          }
          onPress={handleSubmit}
          disabled={!canSubmit}
        />
      </View>
    </View>
  );
}
