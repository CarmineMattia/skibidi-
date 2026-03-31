/**
 * Home Screen
 * - Guest home: conversione rapida con 2 CTA principali
 * - Logged home: retention (riordino, in voga, storico, consigli)
 */

import { HomeCategoryGrid } from '@/components/features/home/HomeCategoryGrid';
import { HomeDiscoveryCards } from '@/components/features/home/HomeDiscoveryCards';
import { HomeGuestHero } from '@/components/features/home/HomeGuestHero';
import { HomeHistoryPreview } from '@/components/features/home/HomeHistoryPreview';
import { HomeLoggedWelcome } from '@/components/features/home/HomeLoggedWelcome';
import { HomeQuickActions } from '@/components/features/home/HomeQuickActions';
import { HomeTrendingSection } from '@/components/features/home/HomeTrendingSection';
import type {
  HomeCategory,
  HomeRecentOrder,
  HomeTrendingPizza,
} from '@/components/features/home/types';
import { useRouter } from 'expo-router';
import {
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/stores/AuthContext';
import { useProducts } from '@/lib/hooks/useProducts';
import { useCart } from '@/lib/stores/CartContext';
import { useMemo } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const viewportWidth = Dimensions.get('window').width;
  const effectiveWidth = Math.min(width, viewportWidth);
  const isCompact = effectiveWidth < 430;
  const { isAuthenticated, profile, signOut, isGuest, exitGuestMode, isAdmin } = useAuth();
  const { addItem } = useCart();
  const { data: products = [] } = useProducts();
  const isGuestExperience = !isAuthenticated;

  const trendingPizzas: HomeTrendingPizza[] = [
    {
      id: '1',
      name: 'Margherita DOP',
      description: 'Pomodoro San Marzano, bufala, basilico',
      price: 12.5,
      badge: 'Best seller',
      image: '🍕',
      imageUrl:
        'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: '2',
      name: 'Diavola',
      description: 'Salame piccante, mozzarella, olio al peperoncino',
      price: 13.5,
      badge: 'Piccante',
      image: '🌶️🍕',
      imageUrl:
        'https://images.unsplash.com/photo-1548365328-9f547fb0953b?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: '3',
      name: 'Capricciosa',
      description: 'Prosciutto cotto, funghi, carciofi, olive',
      price: 14,
      badge: 'Consigliata',
      image: '🍄🍕',
      imageUrl:
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80',
    },
  ];

  const categories: HomeCategory[] = [
    { id: 1, name: 'Pizze', icon: '🍕', color: 'bg-orange-100' },
    { id: 2, name: 'Burger', icon: '🍔', color: 'bg-red-100' },
    { id: 3, name: 'Insalate', icon: '🥗', color: 'bg-green-100' },
    { id: 4, name: 'Dolci', icon: '🍦', color: 'bg-pink-100' },
    { id: 5, name: 'Bevande', icon: '🥤', color: 'bg-blue-100' },
  ];

  const recentOrders: HomeRecentOrder[] = [
    { id: 'ORD-12345', date: '12/03', total: 15.5, status: 'Completato' },
    { id: 'ORD-12340', date: '10/03', total: 8, status: 'Completato' },
  ];

  const guestTrendingPizzas = useMemo<HomeTrendingPizza[]>(() => {
    const pizzaByName = products.filter((product) => {
      const searchable = `${product.name} ${product.description ?? ''}`.toLowerCase();
      return searchable.includes('pizza') || searchable.includes('margherita') || searchable.includes('diavola');
    });

    const source = pizzaByName.length > 0 ? pizzaByName : products;
    const mapped = source.slice(0, 4).map((product, index) => {
      let badge = 'Consigliata';
      if (index === 0) badge = 'Best seller';
      if (index === 1) badge = 'Piccante';

      return {
        id: product.id,
        name: product.name,
        description: product.description || 'Ricetta artigianale del giorno',
        price: product.price,
        badge,
        image: '🍕',
        imageUrl: product.image_url,
      };
    });

    return mapped.length > 0 ? mapped : trendingPizzas;
  }, [products]);

  const handleLogout = async () => {
    try {
      if (isGuest && !isAuthenticated) {
        exitGuestMode();
      } else {
        await signOut();
      }
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

  const handleAddSuggestedPizza = (pizzaId: string) => {
    const product = products.find((item) => item.id === pizzaId);
    if (!product) {
      router.push('/(tabs)/menu');
      return;
    }

    addItem(product, 1);
    router.push('/(tabs)/menu');
  };

  const renderGuestHome = () => (
    <View className={`w-full self-center max-w-[1120px] ${isCompact ? 'px-3 pt-3 gap-4' : 'px-4 pt-4 gap-5'}`}>
      <HomeGuestHero
        onOrderNow={() => router.push('/(tabs)/menu')}
        onViewMenu={() => router.push('/(tabs)/menu')}
      />

      <HomeTrendingSection
        title="🔥 In Voga Oggi"
        pizzas={guestTrendingPizzas}
        onOpenAll={() => router.push('/(tabs)/menu')}
        onOpenPizza={() => router.push('/(tabs)/menu')}
        onQuickAddPizza={handleAddSuggestedPizza}
      />

      <HomeDiscoveryCards
        onOpenChef={() => router.push('/(tabs)/menu')}
        onOpenNearby={() => router.push('/(tabs)/menu')}
      />

      <HomeCategoryGrid
        categories={categories}
        onOpenAll={() => router.push('/(tabs)/menu')}
        onOpenCategory={(categoryId) => router.push(`/(tabs)/menu?category=${categoryId}`)}
      />

      <HomeQuickActions
        isAdmin={false}
        onOpenMenu={() => router.push('/(tabs)/menu')}
        onOpenKitchen={() => router.push('/(tabs)/kitchen')}
        onOpenTracking={() => router.push('/order-tracking')}
        onOpenRewards={() => router.push('/rewards')}
        onLogout={handleLogout}
      />
    </View>
  );

  const renderLoggedHome = () => (
    <View className={`w-full self-center max-w-[1120px] ${isCompact ? 'p-3 gap-4' : 'p-4 gap-5'}`}>
      <HomeLoggedWelcome
        firstName={profile?.full_name?.split(' ')[0] || 'cliente'}
        onReorderLast={() => handleReorder(recentOrders[0].id)}
        onContinueMenu={() => router.push('/(tabs)/menu')}
      />

      <HomeTrendingSection
        title="🔥 In Voga Oggi"
        pizzas={trendingPizzas}
        onOpenAll={() => router.push('/(tabs)/menu')}
        onOpenPizza={() => router.push('/(tabs)/menu')}
      />

      <HomeHistoryPreview
        orders={recentOrders}
        onOpenAll={() => router.push('/(tabs)/two')}
        onOpenOrder={() => router.push('/(tabs)/two')}
        onReorder={handleReorder}
      />

      <HomeDiscoveryCards
        onOpenChef={() => router.push('/(tabs)/menu')}
        onOpenNearby={() => router.push('/(tabs)/menu')}
      />

      <HomeCategoryGrid
        categories={categories}
        onOpenAll={() => router.push('/(tabs)/menu')}
        onOpenCategory={(categoryId) => router.push(`/(tabs)/menu?category=${categoryId}`)}
      />

      <HomeQuickActions
        isAdmin={isAdmin}
        onOpenMenu={() => router.push('/(tabs)/menu')}
        onOpenKitchen={() => router.push('/(tabs)/kitchen')}
        onOpenTracking={() => router.push('/order-tracking')}
        onOpenRewards={() => router.push('/rewards')}
        onLogout={handleLogout}
      />
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-[#fdf9f3]"
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => {}} />
      }
    >
      {/* Compact Header */}
      <View className={`bg-white/95 border-b border-[#ead8c7] ${isCompact ? 'px-3 py-2.5' : 'p-4 pb-3'}`}>
        <View className="w-full self-center max-w-[1120px] flex-row items-center gap-2">
          <View className="flex-1 min-w-0">
            <Text
              className={`font-extrabold text-gray-900 ${isCompact ? 'text-lg' : 'text-2xl'}`}
              numberOfLines={1}
            >
              {isGuestExperience ? 'AMBROSIA' : 'SKIBIDI ORDERS'}
            </Text>
            <Text className={`text-orange-600 font-bold ${isCompact ? 'text-xs' : 'text-sm'}`}>
              {isGuestExperience ? 'Pizzeria Artigianale' : 'Sistema POS'}
            </Text>
          </View>
        </View>
      </View>

      {isAuthenticated ? renderLoggedHome() : renderGuestHome()}

      {/* Footer */}
      <View className="items-center py-4 border-t border-orange-100 mx-4">
        <Text className="text-gray-400 text-[10px]">
          SKIBIDI ORDERS v1.0 {isAuthenticated ? '• Logged' : '• Guest'}
        </Text>
      </View>
    </ScrollView>
  );
}
