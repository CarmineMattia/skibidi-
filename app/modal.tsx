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
    <View className="flex-1 justify-center gap-6 p-8">
      <Text className="text-3xl font-bold text-center mb-8">Come vuoi ricevere il tuo ordine?</Text>

      <View className="flex-row gap-6 justify-center">
        <Pressable
          className={`flex-1 max-w-[250px] aspect-square bg-card rounded-3xl border-2 items-center justify-center gap-4 shadow-sm active:scale-95 transition-transform ${orderType === 'eat_in' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          onPress={() => setOrderType('eat_in')}
        >
          <Text className="text-6xl">🍽️</Text>
          <Text className="text-xl font-bold">Mangio Qui</Text>
        </Pressable>

        <Pressable
          className={`flex-1 max-w-[250px] aspect-square bg-card rounded-3xl border-2 items-center justify-center gap-4 shadow-sm active:scale-95 transition-transform ${orderType === 'take_away' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          onPress={() => setOrderType('take_away')}
        >
          <Text className="text-6xl">🛍️</Text>
          <Text className="text-xl font-bold">Da Asporto</Text>
        </Pressable>

        <Pressable
          className={`flex-1 max-w-[250px] aspect-square bg-card rounded-3xl border-2 items-center justify-center gap-4 shadow-sm active:scale-95 transition-transform ${orderType === 'delivery' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          onPress={() => setOrderType('delivery')}
        >
          <Text className="text-6xl">🛵</Text>
          <Text className="text-xl font-bold">Delivery</Text>
        </Pressable>
      </View>

      <Button
        title="Continua"
        onPress={handleNextStep}
        size="lg"
        className="mt-8 self-center w-[300px]"
      />
    </View>
  );

  const renderDetailsForm = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 p-8 justify-center max-w-2xl w-full self-center">
      <Text className="text-3xl font-bold text-center mb-8">I tuoi dati</Text>

      <View className="bg-card p-8 rounded-3xl border border-border shadow-sm gap-6">
        <View>
          <Text className="font-medium mb-2 ml-1">{orderType === 'eat_in' ? 'Nome (Opzionale)' : 'Nome *'}</Text>
          <TextInput
            className="bg-background border border-border rounded-xl p-4 text-lg"
            placeholder="Il tuo nome"
            value={name}
            onChangeText={setName}
          />
        </View>

        {orderType === 'eat_in' && (
          <View>
            <Text className="font-medium mb-2 ml-1">Numero Tavolo *</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-4 text-lg"
              placeholder="Es. 12"
              keyboardType="number-pad"
              value={tableNumber}
              onChangeText={(text) => setTableNumber(text.replace(/[^0-9]/g, ''))}
              maxLength={3}
            />
          </View>
        )}

        {(orderType === 'take_away' || orderType === 'delivery') && (
          <View>
            <Text className="font-medium mb-2 ml-1">Telefono *</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-4 text-lg"
              placeholder="Il tuo numero"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        )}

        {orderType === 'delivery' && (
          <View>
            <Text className="font-medium mb-2 ml-1">Indirizzo di Consegna *</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-4 text-lg min-h-[100px]"
              placeholder="Via, Civico, Città..."
              multiline
              textAlignVertical="top"
              value={address}
              onChangeText={setAddress}
            />
          </View>
        )}
      </View>

      <View className="flex-row gap-4 mt-8">
        <Button
          title="Indietro"
          variant="outline"
          onPress={handleBackStep}
          className="flex-1"
        />
        <Button
          title="Vai al Pagamento"
          onPress={handleNextStep}
          className="flex-1"
        />
      </View>
    </KeyboardAvoidingView>
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
      {/* Header with Steps */}
      <View className="p-6 border-b border-border bg-card flex-row items-center justify-between">
        <Pressable onPress={handleBackStep} className="p-2">
          <FontAwesome name="arrow-left" size={24} color="#000" />
        </Pressable>
        <View className="flex-row gap-2">
          <View className={`h-2 w-12 rounded-full ${step === 'type' ? 'bg-primary' : 'bg-primary/30'}`} />
          <View className={`h-2 w-12 rounded-full ${step === 'details' ? 'bg-primary' : 'bg-primary/30'}`} />
          <View className={`h-2 w-12 rounded-full ${step === 'payment' ? 'bg-primary' : 'bg-primary/30'}`} />
        </View>
        <View className="w-8" />
      </View>

      {step === 'type' && renderOrderTypeSelection()}
      {step === 'details' && renderDetailsForm()}
      {step === 'payment' && renderPayment()}

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}
