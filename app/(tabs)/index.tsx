/**
 * Customer-First Dashboard - Home Screen
 * Main landing page optimized for customers
 */

import { Button } from '@/components/ui/Button';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/lib/stores/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, profile, userRole, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Combo Menus
  const comboMenus = [
    {
      id: 1,
      name: 'Menu Solo',
      description: '1 Pizza + 1 Bibita',
      price: 12.00,
      oldPrice: 14.00,
      discount: '−14%',
      image: '🍕',
    },
    {
      id: 2,
      name: 'Menu Coppia',
      description: '2 Pizze + 2 Bibite',
      price: 22.00,
      oldPrice: 28.00,
      discount: '−21%',
      image: '🍕🍕',
    },
    {
      id: 3,
      name: 'Menu Famiglia',
      description: '4 Pizze + 4 Bibite + 1 Dolce',
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

  // Mock Recent Orders
  const recentOrders = [
    { id: 'ORD-12345', date: '12/03', total: 15.50, status: 'Completato' },
    { id: 'ORD-12340', date: '10/03', total: 8.00, status: 'Completato' },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Errore logout:', error);
    }
  };

  const handleReorder = (orderId: string) => {
    Alert.alert(
      '🛒 Riordina',
      'Vuoi ordinare di nuovo questo ordine?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Sì, Riordina',
          onPress: () => {
            Alert.alert('✅ Aggiunto!', 'Articoli aggiunti al carrello');
            router.push('/(tabs)/menu');
          },
        },
      ]
    );
  };

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('⚠️ Email mancante', 'Inserisci la tua email.');
      return;
    }
    setIsSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSending(false);
    Alert.alert('✅ Email Inviata!', 'Controlla la tua casella di posta.');
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => {}} />
      }
    >
      {/* Header with Logo */}
      <View className="bg-white p-6 pb-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <Text className="text-4xl">🍽️</Text>
            <View>
              <Text className="text-3xl font-extrabold text-gray-900">
                SKIBIDI ORDERS
              </Text>
              <Text className="text-base text-orange-600 font-bold">
                Sistema POS
              </Text>
            </View>
          </View>
          {isAuthenticated && (
            <Pressable onPress={handleSignOut} className="p-2">
              <Text className="text-orange-600 font-bold text-sm">Logout</Text>
            </Pressable>
          )}
        </View>

        {/* Welcome Message */}
        <View className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
          <View className="flex-row items-center gap-3 mb-2">
            <Text className="text-3xl">👋</Text>
            <View>
              <Text className="text-lg font-bold text-gray-900">
                {isAuthenticated ? `Ciao, ${profile?.full_name || 'Utente'}!` : 'Benvenuto!'}
              </Text>
              <Text className="text-sm text-gray-600">
                {isAuthenticated ? 'Felice di rivederti' : 'Accedi o ordina come ospite'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="p-6 gap-6">
        {/* 🔥 Menu Combo */}
        <View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-2xl font-extrabold text-gray-900">🔥 Menu Combo</Text>
            <Pressable onPress={() => router.push('/(tabs)/menu?filter=combos')}>
              <Text className="text-orange-600 text-sm font-bold">Vedi tutti →</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-4">
            {comboMenus.map((combo) => (
              <Pressable
                key={combo.id}
                className="bg-white rounded-2xl border-2 border-orange-200 p-4 w-[180px] active:scale-98 shadow-sm"
                onPress={() => Alert.alert('✅ Aggiunto!', `${combo.name} aggiunto al carrello`)}
              >
                <View className="items-center mb-3">
                  <Text className="text-4xl mb-2">{combo.image}</Text>
                  <View className="bg-red-500 rounded-full px-3 py-1 mb-2">
                    <Text className="text-white text-xs font-bold">{combo.discount}</Text>
                  </View>
                </View>
                <Text className="font-bold text-center mb-1 text-gray-900">{combo.name}</Text>
                <Text className="text-gray-600 text-xs text-center mb-2">{combo.description}</Text>
                <View className="flex-row justify-center items-center gap-2">
                  <Text className="text-gray-400 text-xs line-through">€{combo.oldPrice.toFixed(2)}</Text>
                  <Text className="text-lg font-bold text-orange-600">€{combo.price.toFixed(2)}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 📦 Ordini Recenti */}
        {isAuthenticated && (
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-2xl font-extrabold text-gray-900">📦 Ordini Recenti</Text>
              <Pressable onPress={() => router.push('/(tabs)/two')}>
                <Text className="text-orange-600 text-sm font-bold">Vedi tutti →</Text>
              </Pressable>
            </View>

            <View className="gap-3">
              {recentOrders.map((order) => (
                <Pressable
                  key={order.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 shadow-sm"
                  onPress={() => router.push('/(tabs)/two')}
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <View>
                      <Text className="font-bold text-gray-900">{order.id}</Text>
                      <Text className="text-gray-500 text-xs">{order.date}</Text>
                    </View>
                    <View className="items-end">
                      <View className="bg-green-100 border border-green-300 rounded-full px-3 py-1">
                        <Text className="text-green-800 text-xs font-bold">{order.status}</Text>
                      </View>
                      <Text className="text-orange-600 font-bold mt-1">€{order.total.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2 pt-2 border-t border-gray-200">
                    <Pressable
                      className="flex-1 bg-orange-100 rounded-lg py-2 flex-row items-center justify-center gap-2"
                      onPress={() => handleReorder(order.id)}
                    >
                      <FontAwesome name="repeat" size={14} color="#f97316" />
                      <Text className="text-orange-600 text-xs font-bold">Riordina</Text>
                    </Pressable>
                    <Pressable
                      className="flex-1 bg-gray-100 rounded-lg py-2 flex-row items-center justify-center gap-2"
                      onPress={() => router.push('/(tabs)/two')}
                    >
                      <FontAwesome name="file-text-o" size={14} color="#6b7280" />
                      <Text className="text-gray-600 text-xs font-medium">Dettagli</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 📋 Categorie Rapide */}
        <View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-2xl font-extrabold text-gray-900">📋 Categorie</Text>
            <Pressable onPress={() => router.push('/(tabs)/menu')}>
              <Text className="text-orange-600 text-sm font-bold">Vedi menu →</Text>
            </Pressable>
          </View>

          <View className="flex-row flex-wrap gap-3">
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                className={`${cat.color} rounded-2xl p-4 w-[90px] items-center active:scale-95 shadow-sm`}
                onPress={() => router.push(`/(tabs)/menu?category=${cat.id}`)}
              >
                <Text className="text-4xl mb-2">{cat.icon}</Text>
                <Text className="text-xs font-bold text-center text-gray-900">{cat.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 📧 Magic Link per Guest */}
        {!isAuthenticated && (
          <View className="bg-purple-50 rounded-2xl border-2 border-purple-200 p-6 gap-4">
            <View className="items-center">
              <Text className="text-3xl mb-2">📧</Text>
              <Text className="text-xl font-extrabold text-gray-900 text-center">
                Vedi i Tuoi Ordini
              </Text>
              <Text className="text-gray-600 text-sm text-center mt-1">
                Inserisci la tua email per ricevere un link magico
              </Text>
            </View>

            <TextInput
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="tua@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Button
              title={isSending ? 'Invio...' : 'Invia Link Magico'}
              onPress={handleSendMagicLink}
              disabled={isSending}
              size="lg"
            />

            <Text className="text-gray-500 text-xs text-center">
              🔒 Il link scade dopo 24 ore. Nessun account necessario.
            </Text>
          </View>
        )}

        {/* ⚡ Azioni Rapide */}
        <View className="bg-white rounded-2xl border-2 border-gray-200 p-6 gap-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-2xl">⚡</Text>
            <Text className="text-xl font-extrabold text-gray-900">Azioni Rapide</Text>
          </View>

          <Button
            title="🛒 Vai al Menu POS"
            variant="default"
            onPress={() => router.push('/(tabs)/menu')}
            size="lg"
          />

          {userRole === 'admin' && (
            <>
              <Button
                title="👨‍🍳 Cucina (Kitchen)"
                variant="secondary"
                onPress={() => router.push('/(tabs)/kitchen')}
                size="lg"
              />
              <Button
                title="📋 Lista Ordini Completa"
                variant="outline"
                onPress={() => router.push('/(tabs)/two')}
                size="lg"
              />
            </>
          )}
        </View>

        {/* Footer */}
        <View className="items-center py-6 border-t border-gray-200">
          <Text className="text-gray-500 text-sm">SKIBIDI ORDERS v1.0</Text>
          <Text className="text-gray-400 text-xs mt-1">Powered by Expo + Supabase</Text>
        </View>
      </View>
    </ScrollView>
  );
}
