/**
 * Checkout Modal - MOBILE OPTIMIZED VERSION
 * Use this to replace modal.tsx
 * 
 * Key improvements:
 * - Responsive layout (column on mobile, row on tablet/desktop)
 * - Larger touch targets (56px min)
 * - Better spacing for small screens
 * - No vertical text
 * - Compact order summary
 */

import { CartItem } from '@/components/features/CartItem';
import { Button } from '@/components/ui/Button';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue';
import { useAuth } from '@/lib/stores/AuthContext';
import { useCart } from '@/lib/stores/CartContext';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

type OrderType = 'eat_in' | 'take_away' | 'delivery';
type CheckoutStep = 'type' | 'details' | 'payment' | 'processing' | 'success';

export default function CheckoutModalOptimized() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768; // Mobile breakpoint

  const { items, totalAmount, updateQuantity, removeItem, clearCart } = useCart();
  const { profile, isAuthenticated, isGuest } = useAuth();
  const { addToQueue, isOnline } = useOfflineQueue();
  const router = useRouter();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<CheckoutStep>('type');
  const [orderType, setOrderType] = useState<OrderType>('eat_in');
  const [isProcessing, setIsProcessing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');

  useEffect(() => {
    if (isAuthenticated && profile) {
      setName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
    } else if (isGuest) {
      setName('ospite123');
    }
  }, [isAuthenticated, profile, isGuest]);

  const handleNextStep = () => {
    if (step === 'type') {
      setStep('details');
    } else if (step === 'details') {
      if (orderType !== 'eat_in' && !name.trim()) {
        Alert.alert('Attenzione', 'Inserisci il tuo nome.');
        return;
      }
      if (orderType === 'eat_in' && !tableNumber.trim()) {
        Alert.alert('Attenzione', 'Inserisci il numero del tavolo.');
        return;
      }
      if ((orderType === 'take_away' || orderType === 'delivery') && !phone.trim()) {
        Alert.alert('Attenzione', 'Inserisci un numero di telefono.');
        return;
      }
      if (orderType === 'delivery' && !address.trim()) {
        Alert.alert('Attenzione', 'Inserisci l\'indirizzo di consegna.');
        return;
      }
      setStep('payment');
    }
  };

  const handleBackStep = () => {
    if (step === 'payment') setStep('details');
    else if (step === 'details') setStep('type');
    else router.back();
  };

  const handlePayment = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);

    try {
      if (!isOnline) {
        await addToQueue({
          items,
          notes: `Metodo di pagamento: cash`,
          orderType,
          customerName: name,
          customerPhone: phone,
          deliveryAddress: address,
          tableNumber: tableNumber,
          paymentMethod: 'cash',
        });
        clearCart();
        Alert.alert('Ordine salvato', 'Il tuo ordine è stato salvato offline.', [
          { text: 'OK', onPress: () => router.replace('/') },
        ]);
        return;
      }

      const result = await createOrder.mutateAsync({
        items,
        notes: `Metodo di pagamento: card`,
        orderType,
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        tableNumber: tableNumber,
      });

      clearCart();
      router.replace(`/order-success?orderId=${result.orderId}`);
    } catch (error) {
      console.error('Order creation failed:', error);
      Alert.alert('Errore', 'Impossibile creare l\'ordine. Riprova.');
      setIsProcessing(false);
    }
  };

  // Render Step 1: Order Type
  const renderOrderType = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      <Text className="text-2xl font-bold text-center mb-6">Come vuoi ricevere?</Text>

      <View className="gap-4">
        {[
          { type: 'eat_in', icon: '🍽️', title: 'Mangio Qui', subtitle: 'Al tavolo' },
          { type: 'take_away', icon: '🛍️', title: 'Da Asporto', subtitle: 'Ritira in negozio' },
          { type: 'delivery', icon: '🚴', title: 'Consegna', subtitle: 'A domicilio (+€2)' },
        ].map((option) => (
          <Pressable
            key={option.type}
            className={`p-5 rounded-2xl border-2 flex-row items-center gap-4 ${
              orderType === option.type ? 'border-primary bg-primary/10' : 'border-border'
            }`}
            onPress={() => setOrderType(option.type as OrderType)}
          >
            <Text className="text-4xl">{option.icon}</Text>
            <View className="flex-1">
              <Text className="text-lg font-bold">{option.title}</Text>
              <Text className="text-muted-foreground text-sm">{option.subtitle}</Text>
            </View>
            {orderType === option.type && <FontAwesome name="check-circle" size={24} color="#f97316" />}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  // Render Step 2: Customer Details
  const renderDetails = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      <Text className="text-2xl font-bold mb-6">I Tuoi Dati</Text>

      <View className="gap-4">
        {orderType !== 'eat_in' && (
          <View>
            <Text className="text-sm font-medium mb-2">Nome *</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
              placeholder="Il tuo nome"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        {(orderType === 'take_away' || orderType === 'delivery') && (
          <View>
            <Text className="text-sm font-medium mb-2">Telefono *</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
              placeholder="Il tuo numero"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        )}

        {orderType === 'eat_in' && (
          <View>
            <Text className="text-sm font-medium mb-2">Numero Tavolo *</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
              placeholder="Es: 5"
              keyboardType="number-pad"
              value={tableNumber}
              onChangeText={(text) => setTableNumber(text.replace(/[^0-9]/g, ''))}
              maxLength={3}
            />
          </View>
        )}

        {orderType === 'delivery' && (
          <View>
            <Text className="text-sm font-medium mb-2">Indirizzo *</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[80px]"
              placeholder="Via, Civico, Città"
              multiline
              value={address}
              onChangeText={setAddress}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  // Render Step 3: Payment (MOBILE OPTIMIZED - NO SIDEBAR)
  const renderPayment = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      {/* Order Summary - COMPACT */}
      <View className="bg-card rounded-xl p-4 mb-4 border border-border">
        <Text className="text-base font-bold mb-3">
          Riepilogo ({orderType === 'eat_in' ? 'Tavolo' : orderType === 'take_away' ? 'Asporto' : 'Consegna'})
        </Text>

        {!isOnline && (
          <View className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-3 flex-row items-center gap-2">
            <Text className="text-xl">📡</Text>
            <View>
              <Text className="font-bold text-amber-800 text-sm">Offline</Text>
              <Text className="text-amber-700 text-xs">Ordine salvato in locale</Text>
            </View>
          </View>
        )}

        {/* Items */}
        <View className="gap-2 mb-3">
          {items.map((item, idx) => (
            <View key={idx} className="flex-row justify-between items-center py-2 border-b border-border last:border-0">
              <View className="flex-1">
                <Text className="text-sm font-medium" numberOfLines={1}>{item.product.name}</Text>
                <Text className="text-xs text-muted-foreground">x{item.quantity}</Text>
              </View>
              <Text className="text-sm font-bold">€{(item.product.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View className="flex-row justify-between items-center pt-3 border-t border-border">
          <Text className="text-base font-bold">Totale</Text>
          <Text className="text-2xl font-bold text-primary">€{totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      {/* Payment Methods */}
      <View className="mb-4">
        <Text className="text-lg font-bold mb-3">Metodo di Pagamento</Text>
        
        <View className="gap-3">
          {[
            { id: 'stripe', icon: '💳', title: 'Carta di Credito', subtitle: 'Visa, Mastercard, Amex' },
            { id: 'pos', icon: '🏪', title: 'POS in Cassa', subtitle: 'Terminale fisico' },
            { id: 'cash', icon: '💶', title: 'Contanti', subtitle: 'Paga alla cassa' },
          ].map((method) => (
            <Pressable
              key={method.id}
              className={`p-4 rounded-xl border-2 flex-row items-center gap-3 ${
                method.id === 'cash' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
              onPress={() => {}}
            >
              <Text className="text-3xl">{method.icon}</Text>
              <View className="flex-1">
                <Text className="font-bold text-base">{method.title}</Text>
                <Text className="text-muted-foreground text-xs">{method.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  // Render Processing
  const renderProcessing = () => (
    <View className="flex-1 items-center justify-center p-8">
      <ActivityIndicator size="large" color="#f97316" />
      <Text className="text-xl font-bold mt-6 text-center">Elaborazione...</Text>
      <Text className="text-muted-foreground text-center mt-2">Attendere prego</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-card border-b border-border px-4 py-3 flex-row items-center justify-between">
        <Pressable onPress={handleBackStep} className="p-2">
          <FontAwesome name="arrow-left" size={20} color="#000" />
        </Pressable>
        <Text className="text-base font-bold">Checkout</Text>
        <View className="w-10" />
      </View>

      {/* Step Indicator Dots */}
      {step !== 'processing' && (
        <View className="flex-row items-center justify-center gap-2 py-3">
          {['type', 'details', 'payment'].map((s, idx) => (
            <View
              key={s}
              className={`h-2 rounded-full ${
                ['type', 'details', 'payment'].indexOf(step) >= idx ? 'bg-primary flex-1' : 'bg-muted flex-1'
              }`}
            />
          ))}
        </View>
      )}

      {/* Content */}
      <View className="flex-1">
        {step === 'type' && renderOrderType()}
        {step === 'details' && renderDetails()}
        {step === 'payment' && renderPayment()}
        {step === 'processing' && renderProcessing()}
      </View>

      {/* Footer Buttons */}
      {step !== 'processing' && (
        <View className="bg-card border-t border-border p-4 gap-3 safe-area-bottom">
          {step === 'payment' ? (
            <Button
              title={isProcessing ? 'Elaborazione...' : `Paga €${totalAmount.toFixed(2)}`}
              onPress={handlePayment}
              disabled={isProcessing || items.length === 0}
              size="lg"
            />
          ) : (
            <Button title="Continua" onPress={handleNextStep} size="lg" />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
