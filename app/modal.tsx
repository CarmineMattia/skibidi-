import { CartItem } from '@/components/features/CartItem';
import { Button } from '@/components/ui/Button';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { useAuth } from '@/lib/stores/AuthContext';
import { useCart } from '@/lib/stores/CartContext';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type OrderType = 'eat_in' | 'take_away' | 'delivery';
type CheckoutStep = 'type' | 'details' | 'payment';

export default function CheckoutScreen() {
  const { items, totalAmount, updateQuantity, removeItem, clearCart } = useCart();
  const { profile, isAuthenticated } = useAuth();
  const router = useRouter();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<CheckoutStep>('type');
  const [orderType, setOrderType] = useState<OrderType>('eat_in');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
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
    }
  }, [isAuthenticated, profile]);

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
      const result = await createOrder.mutateAsync({
        items,
        notes: `Metodo di pagamento: ${paymentMethod === 'card' ? 'Carta di Credito' : 'Contanti'}`,
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
    <View className="flex-1 flex-row">
      {/* Left Column: Order Items */}
      <View className="flex-1 p-6 border-r border-border">
        <Text className="text-xl font-bold mb-4">Riepilogo Ordine ({orderType === 'eat_in' ? 'Tavolo' : orderType === 'take_away' ? 'Asporto' : 'Delivery'})</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4">
          {items.map((item, index) => (
            <CartItem
              key={`${item.product.id}-${index}`}
              item={item}
              onUpdateQuantity={(qty) => updateQuantity(index, qty)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Right Column: Payment & Totals */}
      <View className="w-[400px] bg-secondary/10 p-8 justify-between">
        <View>
          <Text className="text-xl font-bold text-foreground mb-6">Metodo di Pagamento</Text>

          <View className="gap-4">
            <Pressable
              className={`p-6 rounded-2xl border-2 flex-row items-center gap-4 ${paymentMethod === 'card'
                ? 'bg-primary/10 border-primary'
                : 'bg-card border-border'
                }`}
              onPress={() => setPaymentMethod('card')}
            >
              <Text className="text-3xl">💳</Text>
              <View>
                <Text className="font-bold text-lg text-foreground">Carta di Credito</Text>
                <Text className="text-muted-foreground">Visa, Mastercard, Amex</Text>
              </View>
            </Pressable>

            <Pressable
              className={`p-6 rounded-2xl border-2 flex-row items-center gap-4 ${paymentMethod === 'cash'
                ? 'bg-primary/10 border-primary'
                : 'bg-card border-border'
                }`}
              onPress={() => setPaymentMethod('cash')}
            >
              <Text className="text-3xl">💶</Text>
              <View>
                <Text className="font-bold text-lg text-foreground">Contanti</Text>
                <Text className="text-muted-foreground">Paga alla cassa</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View>
          <View className="bg-card p-6 rounded-2xl border border-border mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-muted-foreground text-lg">Subtotale</Text>
              <Text className="text-foreground text-lg">€{totalAmount.toFixed(2)}</Text>
            </View>
            <View className="h-[1px] bg-border my-2" />
            <View className="flex-row justify-between items-center">
              <Text className="text-foreground font-extrabold text-2xl">Totale</Text>
              <Text className="text-primary font-extrabold text-4xl">
                €{totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <Button
              title="Indietro"
              variant="outline"
              onPress={handleBackStep}
              className="flex-1"
              size="lg"
              disabled={isProcessing}
            />
            <Button
              title={isProcessing ? 'Elaborazione...' : `Paga Ora €${totalAmount.toFixed(2)}`}
              onPress={handlePayment}
              className="flex-[2]"
              size="lg"
              disabled={isProcessing}
            />
            {isProcessing && (
              <View className="absolute right-6 top-1/2 -translate-y-1/2">
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
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
