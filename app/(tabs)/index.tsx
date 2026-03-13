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
      {/* Compact Header */}
      <View className="bg-white p-4 pb-3 border-b border-gray-200">
        <View className="flex-row items-center gap-2">
          <Text className="text-3xl">🍽️</Text>
          <View>
            <Text className="text-2xl font-extrabold text-gray-900">
              SKIBIDI ORDERS
            </Text>
            <Text className="text-sm text-orange-600 font-bold">
              Sistema POS
            </Text>
          </View>
        </View>
      </View>

      <View className="p-4 gap-5">
        {/* 🔥 Menu Combo */}
        <View>
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-lg font-extrabold text-gray-900">🔥 Menu Combo</Text>
            <Pressable onPress={() => router.push('/(tabs)/menu?filter=combos')}>
              <Text className="text-orange-600 text-xs font-bold">Vedi →</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
            {comboMenus.map((combo) => (
              <Pressable
                key={combo.id}
                className="bg-white rounded-xl border border-orange-200 p-3 w-[150px] active:scale-98 shadow-sm"
                onPress={() => Alert.alert('✅ Aggiunto!', `${combo.name} aggiunto`)}
              >
                <View className="items-center mb-2">
                  <Text className="text-3xl mb-1">{combo.image}</Text>
                  <View className="bg-red-500 rounded-full px-2 py-0.5 mb-1">
                    <Text className="text-white text-[10px] font-bold">{combo.discount}</Text>
                  </View>
                </View>
                <Text className="font-bold text-center mb-1 text-gray-900 text-sm">{combo.name}</Text>
                <Text className="text-orange-600 font-extrabold text-center">€{combo.price.toFixed(2)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 📦 Ordini Recenti */}
        {isAuthenticated && (
          <View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-lg font-extrabold text-gray-900">📦 Ordini Recenti</Text>
              <Pressable onPress={() => router.push('/(tabs)/two')}>
                <Text className="text-orange-600 text-xs font-bold">Vedi →</Text>
              </Pressable>
            </View>

            <View className="gap-2">
              {recentOrders.map((order) => (
                <Pressable
                  key={order.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 active:bg-gray-50"
                  onPress={() => router.push('/(tabs)/two')}
                >
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="font-bold text-gray-900 text-sm">{order.id}</Text>
                      <Text className="text-gray-500 text-[10px]">{order.date}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-green-600 text-[10px] font-bold bg-green-100 px-2 py-0.5 rounded-full">{order.status}</Text>
                      <Text className="text-orange-600 font-bold text-sm">€{order.total.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2 mt-2 pt-2 border-t border-gray-200">
                    <Pressable
                      className="flex-1 bg-orange-100 rounded py-1.5 flex-row items-center justify-center gap-1"
                      onPress={() => handleReorder(order.id)}
                    >
                      <FontAwesome name="repeat" size={12} color="#f97316" />
                      <Text className="text-orange-600 text-[10px] font-bold">Riordina</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 📋 Categorie */}
        <View>
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-lg font-extrabold text-gray-900">📋 Categorie</Text>
            <Pressable onPress={() => router.push('/(tabs)/menu')}>
              <Text className="text-orange-600 text-xs font-bold">Vedi →</Text>
            </Pressable>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                className={`${cat.color} rounded-xl p-3 w-[70px] items-center active:scale-95`}
                onPress={() => router.push(`/(tabs)/menu?category=${cat.id}`)}
              >
                <Text className="text-3xl mb-1">{cat.icon}</Text>
                <Text className="text-[10px] font-bold text-center text-gray-900">{cat.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 📧 Magic Link per Guest */}
        {!isAuthenticated && (
          <View className="bg-purple-50 rounded-xl border border-purple-200 p-4 gap-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl">📧</Text>
              <Text className="font-extrabold text-gray-900">Vedi i Tuoi Ordini</Text>
            </View>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="tua@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Button
              title={isSending ? 'Invio...' : 'Invia Link'}
              onPress={handleSendMagicLink}
              disabled={isSending}
              size="default"
            />
          </View>
        )}

        {/* ⚡ Azioni Rapide */}
        <View className="bg-white rounded-xl border border-gray-200 p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl">⚡</Text>
            <Text className="font-extrabold text-gray-900">Azioni Rapide</Text>
          </View>

          <Button
            title="🛒 Vai al Menu"
            variant="default"
            onPress={() => router.push('/(tabs)/menu')}
            size="default"
          />

          {userRole === 'admin' && (
            <Button
              title="👨‍🍳 Cucina"
              variant="outline"
              onPress={() => router.push('/(tabs)/kitchen')}
              size="default"
            />
          )}
        </View>

        {/* Footer */}
        <View className="items-center py-4 border-t border-gray-200">
          <Text className="text-gray-400 text-[10px]">SKIBIDI ORDERS v1.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}
