/**
 * Customer Dashboard - Home Screen
 * Main dashboard with combos, recent orders, and quick categories
 */

import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useAuth } from '@/lib/stores/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

export default function HomeScreen() {
  const { userRole, isKioskMode, isAuthenticated, profile, user, signOut } = useAuth();
  const router = useRouter();
  const { data: stats, isLoading, refetch } = useDashboardStats();
  
  const [email, setEmail] = useState('');
  const [isSendingLink, setIsSendingLink] = useState(false);

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
      console.error('Errore durante il logout:', error);
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
            Alert.alert('✅ Aggiunto!', 'Gli articoli sono stati aggiunti al carrello');
            router.push('/(tabs)/menu');
          }
        },
      ]
    );
  };

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('⚠️ Email mancante', 'Inserisci la tua email.');
      return;
    }
    setIsSendingLink(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSendingLink(false);
    Alert.alert('✅ Email Inviata!', 'Controlla la tua casella di posta.');
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View className="p-6">
        {/* Header */}
        <View className="mb-8 bg-card p-6 rounded-3xl shadow-lg border-2 border-primary/20">
          <View className="flex-row items-center justify-between">
            <View>
              <View className="flex-row items-center gap-3 mb-2">
                <Text className="text-5xl">🍽️</Text>
                <View>
                  <Text className="text-4xl font-extrabold text-foreground tracking-tight">
                    SKIBIDI ORDERS
                  </Text>
                  <Text className="text-xl text-primary font-extrabold mt-1">
                    Sistema POS
                  </Text>
                </View>
              </View>
            </View>
            {!isKioskMode && (
              <Button
                title="Logout"
                variant="outline"
                size="sm"
                onPress={handleSignOut}
              />
            )}
          </View>
        </View>

        {/* User Info Card */}
        <Card className="mb-6 border-2 border-primary/20 shadow-xl bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold">
              {isKioskMode ? '👤 Modalità Kiosk' : `👤 ${userRole === 'admin' ? 'Amministratore' : 'Utente'}`}
            </CardTitle>
            <CardDescription className="text-lg font-semibold">
              {isKioskMode
                ? 'Accesso anonimo - limitato alle funzioni di ordinazione'
                : user?.email || 'Utente autenticato'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Admin Dashboard Stats */}
        {!isKioskMode && userRole === 'admin' && (
          <View>
            <View className="flex-row gap-4 mb-6">
              {/* Revenue Card */}
              <Card className="flex-1 border-2 border-green-500/20 shadow-xl bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-green-700">Incasso Oggi</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ActivityIndicator color="#22c55e" />
                  ) : (
                    <Text className="text-4xl font-extrabold text-green-800">
                      €{stats?.todayRevenue.toFixed(2) || '0.00'}
                    </Text>
                  )}
                </CardContent>
              </Card>

              {/* Orders Count Card */}
              <Card className="flex-1 border-2 border-blue-500/20 shadow-xl bg-blue-500/5">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-blue-700">Ordini Oggi</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ActivityIndicator color="#3b82f6" />
                  ) : (
                    <Text className="text-4xl font-extrabold text-blue-800">
                      {stats?.todayOrdersCount || 0}
                    </Text>
                  )}
                </CardContent>
              </Card>
            </View>

            {/* Recent Orders */}
            <Card className="mb-6 border border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Ultimi Ordini</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ActivityIndicator />
                ) : stats?.recentOrders.length === 0 ? (
                  <Text className="text-muted-foreground">Nessun ordine recente.</Text>
                ) : (
                  <View className="gap-3">
                    {stats?.recentOrders.map((order) => (
                      <View key={order.id} className="flex-row items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border">
                        <View>
                          <Text className="font-bold text-foreground">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="font-bold text-primary">
                            €{order.total_amount.toFixed(2)}
                          </Text>
                          <Text className={`text-xs font-semibold capitalize ${order.status === 'ready' ? 'text-green-600' :
                              order.status === 'preparing' ? 'text-blue-600' :
                                order.status === 'cancelled' ? 'text-red-600' :
                                  'text-orange-600'
                            }`}>
                            {order.status}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </CardContent>
            </Card>
          </View>
        )}

        {/* 🔥 Menu Combo (Customer Feature) */}
        {(userRole === 'customer' || !isAuthenticated) && (
          <Card className="mb-6 border-2 border-orange-500/20 shadow-xl bg-gradient-to-br from-orange-50 to-white">
            <CardHeader className="pb-3">
              <View className="flex-row justify-between items-center">
                <CardTitle className="text-2xl font-extrabold">🔥 Menu Combo</CardTitle>
                <Pressable onPress={() => router.push('/(tabs)/menu?filter=combos')}>
                  <Text className="text-primary text-sm font-bold">Vedi tutti →</Text>
                </Pressable>
              </View>
            </CardHeader>
            <CardContent>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-4">
                {comboMenus.map((combo) => (
                  <Pressable
                    key={combo.id}
                    className="bg-card rounded-2xl border-2 border-orange-200 p-4 w-[180px] active:scale-98"
                    onPress={() => Alert.alert('✅ Aggiunto!', `${combo.name} aggiunto al carrello`)}
                  >
                    <View className="items-center mb-3">
                      <Text className="text-4xl mb-2">{combo.image}</Text>
                      <View className="bg-red-500 rounded-full px-3 py-1 mb-2">
                        <Text className="text-white text-xs font-bold">{combo.discount}</Text>
                      </View>
                    </View>
                    <Text className="font-bold text-center mb-1">{combo.name}</Text>
                    <Text className="text-muted-foreground text-xs text-center mb-2">{combo.description}</Text>
                    <View className="flex-row justify-center items-center gap-2">
                      <Text className="text-muted-foreground text-xs line-through">€{combo.oldPrice.toFixed(2)}</Text>
                      <Text className="text-lg font-bold text-primary">€{combo.price.toFixed(2)}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </CardContent>
          </Card>
        )}

        {/* 📦 Ordini Recenti (Customer Feature) */}
        {(userRole === 'customer' || isAuthenticated) && (
          <Card className="mb-6 border-2 border-blue-500/20 shadow-xl">
            <CardHeader className="pb-3">
              <View className="flex-row justify-between items-center">
                <CardTitle className="text-2xl font-extrabold">📦 Ordini Recenti</CardTitle>
                <Pressable onPress={() => router.push('/(tabs)/two')}>
                  <Text className="text-primary text-sm font-bold">Vedi tutti →</Text>
                </Pressable>
              </View>
            </CardHeader>
            <CardContent>
              <View className="gap-3">
                {recentOrders.map((order) => (
                  <Pressable
                    key={order.id}
                    className="bg-card rounded-xl border border-border p-3 active:bg-muted/50"
                    onPress={() => router.push(`/(tabs)/two`)}
                  >
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="font-bold text-sm">{order.id}</Text>
                        <Text className="text-muted-foreground text-xs">{order.date}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                          {order.status}
                        </Text>
                        <Text className="text-primary font-bold mt-1">€{order.total.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View className="flex-row gap-2 mt-2 pt-2 border-t border-border">
                      <Pressable
                        className="flex-1 bg-primary/10 rounded-lg py-2 flex-row items-center justify-center gap-1"
                        onPress={() => handleReorder(order.id)}
                      >
                        <FontAwesome name="repeat" size={12} color="#f97316" />
                        <Text className="text-primary text-xs font-bold">Riordina</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* 📋 Categorie Rapide */}
        <Card className="mb-6 border-2 border-green-500/20 shadow-xl">
          <CardHeader className="pb-3">
            <View className="flex-row justify-between items-center">
              <CardTitle className="text-2xl font-extrabold">📋 Categorie</CardTitle>
              <Pressable onPress={() => router.push('/(tabs)/menu')}>
                <Text className="text-primary text-sm font-bold">Vedi menu →</Text>
              </Pressable>
            </View>
          </CardHeader>
          <CardContent>
            <View className="flex-row flex-wrap gap-3">
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  className={`${cat.color} rounded-2xl p-4 w-[90px] items-center active:scale-95`}
                  onPress={() => router.push(`/(tabs)/menu?category=${cat.id}`)}
                >
                  <Text className="text-4xl mb-2">{cat.icon}</Text>
                  <Text className="text-xs font-bold text-center">{cat.name}</Text>
                </Pressable>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* Guest: Email Magic Link */}
        {!isAuthenticated && (
          <Card className="mb-6 border-2 border-purple-500/20 shadow-xl bg-purple-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-extrabold">📧 Vedi i Tuoi Ordini</CardTitle>
              <CardDescription>Inserisci la tua email per ricevere un link magico</CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <TextInput
                className="bg-white border border-border rounded-xl px-4 py-3 text-base"
                placeholder="tua@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <Button
                title={isSendingLink ? 'Invio...' : 'Invia Link Magico'}
                onPress={handleSendMagicLink}
                disabled={isSendingLink}
                variant="default"
              />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="mb-6 border-2 border-primary/20 shadow-xl bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold">⚡ Azioni Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="gap-3">
              <Button
                title="Vai al Menu POS"
                variant="default"
                onPress={() => router.push('/(tabs)/menu')}
              />
              {!isKioskMode && userRole === 'admin' && (
                <>
                  <Button
                    title="Cucina (Kitchen Display)"
                    variant="secondary"
                    onPress={() => router.push('/(tabs)/kitchen')}
                  />
                  <Button
                    title="Lista Ordini Completa"
                    variant="outline"
                    onPress={() => router.push('/(tabs)/two')}
                  />
                </>
              )}
            </View>
          </CardContent>
        </Card>

        {/* Info */}
        <View className="items-center py-8">
          <Text className="text-muted-foreground text-sm">
            SKIBIDI ORDERS v1.0
          </Text>
          <Text className="text-muted-foreground text-xs mt-1">
            Powered by Expo + Supabase
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
