import { CartItem } from '@/components/features/CartItem';
import { PaymentSelection } from '@/components/features/PaymentSelection';
import { Button } from '@/components/ui/Button';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue';
import { useAuth } from '@/lib/stores/AuthContext';
import { useCart } from '@/lib/stores/CartContext';
import type { PaymentProvider } from '@/lib/hooks/usePayment';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

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
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState<string>('');

  // Customer Details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [errors, setErrors] = useState<{name?: string; phone?: string; address?: string; tableNumber?: string}>({});

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
      // Clear previous errors
      setErrors({});
      
      const newErrors: {name?: string; phone?: string; address?: string; tableNumber?: string} = {};
      let hasError = false;

      // Validate Name
      if (orderType !== 'eat_in' && !name.trim()) {
        newErrors.name = 'Inserisci il tuo nome';
        hasError = true;
      }

      // Validate Table Number
      if (orderType === 'eat_in' && !tableNumber.trim()) {
        newErrors.tableNumber = 'Inserisci il numero del tavolo';
        hasError = true;
      }

      // Validate Phone
      if ((orderType === 'take_away' || orderType === 'delivery') && !phone.trim()) {
        newErrors.phone = 'Inserisci un numero di telefono';
        hasError = true;
      }

      // Validate Address
      if (orderType === 'delivery' && !address.trim()) {
        newErrors.address = 'Inserisci l\'indirizzo di consegna';
        hasError = true;
      }

      if (hasError) {
        setErrors(newErrors);
        Alert.alert(
          '⚠️ Campi Mancanti',
          'Per favore compila tutti i campi obbligatori evidenziati in rosso.',
          [{ text: 'OK' }]
        );
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
      // If offline, queue the order instead of trying to create it
      if (!isOnline) {
        await addToQueue({
          items,
          notes: `Metodo di pagamento: ${paymentProvider}`,
          orderType,
          customerName: name,
          customerPhone: phone,
          deliveryAddress: address,
          tableNumber: tableNumber,
          paymentMethod: paymentProvider === 'cash' ? 'cash' : 'card',
        });

        clearCart();
        Alert.alert(
          'Ordine salvato',
          'Il tuo ordine è stato salvato e verrà inviato quando la connessione sarà ripristinata.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
        return;
      }

      const result = await createOrder.mutateAsync({
        items,
        notes: `Metodo di pagamento: ${paymentProvider}`,
        orderType,
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        tableNumber: tableNumber,
      });

      console.log('✅ Order created successfully:', result.orderId);

      clearCart();
      router.replace(`/order-success?orderId=${result.orderId}`);
    } catch (error) {
      console.error('❌ Order creation failed:', error);
      Alert.alert(
        'Errore',
        'Impossibile creare l\'ordine. Riprova tra poco.',
        [{ text: 'OK' }]
      );
      setIsProcessing(false);
    }
  };

  const renderOrderTypeSelection = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-6">
      <View className="flex-1 justify-center">
        <Text className="text-2xl font-bold text-center mb-8">Come vuoi ricevere?</Text>

        <View className="gap-4 mb-6">
          {/* Mangio Qui */}
          <Pressable
            className={`p-6 rounded-2xl border-2 items-center gap-3 shadow-sm active:scale-98 transition-transform ${
              orderType === 'eat_in' ? 'border-primary bg-primary/10' : 'border-border'
            }`}
            onPress={() => setOrderType('eat_in')}
          >
            <Text className="text-5xl">🍽️</Text>
            <Text className="text-lg font-bold text-center">Mangio Qui</Text>
            <Text className="text-muted-foreground text-sm text-center">Al tavolo, servizio completo</Text>
          </Pressable>

          {/* Da Asporto */}
          <Pressable
            className={`p-6 rounded-2xl border-2 items-center gap-3 shadow-sm active:scale-98 transition-transform ${
              orderType === 'take_away' ? 'border-primary bg-primary/10' : 'border-border'
            }`}
            onPress={() => setOrderType('take_away')}
          >
            <Text className="text-5xl">🛍️</Text>
            <Text className="text-lg font-bold text-center">Da Asporto</Text>
            <Text className="text-muted-foreground text-sm text-center">Ritira in negozio</Text>
          </Pressable>

          {/* Delivery */}
          <Pressable
            className={`p-6 rounded-2xl border-2 items-center gap-3 shadow-sm active:scale-98 transition-transform ${
              orderType === 'delivery' ? 'border-primary bg-primary/10' : 'border-border'
            }`}
            onPress={() => setOrderType('delivery')}
          >
            <Text className="text-5xl">🛵</Text>
            <Text className="text-lg font-bold text-center">Delivery</Text>
            <Text className="text-muted-foreground text-sm text-center">A domicilio (+€2)</Text>
          </Pressable>
        </View>

        <Button
          title="Continua"
          onPress={handleNextStep}
          size="lg"
        />
      </View>
    </ScrollView>
  );

  const renderDetailsForm = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-6">
      <View className="flex-1 justify-center gap-4">
        <Text className="text-2xl font-bold text-center mb-2">I Tuoi Dati</Text>

        {/* Nome */}
        <View>
          <Text className="text-sm font-medium mb-2">{orderType === 'eat_in' ? 'Nome (Opzionale)' : 'Nome *'}</Text>
          <TextInput
            className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[56px] ${
              errors.name ? 'border-red-500 bg-red-50' : 'border-border'
            }`}
            placeholder="Il tuo nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          {errors.name && (
            <Text className="text-red-500 text-xs mt-1 flex-row items-center gap-1">
              <Text>⚠️</Text>
              <Text>{errors.name}</Text>
            </Text>
          )}
        </View>

        {/* Tavolo */}
        {orderType === 'eat_in' && (
          <View>
            <Text className="text-sm font-medium mb-2">Numero Tavolo *</Text>
            <TextInput
              className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[56px] ${
                errors.tableNumber ? 'border-red-500 bg-red-50' : 'border-border'
              }`}
              placeholder="Es: 5"
              keyboardType="number-pad"
              value={tableNumber}
              onChangeText={(text) => setTableNumber(text.replace(/[^0-9]/g, ''))}
              maxLength={3}
            />
            {errors.tableNumber && (
              <Text className="text-red-500 text-xs mt-1 flex-row items-center gap-1">
                <Text>⚠️</Text>
                <Text>{errors.tableNumber}</Text>
              </Text>
            )}
          </View>
        )}

        {/* Telefono */}
        {(orderType === 'take_away' || orderType === 'delivery') && (
          <View>
            <Text className="text-sm font-medium mb-2">Telefono *</Text>
            <TextInput
              className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[56px] ${
                errors.phone ? 'border-red-500 bg-red-50' : 'border-border'
              }`}
              placeholder="Il tuo numero"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {errors.phone && (
              <Text className="text-red-500 text-xs mt-1 flex-row items-center gap-1">
                <Text>⚠️</Text>
                <Text>{errors.phone}</Text>
              </Text>
            )}
          </View>
        )}

        {/* Indirizzo */}
        {orderType === 'delivery' && (
          <View>
            <Text className="text-sm font-medium mb-2">Indirizzo *</Text>
            <TextInput
              className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[80px] ${
                errors.address ? 'border-red-500 bg-red-50' : 'border-border'
              }`}
              placeholder="Via, Civico, Città"
              multiline
              value={address}
              onChangeText={setAddress}
            />
            {errors.address && (
              <Text className="text-red-500 text-xs mt-1 flex-row items-center gap-1">
                <Text>⚠️</Text>
                <Text>{errors.address}</Text>
              </Text>
            )}
          </View>
        )}

        {/* Buttons */}
        <View className="flex-row gap-3 mt-4">
          <Button
            title="Indietro"
            variant="outline"
            onPress={handleBackStep}
            className="flex-1"
            size="lg"
          />
          <Button
            title="Continua"
            onPress={handleNextStep}
            className="flex-1"
            size="lg"
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderPayment = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      {/* Order Summary - MOBILE OPTIMIZED (no sidebar) */}
      <View className="bg-card rounded-xl p-4 mb-4 border border-border">
        <Text className="text-base font-bold mb-3">
          Riepilogo ({orderType === 'eat_in' ? 'Tavolo' : orderType === 'take_away' ? 'Asporto' : 'Consegna'})
        </Text>

        {/* Offline indicator - Compact */}
        {!isOnline && (
          <View className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-3 flex-row items-center gap-2">
            <Text className="text-xl">📡</Text>
            <View>
              <Text className="font-bold text-amber-800 text-sm">Offline</Text>
              <Text className="text-amber-700 text-xs">Ordine salvato in locale</Text>
            </View>
          </View>
        )}

        {/* Items List - Compact */}
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
          <Pressable
            className={`p-4 rounded-xl border-2 flex-row items-center gap-3 ${
              paymentProvider === 'stripe' ? 'bg-primary/10 border-primary' : 'bg-card border-border'
            }`}
            onPress={() => setPaymentProvider('stripe')}
            disabled={isProcessing}
          >
            <Text className="text-3xl">💳</Text>
            <View className="flex-1">
              <Text className="font-bold text-base">Carta di Credito</Text>
              <Text className="text-muted-foreground text-xs">Visa, Mastercard, Amex</Text>
            </View>
          </Pressable>

          <Pressable
            className={`p-4 rounded-xl border-2 flex-row items-center gap-3 ${
              paymentProvider === 'terminal' ? 'bg-primary/10 border-primary' : 'bg-card border-border'
            }`}
            onPress={() => setPaymentProvider('terminal')}
            disabled={isProcessing}
          >
            <Text className="text-3xl">🏪</Text>
            <View className="flex-1">
              <Text className="font-bold text-base">POS in Cassa</Text>
              <Text className="text-muted-foreground text-xs">Terminale fisico</Text>
            </View>
          </Pressable>

          <Pressable
            className={`p-4 rounded-xl border-2 flex-row items-center gap-3 ${
              paymentProvider === 'cash' ? 'bg-primary/10 border-primary' : 'bg-card border-border'
            }`}
            onPress={() => setPaymentProvider('cash')}
            disabled={isProcessing}
          >
            <Text className="text-3xl">💶</Text>
            <View className="flex-1">
              <Text className="font-bold text-base">Contanti</Text>
              <Text className="text-muted-foreground text-xs">Paga alla cassa</Text>
            </View>
          </Pressable>
        </View>

        {/* Footer Buttons */}
        <View className="gap-3 mt-4">
          <Button
            title="Indietro"
            variant="outline"
            onPress={handleBackStep}
            disabled={isProcessing}
            size="lg"
          />
          <Button
            title={isProcessing ? 'Elaborazione...' : (isOnline ? 'Conferma Ordine' : 'Salva Ordine')}
            onPress={handlePayment}
            disabled={isProcessing}
            size="lg"
          />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Step Indicator Only (no back button - Expo Router provides it) */}
      <View className="pt-4 pb-2 border-b border-border bg-card">
        <View className="flex-row gap-2 justify-center">
          <View className={`h-2 w-16 rounded-full ${step === 'type' ? 'bg-primary' : 'bg-primary/30'}`} />
          <View className={`h-2 w-16 rounded-full ${step === 'details' ? 'bg-primary' : 'bg-primary/30'}`} />
          <View className={`h-2 w-16 rounded-full ${step === 'payment' ? 'bg-primary' : 'bg-primary/30'}`} />
        </View>
      </View>

      {step === 'type' && renderOrderTypeSelection()}
      {step === 'details' && renderDetailsForm()}
      {step === 'payment' && renderPayment()}

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}
