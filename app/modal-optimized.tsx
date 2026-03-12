/**
 * Checkout Modal - Mobile Optimized
 * Fixed layout for better mobile UX
 */

import { CartItem } from '@/components/features/CartItem';
import { PaymentSelection } from '@/components/features/PaymentSelection';
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

export default function CheckoutScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const { items, totalAmount, updateQuantity, removeItem, clearCart } = useCart();
  const { profile, isAuthenticated, isGuest } = useAuth();
  const { addToQueue, isOnline } = useOfflineQueue();
  const router = useRouter();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<CheckoutStep>('type');
  const [orderType, setOrderType] = useState<OrderType>('eat_in');
  const [isProcessing, setIsProcessing] = useState(false);

  // Customer Details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');

  // Pre-fill data if logged in
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
      // Validate details
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
        Alert.alert(
          'Ordine salvato',
          'Il tuo ordine è stato salvato offline.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
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

  // Step indicator dots
  const renderStepIndicator = () => {
    const steps = ['type', 'details', 'payment'];
    const currentIndex = steps.indexOf(step);
    
    return (
      <View className="flex-row items-center justify-center gap-2 mb-6">
        {steps.map((s, index) => (
          <View
            key={s}
            className={`h-3 rounded-full transition-all ${
              index <= currentIndex 
                ? 'bg-primary w-8' 
                : 'bg-muted w-3'
            }`}
          />
        ))}
      </View>
    );
  };

  // Step 1: Order Type Selection
  const renderOrderTypeSelection = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      <Text className="text-2xl font-bold text-center mb-6">
        Come vuoi ricevere?
      </Text>

      <View className="gap-4 mb-6">
        {/* Eat In */}
        <Pressable
          className={`p-6 rounded-2xl border-2 ${
            orderType === 'eat_in' 
              ? 'border-primary bg-primary/10' 
              : 'border-border'
          }`}
          onPress={() => setOrderType('eat_in')}
        >
          <View className="flex-row items-center gap-4">
            <Text className="text-4xl">🍽️</Text>
            <View className="flex-1">
              <Text className="text-lg font-bold">Mangio Qui</Text>
              <Text className="text-muted-foreground text-sm">
                Al tavolo, servizio completo
              </Text>
            </View>
            {orderType === 'eat_in' && (
              <FontAwesome name="check-circle" size={24} color="#f97316" />
            )}
          </View>
        </Pressable>

        {/* Take Away */}
        <Pressable
          className={`p-6 rounded-2xl border-2 ${
            orderType === 'take_away' 
              ? 'border-primary bg-primary/10' 
              : 'border-border'
          }`}
          onPress={() => setOrderType('take_away')}
        >
          <View className="flex-row items-center gap-4">
            <Text className="text-4xl">🛍️</Text>
            <View className="flex-1">
              <Text className="text-lg font-bold">Da Asporto</Text>
              <Text className="text-muted-foreground text-sm">
                Ritira in negozio
              </Text>
            </View>
            {orderType === 'take_away' && (
              <FontAwesome name="check-circle" size={24} color="#f97316" />
            )}
          </View>
        </Pressable>

        {/* Delivery */}
        <Pressable
          className={`p-6 rounded-2xl border-2 ${
            orderType === 'delivery' 
              ? 'border-primary bg-primary/10' 
              : 'border-border'
          }`}
          onPress={() => setOrderType('delivery')}
        >
          <View className="flex-row items-center gap-4">
            <Text className="text-4xl">🚴</Text>
            <View className="flex-1">
              <Text className="text-lg font-bold">Consegna</Text>
              <Text className="text-muted-foreground text-sm">
                A domicilio (extra €2)
              </Text>
            </View>
            {orderType === 'delivery' && (
              <FontAwesome name="check-circle" size={24} color="#f97316" />
            )}
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );

  // Step 2: Customer Details
  const renderCustomerDetails = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      <Text className="text-2xl font-bold text-center mb-6">
        I Tuoi Dati
      </Text>

      <View className="gap-4 mb-6">
        {/* Name */}
        <View>
          <Text className="text-sm font-medium mb-2">Nome</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
            placeholder="Il tuo nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Phone */}
        <View>
          <Text className="text-sm font-medium mb-2">Telefono</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
            placeholder="Il tuo numero"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Table Number (only for eat_in) */}
        {orderType === 'eat_in' && (
          <View>
            <Text className="text-sm font-medium mb-2">Numero Tavolo</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
              placeholder="Es: 5"
              value={tableNumber}
              onChangeText={setTableNumber}
              keyboardType="number-pad"
            />
          </View>
        )}

        {/* Address (only for delivery) */}
        {orderType === 'delivery' && (
          <View>
            <Text className="text-sm font-medium mb-2">Indirizzo</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
              placeholder="Via, numero civico"
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  // Step 3: Payment
  const renderPayment = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      <Text className="text-2xl font-bold text-center mb-6">
        Pagamento
      </Text>

      {/* Order Summary */}
      <View className="bg-card rounded-2xl p-4 mb-6 border border-border">
        <Text className="text-lg font-bold mb-4">Riepilogo Ordine</Text>
        {items.map((item) => (
          <CartItem
            key={item.product.id}
            item={item}
            onUpdateQuantity={(delta) => updateQuantity(item.product.id, delta)}
            onRemove={() => removeItem(item.product.id)}
          />
        ))}
        <View className="border-t border-border mt-4 pt-4 flex-row justify-between items-center">
          <Text className="text-lg font-bold">Totale</Text>
          <Text className="text-2xl font-bold text-primary">
            €{totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Payment Selection */}
      <PaymentSelection />
    </ScrollView>
  );

  // Processing
  const renderProcessing = () => (
    <View className="flex-1 items-center justify-center p-8">
      <ActivityIndicator size="large" color="#f97316" />
      <Text className="text-xl font-bold mt-6 text-center">
        Elaborazione ordine...
      </Text>
      <Text className="text-muted-foreground text-center mt-2">
        Attendere prego
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="bg-card border-b border-border px-4 py-4 flex-row items-center justify-between">
        <Pressable onPress={handleBackStep} className="p-2">
          <FontAwesome name="arrow-left" size={24} color="#000" />
        </Pressable>
        <Text className="text-lg font-bold">Checkout</Text>
        <View className="w-12" />
      </View>

      {/* Step Indicator */}
      {step !== 'processing' && renderStepIndicator()}

      {/* Content */}
      <View className="flex-1">
        {step === 'type' && renderOrderTypeSelection()}
        {step === 'details' && renderCustomerDetails()}
        {step === 'payment' && renderPayment()}
        {step === 'processing' && renderProcessing()}
      </View>

      {/* Footer Buttons */}
      {step !== 'processing' && (
        <View className="bg-card border-t border-border p-4 gap-3">
          {step === 'payment' ? (
            <Button
              title={isProcessing ? 'Elaborazione...' : `Paga €${totalAmount.toFixed(2)}`}
              onPress={handlePayment}
              disabled={isProcessing || items.length === 0}
              size="lg"
            />
          ) : (
            <Button
              title="Continua"
              onPress={handleNextStep}
              size="lg"
            />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
