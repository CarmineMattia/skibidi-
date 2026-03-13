/**
 * My Orders Page
 * - Logged in users: See all their orders
 * - Guest users: Enter email to receive magic link and view orders
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

  const renderLoggedInView = () => (
    <ScrollView className="flex-1 p-6">
      {/* Header */}
      <View className="items-center mb-6">
        <Text className="text-5xl mb-4">📦</Text>
        <Text className="text-2xl font-bold text-center mb-2">
          I Tuoi Ordini
        </Text>
        <Text className="text-muted-foreground text-center">
          Ciao {profile?.full_name || 'Utente'}! Ecco i tuoi ordini
        </Text>
      </View>

      {/* Orders List */}
      <View className="gap-4">
        {mockOrders.map((order) => (
          <Pressable
            key={order.id}
            className="bg-card rounded-2xl border border-border p-4 active:bg-muted/50"
            onPress={() => router.push(`/orders/${order.id}`)}
          >
            <View className="flex-row justify-between items-start mb-3">
              <View>
                <Text className="text-lg font-bold">{order.id}</Text>
                <Text className="text-muted-foreground text-sm">{order.date}</Text>
              </View>
              <View className="bg-green-100 border border-green-300 rounded-full px-3 py-1">
                <Text className="text-green-800 text-xs font-bold">
                  {order.status}
                </Text>
              </View>
            </View>

            <View className="border-t border-border pt-3 mb-3">
              {order.items.map((item, idx) => (
                <Text key={idx} className="text-sm text-foreground py-1">
                  • {item}
                </Text>
              ))}
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-muted-foreground text-sm">
                {order.items.length} prodotti
              </Text>
              <Text className="text-xl font-bold text-primary">
                €{order.total.toFixed(2)}
              </Text>
            </View>

            <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-border">
              <FontAwesome name="file-text-o" size={16} color="#6b7280" />
              <Text className="text-primary text-sm font-medium">
                Vedi Dettagli →
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Empty State (if no orders) */}
      {mockOrders.length === 0 && (
        <View className="items-center py-12">
          <Text className="text-6xl mb-4">📦</Text>
          <Text className="text-xl font-bold text-center mb-2">
            Nessun Ordine
          </Text>
          <Text className="text-muted-foreground text-center mb-6">
            Non hai ancora fatto ordini. Inizia ora!
          </Text>
          <Button
            title="Fai il Primo Ordine"
            onPress={() => router.push('/(tabs)/menu')}
            size="lg"
          />
        </View>
      )}
    </ScrollView>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Ordini' }} />
      {isAuthenticated ? renderLoggedInView() : renderGuestView()}
    </>
  );
}
