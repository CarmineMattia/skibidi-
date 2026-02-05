/**
 * Home Screen
 * Schermata principale con esempio di UI components
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
import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

export default function HomeScreen() {
  const { userRole, isKioskMode, user, signOut } = useAuth();
  const router = useRouter();
  const { data: stats, isLoading, refetch } = useDashboardStats();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Errore durante il logout:', error);
    }
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
