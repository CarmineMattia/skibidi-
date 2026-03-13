/**
 * My Orders Page - Customer Dashboard
 * - Logged in users: See all their orders with quick re-order
 * - Guest users: Enter email to receive magic link and view orders
 * - Combo menus for quick ordering
 * - Quick categories access
 */

import { useAuth } from '@/lib/stores/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, profile, isGuest } = useAuth();
  
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  // Mock orders for demo (replace with real API call)
  const mockOrders = [
    {
      id: 'ORD-12345',
      date: '2026-03-12',
      status: 'Completato',
      total: 15.50,
      items: ['Margherita', 'Coca Cola'],
    },
    {
      id: 'ORD-12340',
      date: '2026-03-10',
      status: 'Completato',
      total: 8.00,
      items: ['Marinara'],
    },
  ];

  // Combo Menus
  const comboMenus = [
    {
      id: 1,
      name: 'Menu Solo',
      description: '1 Pizza Margherita + 1 Bibita',
      price: 12.00,
      oldPrice: 14.00,
      discount: '−14%',
      image: '🍕',
    },
    {
      id: 2,
      name: 'Menu Coppia',
      description: '2 Pizze a scelta + 2 Bibite',
      price: 22.00,
      oldPrice: 28.00,
      discount: '−21%',
      image: '🍕🍕',
    },
    {
      id: 3,
      name: 'Menu Famiglia',
      description: '4 Pizze a scelta + 4 Bibite + 1 Dolce',
      price: 45.00,
      oldPrice: 58.00,
      discount: '−22%',
      image: '👨‍👩‍👧‍👦',
    },
  ];

  // Quick Categories
  const categories = [
    { id: 1, name: 'Pizze', icon: '🍕', color: 'bg-orange-100' },
    { id: 2, name: 'Burger', icon: '🍔', color: 'bg-red-100' },
    { id: 3, name: 'Insalate', icon: '🥗', color: 'bg-green-100' },
    { id: 4, name: 'Dolci', icon: '🍦', color: 'bg-pink-100' },
    { id: 5, name: 'Bevande', icon: '🥤', color: 'bg-blue-100' },
  ];

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('⚠️ Email mancante', 'Inserisci la tua email per ricevere il link.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('⚠️ Email non valida', 'Inserisci un indirizzo email valido.');
      return;
    }

    setIsSending(true);

    try {
      // TODO: Call Supabase to send magic link
      // await supabase.auth.signInWithOtp({ email })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsSent(true);
      Alert.alert(
        '✅ Email Inviata!',
        `Abbiamo inviato un link magico a ${email}\n\nControlla la tua casella di posta e clicca sul link per vedere i tuoi ordini.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error sending magic link:', error);
      Alert.alert('❌ Errore', 'Impossibile inviare l\'email. Riprova più tardi.');
    } finally {
      setIsSending(false);
    }
  };

  const renderGuestView = () => (
    <ScrollView className="flex-1 p-6">
      {/* Header */}
      <View className="items-center mb-8">
        <Text className="text-5xl mb-4">📦</Text>
        <Text className="text-2xl font-bold text-center mb-2">
          I Tuoi Ordini
        </Text>
        <Text className="text-muted-foreground text-center">
          Accedi o inserisci la tua email per vedere lo storico ordini
        </Text>
      </View>

      {/* Option 1: Login/Signup */}
      {!isAuthenticated && (
        <View className="gap-3 mb-6">
          <Button
            title="Accedi"
            onPress={() => router.push('/login')}
            size="lg"
            variant="default"
          />
          <Button
            title="Registrati"
            onPress={() => router.push('/login')}
            size="lg"
            variant="outline"
          />
        </View>
      )}

      {/* Divider */}
      <View className="flex-row items-center gap-3 my-6">
        <View className="flex-1 h-px bg-border" />
        <Text className="text-muted-foreground text-sm">oppure</Text>
        <View className="flex-1 h-px bg-border" />
      </View>

      {/* Option 2: Magic Link */}
      <View className="bg-card p-6 rounded-2xl border border-border gap-4">
        <View className="items-center">
          <Text className="text-3xl mb-2">📧</Text>
          <Text className="text-lg font-bold text-center">
            Vedi Ordini con Email
          </Text>
          <Text className="text-muted-foreground text-sm text-center mt-1">
            Inserisci la tua email e ricevi un link magico per vedere i tuoi ordini
          </Text>
        </View>

        {!isSent ? (
          <>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[56px]"
              placeholder="tua@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            
            <Button
              title={isSending ? 'Invio in corso...' : 'Invia Link Magico'}
              onPress={handleSendMagicLink}
              disabled={isSending}
              size="lg"
            />
            
            <Text className="text-muted-foreground text-xs text-center">
              🔒 Il link scade dopo 24 ore. Nessun account necessario.
            </Text>
          </>
        ) : (
          <View className="items-center gap-3 py-4">
            <View className="bg-green-100 border border-green-300 rounded-xl p-4 items-center">
              <Text className="text-3xl mb-2">✅</Text>
              <Text className="text-green-800 font-bold text-center">
                Email Inviata!
              </Text>
              <Text className="text-green-700 text-sm text-center mt-1">
                Controlla la tua casella di posta
              </Text>
            </View>
            
            <Button
              title="Invia un Altro Link"
              onPress={() => {
                setIsSent(false);
                setEmail('');
              }}
              variant="outline"
              size="lg"
            />
          </View>
        )}
      </View>

      {/* Info Box */}
      <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6 gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-xl">ℹ️</Text>
          <Text className="font-bold text-blue-800">Come Funziona</Text>
        </View>
        <Text className="text-blue-700 text-sm leading-relaxed">
          1. Inserisci l'email che hai usato per ordinare{'\n'}
          2. Ricevi un link magico via email{'\n'}
          3. Clicca sul link e vedi tutti i tuoi ordini{'\n'}
          4. Il link scade dopo 24 ore per sicurezza
        </Text>
      </View>
    </ScrollView>
  );

  const handleReorder = (order: any) => {
    Alert.alert(
      '🛒 Riordina',
      `Vuoi ordinare di nuovo lo stesso ordine?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Sì, Riordina', 
          onPress: () => {
            // TODO: Add items to cart and navigate to checkout
            Alert.alert('✅ Aggiunto al carrello', 'Gli articoli sono stati aggiunti. Vai al carrello per completare!');
            router.push('/(tabs)/menu');
          }
        },
      ]
    );
  };

  const renderLoggedInView = () => (
    <ScrollView className="flex-1">
      {/* Header */}
      <View className="bg-primary/10 p-6 pb-4">
        <Text className="text-2xl font-bold mb-1">
          Ciao, {profile?.full_name || 'Utente'}! 👋
        </Text>
        <Text className="text-muted-foreground">
          Ecco i tuoi ordini e le nostre offerte
        </Text>
      </View>

      <View className="p-6 gap-6">
        {/* 🔥 Menu Combo */}
        <View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xl font-bold">🔥 Menu Combo</Text>
            <Pressable onPress={() => router.push('/menu?filter=combos')}>
              <Text className="text-primary text-sm font-medium">Vedi tutti →</Text>
            </Pressable>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-4">
            {comboMenus.map((combo) => (
              <Pressable
                key={combo.id}
                className="bg-card rounded-2xl border border-border p-4 w-[200px] active:scale-98"
                onPress={() => {
                  Alert.alert('✅ Aggiunto!', `${combo.name} aggiunto al carrello`);
                }}
              >
                <View className="items-center mb-3">
                  <Text className="text-5xl mb-2">{combo.image}</Text>
                  <View className="bg-red-100 border border-red-300 rounded-full px-3 py-1 mb-2">
                    <Text className="text-red-800 text-xs font-bold">{combo.discount}</Text>
                  </View>
                </View>
                
                <Text className="font-bold text-center mb-1">{combo.name}</Text>
                <Text className="text-muted-foreground text-xs text-center mb-3">{combo.description}</Text>
                
                <View className="flex-row justify-center items-center gap-2">
                  <Text className="text-muted-foreground text-xs line-through">€{combo.oldPrice.toFixed(2)}</Text>
                  <Text className="text-lg font-bold text-primary">€{combo.price.toFixed(2)}</Text>
                </View>
                
                <View className="mt-3 pt-3 border-t border-border">
                  <Text className="text-primary text-xs font-bold text-center">⚡ Ordina Ora</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 📦 I Tuoi Ordini */}
        <View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xl font-bold">📦 I Tuoi Ordini</Text>
            <Pressable onPress={() => router.push('/(tabs)/menu')}>
              <Text className="text-primary text-sm font-medium">Nuovo Ordine →</Text>
            </Pressable>
          </View>
          
          <View className="gap-3">
            {mockOrders.map((order) => (
              <Pressable
                key={order.id}
                className="bg-card rounded-2xl border border-border p-4 active:bg-muted/50"
                onPress={() => router.push(`/orders/${order.id}`)}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View>
                    <Text className="text-base font-bold">{order.id}</Text>
                    <Text className="text-muted-foreground text-xs">{order.date}</Text>
                  </View>
                  <View className="bg-green-100 border border-green-300 rounded-full px-3 py-1">
                    <Text className="text-green-800 text-xs font-bold">
                      {order.status}
                    </Text>
                  </View>
                </View>

                <View className="border-t border-border pt-2 mb-2">
                  {order.items.map((item, idx) => (
                    <Text key={idx} className="text-sm text-foreground py-1">
                      • {item}
                    </Text>
                  ))}
                </View>

                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-muted-foreground text-xs">
                    {order.items.length} prodotti
                  </Text>
                  <Text className="text-lg font-bold text-primary">
                    €{order.total.toFixed(2)}
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <Pressable
                    className="flex-1 bg-primary/10 rounded-xl py-2 flex-row items-center justify-center gap-2"
                    onPress={() => handleReorder(order)}
                  >
                    <FontAwesome name="repeat" size={14} color="#f97316" />
                    <Text className="text-primary text-xs font-bold">Riordina</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-card border border-border rounded-xl py-2 flex-row items-center justify-center gap-2"
                    onPress={() => router.push(`/orders/${order.id}`)}
                  >
                    <FontAwesome name="file-text-o" size={14} color="#6b7280" />
                    <Text className="text-muted-foreground text-xs font-medium">Dettagli</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 📋 Categorie */}
        <View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xl font-bold">📋 Categorie</Text>
            <Pressable onPress={() => router.push('/(tabs)/menu')}>
              <Text className="text-primary text-sm font-medium">Vedi menu →</Text>
            </Pressable>
          </View>
          
          <View className="flex-row flex-wrap gap-3">
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                className={`${cat.color} rounded-2xl p-4 w-[100px] items-center active:scale-95`}
                onPress={() => router.push(`/(tabs)/menu?category=${cat.id}`)}
              >
                <Text className="text-4xl mb-2">{cat.icon}</Text>
                <Text className="text-sm font-bold text-center">{cat.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Empty State (if no orders) */}
        {mockOrders.length === 0 && (
          <View className="items-center py-8 bg-card rounded-2xl border border-border p-6">
            <Text className="text-6xl mb-4">📦</Text>
            <Text className="text-xl font-bold text-center mb-2">
              Nessun Ordine
            </Text>
            <Text className="text-muted-foreground text-center mb-4">
              Non hai ancora fatto ordini. Inizia ora!
            </Text>
            <Button
              title="Fai il Primo Ordine"
              onPress={() => router.push('/(tabs)/menu')}
              size="lg"
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Ordini' }} />
      {isAuthenticated ? renderLoggedInView() : renderGuestView()}
    </>
  );
}
