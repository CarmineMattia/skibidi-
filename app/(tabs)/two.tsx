import { useAuth } from '@/lib/stores/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MockOrder {
  id: string;
  date: string;
  status: 'Completato' | 'In Preparazione' | 'Pronto';
  total: number;
  items: string[];
}

const mockOrders: MockOrder[] = [
  {
    id: 'AMB-9821',
    date: '27 Mar 2026 • 12:18',
    status: 'In Preparazione',
    total: 42,
    items: ['The Heirloom Classic', 'Truffle Umami'],
  },
  {
    id: 'AMB-9714',
    date: '24 Mar 2026 • 20:40',
    status: 'Completato',
    total: 26,
    items: ['Margherita Superior', 'Acqua frizzante'],
  },
  {
    id: 'AMB-9668',
    date: '22 Mar 2026 • 13:05',
    status: 'Completato',
    total: 31,
    items: ['Diavola', 'Burrata & Heirloom'],
  },
];

export default function OrdersPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, profile } = useAuth();

  const handleReorder = (order: MockOrder) => {
    Alert.alert('Riordina', `Vuoi riordinare ${order.id}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Riordina', onPress: () => router.push('/(tabs)/menu') },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          className="flex-1 bg-[#fdf9f3]"
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        >
          <View className="px-4 gap-4">
            <View className="bg-white rounded-2xl border border-orange-100 p-5 gap-3">
              <Text className="text-2xl font-black text-gray-900">Recent Orders</Text>
              <Text className="text-sm text-gray-600">
                Accedi per vedere i tuoi ordini, tracciare la consegna e riordinare in un tap.
              </Text>
              <Pressable
                onPress={() => router.push('/login')}
                className="h-12 rounded-xl bg-[#d4451a] items-center justify-center active:opacity-90"
              >
                <Text className="text-white font-bold">Accedi</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-[#fdf9f3]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
      >
        <View className="px-4 gap-4">
          <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-orange-700">
              Bentornato
            </Text>
            <Text className="text-2xl font-black text-gray-900">
              {profile?.full_name || 'Cliente Ambrosia'}
            </Text>
            <Text className="text-gray-600 text-sm">I tuoi ultimi ordini artigianali.</Text>
          </View>

          <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-extrabold text-gray-900">Ordini recenti</Text>
              <Pressable onPress={() => router.push('/order-tracking')}>
                <Text className="text-orange-700 text-xs font-bold">Tracking live →</Text>
              </Pressable>
            </View>

            {mockOrders.map((order) => (
              <View key={order.id} className="rounded-xl bg-[#fffaf5] border border-orange-100 p-3 gap-2">
                <View className="flex-row items-start justify-between">
                  <View>
                    <Text className="font-bold text-gray-900">{order.id}</Text>
                    <Text className="text-xs text-gray-500">{order.date}</Text>
                  </View>
                  <View
                    className={`px-2 py-1 rounded-full ${
                      order.status === 'In Preparazione' ? 'bg-amber-100' : 'bg-emerald-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        order.status === 'In Preparazione' ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {order.status}
                    </Text>
                  </View>
                </View>

                <Text className="text-xs text-gray-600">{order.items.join(' • ')}</Text>

                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-extrabold text-[#d4451a]">€{order.total.toFixed(2)}</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleReorder(order)}
                      className="h-9 px-3 rounded-lg bg-orange-100 items-center justify-center active:opacity-90"
                    >
                      <Text className="text-xs font-bold text-orange-700">Riordina</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push('/order-tracking')}
                      className="h-9 px-3 rounded-lg bg-[#1f2937] items-center justify-center active:opacity-90 flex-row gap-1"
                    >
                      <FontAwesome name="map-marker" size={12} color="white" />
                      <Text className="text-xs font-bold text-white">Track</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}
