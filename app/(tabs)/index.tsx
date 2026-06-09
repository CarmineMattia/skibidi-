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
import { HomeOffersSection, type HomeOfferCard } from '@/components/features/home/HomeOffersSection';
import { HomePrimaryActions } from '@/components/features/home/HomePrimaryActions';
import { HomeQuickActions } from '@/components/features/home/HomeQuickActions';
import { HomeTrendingSection } from '@/components/features/home/HomeTrendingSection';
import { OrderAssistantChat } from '@/components/features/chat/OrderAssistantChat';
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
import { useOrders } from '@/lib/hooks/useOrders';
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
  const { data: orders = [] } = useOrders({ limit: 8, enabled: isAuthenticated });
  const isGuestExperience = !isAuthenticated;

  const trendingPizzas: HomeTrendingPizza[] = [
    {
      id: '1',
      name: 'Margherita DOP',
      description: 'Pomodoro San Marzano, bufala, basilico',
      price: 12.5,
      badge: 'Best seller',
      image: '',
      imageUrl:
        'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: '2',
      name: 'Diavola',
      description: 'Salame piccante, mozzarella, olio al peperoncino',
      price: 13.5,
      badge: 'Piccante',
      image: '',
      imageUrl:
        'https://images.unsplash.com/photo-1594007654729-407eedc4fe0f?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: '3',
      name: 'Capricciosa',
      description: 'Prosciutto cotto, funghi, carciofi, olive',
      price: 14,
      badge: 'Consigliata',
      image: '',
      imageUrl:
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: '4',
      name: 'Quattro Formaggi',
      description: 'Mozzarella, gorgonzola, fontina e parmigiano',
      price: 14.5,
      badge: 'Cremosa',
      image: '',
      imageUrl:
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: '5',
      name: 'Bufalina',
      description: 'Bufala campana, pomodorini e basilico fresco',
      price: 15,
      badge: 'Premium',
      image: '',
      imageUrl:
        'https://images.unsplash.com/photo-1542834369-f10ebf06d3e0?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: '6',
      name: 'Vegetariana',
      description: 'Verdure grigliate, olive nere e mozzarella',
      price: 13,
      badge: 'Leggera',
      image: '',
      imageUrl:
        'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=900&q=80',
    },
  ];

  const categories: HomeCategory[] = [
    { id: 1, name: 'Pizze', icon: '', color: 'bg-[#f3dabb]' },
    { id: 2, name: 'Burger', icon: '', color: 'bg-red-100' },
    { id: 3, name: 'Insalate', icon: '', color: 'bg-green-100' },
    { id: 4, name: 'Dolci', icon: '', color: 'bg-pink-100' },
    { id: 5, name: 'Bevande', icon: '', color: 'bg-blue-100' },
  ];

  const guestTrendingPizzas = useMemo<HomeTrendingPizza[]>(() => {
    const pizzaByName = products.filter((product) => {
      const searchable = `${product.name} ${product.description ?? ''}`.toLowerCase();
      return searchable.includes('pizza') || searchable.includes('margherita') || searchable.includes('diavola');
    });

    const source = pizzaByName.length > 0 ? pizzaByName : products;
    const mapped = source.slice(0, 8).map((product, index) => {
      let badge = 'Consigliata';
      if (index === 0) badge = 'Best seller';
      if (index === 1) badge = 'Piccante';

      return {
        id: product.id,
        name: product.name,
        description: product.description || 'Ricetta artigianale del giorno',
        price: product.price,
        badge,
        image: '',
        imageUrl: product.image_url,
      };
    });

    return mapped.length > 0 ? mapped : trendingPizzas;
  }, [products]);

  const recentOrders = useMemo<HomeRecentOrder[]>(() => {
    if (!isAuthenticated || orders.length === 0) {
      return [];
    }

    return orders.slice(0, 2).map((order) => {
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      const date = createdAt
        ? createdAt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
        : '--/--';

      return {
        id: `ORD-${order.id.slice(0, 6).toUpperCase()}`,
        date,
        total: order.total_amount,
        status: order.status === 'delivered' ? 'Completato' : 'In corso',
      };
    });
  }, [isAuthenticated, orders]);

  const hasRecentOrders = recentOrders.length > 0;

  const offerCards = useMemo<HomeOfferCard[]>(
    () => [
      {
        id: 'offerta-1',
        title: 'Combo Menu Completo',
        subtitle: 'Combo meal completo: burger artigianale, fries croccanti e drink 33cl inclusi',
        cta: 'Prendi il combo',
        imageUrl:
          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
        includes: ['Burger', 'Fries', 'Drink'],
        previewImages: [
          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?auto=format&fit=crop&w=300&q=80',
        ],
      },
      {
        id: 'offerta-2',
        title: 'Duo Burger & Fries',
        subtitle: '2 combo meal completi con doppio burger, fries e bibite ghiacciate',
        cta: 'Attiva offerta',
        imageUrl:
          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
        includes: ['2x Burger', '2x Fries', '2x Drink'],
        previewImages: [
          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=300&q=80',
        ],
      },
      {
        id: 'offerta-3',
        title: 'Family Combo',
        subtitle: 'Combo meal famiglia: 2 pizze grandi, fries da condividere e 2 drink',
        cta: 'Ordina family',
        imageUrl:
          'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1200&q=80',
        includes: ['2x Pizza', 'Maxi Fries', '2x Drink'],
        previewImages: [
          'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1625944525533-473f1f45d7c3?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=300&q=80',
        ],
      },
      {
        id: 'offerta-4',
        title: 'Snack Box XL',
        subtitle: 'Combo meal snack: nuggets, onion rings, fries e bibita media inclusa',
        cta: 'Scopri snack box',
        imageUrl:
          'https://images.unsplash.com/photo-1512152272829-e3139592d56f?auto=format&fit=crop&w=1200&q=80',
        includes: ['Nuggets', 'Fries', 'Drink'],
        previewImages: [
          'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1625944525533-473f1f45d7c3?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1610873167013-2dd675d30ef4?auto=format&fit=crop&w=300&q=80',
        ],
      },
      {
        id: 'offerta-5',
        title: 'Lunch Deal Smart',
        subtitle: 'Combo meal pranzo: burger o wrap, fries e soft drink inclusi',
        cta: 'Vedi lunch deal',
        imageUrl:
          'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=1200&q=80',
        includes: ['Wrap/Burger', 'Fries', 'Soft Drink'],
        previewImages: [
          'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=300&q=80',
        ],
      },
      {
        id: 'offerta-6',
        title: 'Weekend Party Menu',
        subtitle: 'Combo meal party: pizza, fries, chicken bites e drink per tutti',
        cta: 'Apri promo weekend',
        imageUrl:
          'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80',
        includes: ['Pizza', 'Fries', 'Drinks'],
        previewImages: [
          'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=300&q=80',
        ],
      },
    ],
    []
  );

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
      'Riordina',
      'Vuoi ordinare di nuovo questo ordine?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Sì, Riordina',
          onPress: () => {
            Alert.alert('Aggiunto', 'Articoli aggiunti al carrello');
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

  const handleSelectTrendingPizza = (pizza: HomeTrendingPizza) => {
    const normalizedName = pizza.name.toLowerCase();
    const product = products.find((item) => {
      const nameMatch = item.name.toLowerCase().includes(normalizedName) || normalizedName.includes(item.name.toLowerCase());
      const idMatch = item.id === pizza.id;
      return idMatch || nameMatch;
    });

    if (product) {
      addItem(product, 1);
      router.push('/(tabs)/menu');
      return;
    }

    router.push('/(tabs)/menu');
  };

  const renderGuestHome = () => (
    <View className={`w-full self-center max-w-[1120px] ${isCompact ? 'px-3 pt-3 gap-4' : 'px-4 pt-4 gap-5'}`}>
      <HomeTrendingSection
        title="In Voga Oggi"
        pizzas={guestTrendingPizzas}
        onOpenAll={() => router.push('/(tabs)/menu')}
        onOpenPizza={handleSelectTrendingPizza}
        onQuickAddPizza={handleAddSuggestedPizza}
      />

      <HomePrimaryActions
        onOrderNow={() => router.push('/(tabs)/menu')}
        onViewMenu={() => router.push('/(tabs)/menu')}
      />

      <HomeOffersSection offers={offerCards} onOpenOffer={() => router.push('/(tabs)/menu')} />

      <OrderAssistantChat />

      <HomeGuestHero
        onOrderNow={() => router.push('/(tabs)/menu')}
        onViewMenu={() => router.push('/(tabs)/menu')}
        showActions={false}
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
      <HomeTrendingSection
        title="In Voga Oggi"
        pizzas={trendingPizzas}
        onOpenAll={() => router.push('/(tabs)/menu')}
        onOpenPizza={handleSelectTrendingPizza}
      />

      <HomePrimaryActions
        onOrderNow={() => router.push('/(tabs)/menu')}
        onViewMenu={() => router.push('/(tabs)/menu')}
      />

      <HomeOffersSection offers={offerCards} onOpenOffer={() => router.push('/(tabs)/menu')} />

      <OrderAssistantChat />

      <HomeLoggedWelcome
        firstName={profile?.full_name?.split(' ')[0] || 'cliente'}
        showReorder={hasRecentOrders}
        onReorderLast={hasRecentOrders ? () => handleReorder(recentOrders[0].id) : undefined}
        onContinueMenu={() => router.push('/(tabs)/menu')}
        showActions={false}
      />

      {hasRecentOrders ? (
        <HomeHistoryPreview
          orders={recentOrders}
          onOpenAll={() => router.push('/(tabs)/two')}
          onOpenOrder={() => router.push('/(tabs)/two')}
          onReorder={handleReorder}
        />
      ) : null}

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
      className="flex-1 bg-[#f9ecdd]"
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => {}} />
      }
    >
      {/* Compact Header */}
      <View className={`bg-[#f9ecdd]/95 border-b border-[#e1a255]/40 ${isCompact ? 'px-3 py-2.5' : 'p-4 pb-3'}`}>
        <View className="w-full self-center max-w-[1120px] flex-row items-center gap-2">
          <View className="flex-1 min-w-0">
            <Text
              className={`font-extrabold text-gray-900 ${isCompact ? 'text-lg' : 'text-2xl'}`}
              numberOfLines={1}
            >
              Pizzeria Matildica
            </Text>
            <Text className={`text-[#8d171e] font-bold ${isCompact ? 'text-xs' : 'text-sm'}`}>
              {isGuestExperience ? 'Il Nettare degli Dei' : 'Sistema POS'}
            </Text>
          </View>
        </View>
      </View>

      {isAuthenticated ? renderLoggedHome() : renderGuestHome()}

      {/* Footer */}
      <View className="items-center py-4 border-t border-[#e1a255]/40 mx-4">
        <Text className="text-gray-400 text-[10px]">
          Pizzeria Matildica v1.0 {isAuthenticated ? '• Logged' : '• Guest'}
        </Text>
      </View>
    </ScrollView>
  );
}
