/**
 * Menu Screen
 * Main POS interface with product grid and cart
 */

import { CartSummary } from '@/components/features/CartSummary';
import { CategoryFilter } from '@/components/features/CategoryFilter';
import { MobileCategoryBar } from '@/components/features/MobileCategoryBar';
import { EditProductModal } from '@/components/features/EditProductModal';
import { PizzaBuilderModal } from '@/components/features/PizzaBuilderModal';
import { ProductCard } from '@/components/features/ProductCard';
import { ProductDetailsModal } from '@/components/features/ProductDetailsModal';
import { SkeletonProductCard, SkeletonMenuScreen } from '@/components/ui/Skeleton';
import { BUILDER_PRODUCT_NAME, getQuickAddPizzaModifiers } from '@/lib/data/pizzaBuilder';
import { BRAND, BRAND_LOGO } from '@/lib/data/brand';
import { readJsonStorage, writeJsonStorage } from '@/lib/utils/storage';
import { useCategories } from '@/lib/hooks/useCategories';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { OfflineIndicator } from '@/lib/hooks/useOfflineQueue';
import { useProducts } from '@/lib/hooks/useProducts';
import { useAuth } from '@/lib/stores/AuthContext';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { useCart } from '@/lib/stores/CartContext';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function isDrinkCategoryName(categoryName: string): boolean {
  const normalized = categoryName.toLowerCase();
  return (
    normalized.includes('bevand') ||
    normalized.includes('drink') ||
    normalized.includes('bibit') ||
    normalized.includes('cocktail') ||
    normalized.includes('birr') ||
    normalized.includes('vino')
  );
}

function isPizzaCategoryName(categoryName?: string): boolean {
  if (!categoryName) return false;
  return categoryName.toLowerCase().includes('pizz');
}

function isMetroCategoryName(categoryName?: string): boolean {
  if (!categoryName) return false;
  return categoryName.toLowerCase().includes('metro');
}

function isStandardMenuPizza(product: Product, categoryName?: string): boolean {
  return (
    isPizzaCategoryName(categoryName) &&
    !isMetroCategoryName(categoryName) &&
    product.name !== 'Piccola' &&
    product.name !== BUILDER_PRODUCT_NAME
  );
}

function DrinkSpotlightWrap({
  active,
  title,
  closeLabel,
  onDismiss,
  children,
}: {
  active: boolean;
  title: string;
  closeLabel: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <View className="relative flex-1">
      {children}
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-3xl border-2 border-[#8d171e]"
      />
      <View className="absolute left-3 right-3 top-4 z-40 items-center" pointerEvents="box-none">
        <Pressable
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          className="flex-row items-center gap-3 bg-[#8d171e] rounded-3xl px-5 py-3.5 max-w-full"
        >
          <FontAwesome name="glass" size={hovered ? 20 : 16} color="#f9ecdd" />
          <Text
            className={`text-white font-extrabold ${hovered ? 'text-2xl' : 'text-lg'}`}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
          >
            <FontAwesome name="close" size={14} color="#f9ecdd" />
          </Pressable>
        </Pressable>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderRightWidth: 10,
            borderTopWidth: 12,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: '#8d171e',
          }}
        />
      </View>
    </View>
  );
}

export default function MenuScreen() {
  const { width } = useWindowDimensions();
  const viewportWidth = Dimensions.get('window').width;
  const effectiveWidth = Math.min(width, viewportWidth);
  // Mobile-first breakpoints.
  const isMobile = effectiveWidth < 768;
  const isCompactMobile = effectiveWidth < 430;
  const isUltraCompactMobile = effectiveWidth < 400;
  const isDesktop = effectiveWidth >= 1100;
  const isTablet = effectiveWidth >= 768 && effectiveWidth < 1200;
  const productColumns = isDesktop ? 3 : isTablet ? 2 : isCompactMobile ? 1 : 2;
  const effectiveProductColumns = isMobile ? 1 : productColumns;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  useEffect(() => {
    const saved = readJsonStorage<{ categoryId?: unknown; search?: unknown }>('ambrosia.menu.selection.v1', 'session');
    setSelectedCategoryId(typeof saved?.categoryId === 'string' ? saved.categoryId : null);
    setMenuSearchQuery(typeof saved?.search === 'string' ? saved.search : '');
    setSelectionHydrated(true);
  }, []);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [isMobileCategoriesOpen, setIsMobileCategoriesOpen] = useState(false);
  const [showContinueWithoutDrinks, setShowContinueWithoutDrinks] = useState(false);
  const [highlightedDrinkId, setHighlightedDrinkId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectionHydrated) return;
    writeJsonStorage(
      'ambrosia.menu.selection.v1',
      { categoryId: selectedCategoryId, search: menuSearchQuery },
      'session'
    );
  }, [selectedCategoryId, menuSearchQuery, selectionHydrated]);
  const productListRef = useRef<FlatList<Product>>(null);
  const insets = useSafeAreaInsets();

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { items, addItem, updateQuantity, totalItems, totalAmount } = useCart();
  const { isAuthenticated, profile, signOut, isGuest, exitGuestMode, isAdmin } = useAuth();
  const { language } = useAppSettings();
  const showDesktopSidebars = isDesktop;
  const createOrder = useCreateOrder();
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedCategoryName = categories.find((category) => category.id === selectedCategoryId)?.name || 'Cibo';
  const drinkCategories = useMemo(
    () => categories.filter((category) => isDrinkCategoryName(category.name)),
    [categories]
  );
  const drinkCategoryIds = useMemo(
    () => new Set(drinkCategories.map((category) => category.id)),
    [drinkCategories]
  );
  const firstDrinkCategoryId = drinkCategories[0]?.id;
  const displayProducts = useMemo(() => {
    const query = menuSearchQuery.trim().toLowerCase();
    let list = products;

    if (query) {
      list = list.filter((product) => {
        const hay = [
          product.name,
          product.description || '',
          ...(product.ingredients || []),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(query);
      });
    } else if (selectedCategoryId === null) {
      // Default menu mode: show only food, unless user explicitly selects a drinks category.
      list = list.filter((product) => !drinkCategoryIds.has(product.category_id));
    } else {
      list = list.filter((product) => product.category_id === selectedCategoryId);
    }

    return list;
  }, [products, selectedCategoryId, drinkCategoryIds, menuSearchQuery]);

  const categoryImages = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const product of products) {
      if (!product.image_url || map[product.category_id]) continue;
      map[product.category_id] = product.image_url;
    }
    return map;
  }, [products]);

  useEffect(() => {
    if (selectedProduct || products.length === 0) return;
    const saved = readJsonStorage<{ productId: string | null }>('ambrosia.menu.selectedProduct.v1', 'session');
    if (!saved?.productId) return;
    const product = products.find((p) => p.id === saved.productId);
    if (product) setSelectedProduct(product);
  }, [products, selectedProduct]);

  const featuredProduct = displayProducts[0];
  const i18n = useMemo(
    () =>
      language === 'en'
        ? {
            menuSubtitle: 'Order online',
            guest: 'Guest',
            account: 'My account',
            signOut: 'Sign out',
            signIn: 'Sign in',
            cart: 'Cart',
            featuredBadge: "Chef's Choice",
            featuredTitle: 'The Truffle Hearth',
            featuredDescription: 'Wild mushrooms, black truffle oil, fresh fior di latte and aged parmesan.',
            artisanalRecipe: 'Artisanal recipe',
            yourOrder: 'Your Order',
            itemsLabel: 'items',
            drinkPromptTitle: 'Pick a drink!',
          }
        : {
            menuSubtitle: 'Ordina online',
            guest: 'Ospite',
            account: 'Il mio account',
            signOut: 'Esci',
            signIn: 'Accedi',
            cart: 'Carrello',
            featuredBadge: 'Scelta dello chef',
            featuredTitle: 'La Fiamma al Tartufo',
            featuredDescription: 'Funghi di bosco, olio al tartufo nero, fior di latte fresco e parmigiano stagionato.',
            artisanalRecipe: 'Ricetta artigianale',
            yourOrder: 'Il tuo ordine',
            itemsLabel: 'articoli',
            drinkPromptTitle: 'Scegli una bevanda!',
          },
    [language]
  );

  const accountDisplayName = useMemo(() => {
    if (!isAuthenticated || !profile) return i18n.guest;
    if (isAdmin) return 'Admin';
    const fullName = profile.full_name?.trim();
    if (fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2 && parts[0].toLowerCase() === 'super') {
        return parts.slice(1).join(' ') || 'Admin';
      }
      return parts[0];
    }
    return profile.email?.split('@')[0] || i18n.account;
  }, [i18n.account, i18n.guest, isAdmin, isAuthenticated, profile]);

  const accountInitial = (accountDisplayName.charAt(0) || 'A').toUpperCase();

  useEffect(() => {
    if (!isMobile) {
      setIsMobileCategoriesOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const cartHasDrinks = items.some((item) => drinkCategoryIds.has(item.product.category_id));
    if (cartHasDrinks) {
      setShowContinueWithoutDrinks(false);
      setHighlightedDrinkId(null);
    }
  }, [items, drinkCategoryIds]);

  useEffect(() => {
    if (!showContinueWithoutDrinks) {
      setHighlightedDrinkId(null);
      return;
    }
    if (displayProducts.length === 0) return;

    setHighlightedDrinkId((current) => {
      if (current && displayProducts.some((product) => product.id === current)) {
        return current;
      }
      const pick = displayProducts[Math.floor(Math.random() * displayProducts.length)];
      return pick.id;
    });
  }, [showContinueWithoutDrinks, displayProducts]);

  useEffect(() => {
    if (!highlightedDrinkId) return;
    const itemIndex = displayProducts.findIndex((product) => product.id === highlightedDrinkId);
    if (itemIndex < 0) return;

    const columns = Math.max(1, effectiveProductColumns);
    const rowIndex = Math.floor(itemIndex / columns);
    const rowCount = Math.ceil(displayProducts.length / columns);
    if (rowIndex < 0 || rowIndex >= rowCount) return;

    const timer = setTimeout(() => {
      try {
        productListRef.current?.scrollToIndex({
          index: rowIndex,
          animated: true,
          viewPosition: 0.25,
        });
      } catch {
        // FlatList may not be measured yet; skip rather than crash checkout.
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [highlightedDrinkId, displayProducts, effectiveProductColumns]);

  const dismissDrinkHint = useCallback(() => {
    setShowContinueWithoutDrinks(false);
    setHighlightedDrinkId(null);
  }, []);

  useEffect(() => {
    if (!showContinueWithoutDrinks || !highlightedDrinkId) return;
    const timer = setTimeout(dismissDrinkHint, 4000);
    return () => clearTimeout(timer);
  }, [showContinueWithoutDrinks, highlightedDrinkId, dismissDrinkHint]);

  const handleProductPress = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      writeJsonStorage('ambrosia.menu.selectedProduct.v1', { productId }, 'session');
      setSelectedProduct(product);
    }
  };

  const handleQuickAdd = (product: Product) => {
    if (product.name === BUILDER_PRODUCT_NAME) {
      handleProductPress(product.id);
      return;
    }
    const categoryName = categories.find((category) => category.id === product.category_id)?.name;
    if (isStandardMenuPizza(product, categoryName)) {
      addItem(product, 1, '', getQuickAddPizzaModifiers());
      return;
    }
    addItem(product, 1);
  };

  const handleQuickDecrement = (product: Product) => {
    let lastIndex = -1;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].product.id === product.id) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex < 0) return;
    updateQuantity(lastIndex, items[lastIndex].quantity - 1);
  };

  const handleEditPress = (product: Product) => {
    setSelectedProduct(product);
    setIsEditModalVisible(true);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Carrello vuoto', 'Aggiungi prodotti prima di procedere.');
      return;
    }
    const cartHasDrinks = items.some((item) => drinkCategoryIds.has(item.product.category_id));
    const isCurrentlyOnDrinks = selectedCategoryId ? drinkCategoryIds.has(selectedCategoryId) : false;
    if (!cartHasDrinks && !isCurrentlyOnDrinks && firstDrinkCategoryId) {
      setMenuSearchQuery('');
      setSelectedCategoryId(firstDrinkCategoryId);
      setShowContinueWithoutDrinks(true);
      return;
    }

    setShowContinueWithoutDrinks(false);
    router.push('/modal');
  };

  const handleLogout = async () => {
    try {
      if (isGuest && !isAuthenticated) {
        // Uscita dalla modalità ospite
        exitGuestMode();
      } else {
        await signOut();
      }
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Errore', 'Impossibile effettuare il logout.');
    }
  };

  // Initial loading state
  if (categoriesLoading) {
    return (
      <View className="flex-1 bg-[#f9ecdd]" style={{ paddingTop: insets.top }}>
        <SkeletonMenuScreen numColumns={effectiveProductColumns} isMobile={isMobile} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f9ecdd]" style={{ paddingTop: insets.top }}>
      {/* Top bar — stile sito */}
      <View
        className="z-10 border-b border-[#8d171e]/10 bg-[#fff9f1]/95"
        style={
          Platform.OS === 'web'
            ? { boxShadow: '0 1px 0 rgba(39, 29, 25, 0.04), 0 8px 24px rgba(39, 29, 25, 0.04)' }
            : undefined
        }
      >
        <View
          className={`w-full flex-row items-center justify-between ${
            isMobile ? (isUltraCompactMobile ? 'px-3 py-2' : 'px-3 py-2.5') : 'px-6 py-3 md:px-8'
          }`}
          style={{ minHeight: isMobile ? 56 : 68 }}
        >
          <View className={`min-w-0 flex-1 flex-row items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
            {!showDesktopSidebars && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isMobileCategoriesOpen ? 'Chiudi categorie' : 'Apri categorie'}
                onPress={() => setIsMobileCategoriesOpen((prev) => !prev)}
                className={`items-center justify-center rounded-lg border border-[#8d171e]/15 bg-white active:opacity-80 ${
                  isUltraCompactMobile ? 'h-8 w-8' : 'h-9 w-9'
                }`}
              >
                <FontAwesome
                  name={isMobileCategoriesOpen ? 'close' : 'bars'}
                  size={isUltraCompactMobile ? 14 : 15}
                  color="#342b27"
                />
              </Pressable>
            )}

            <View
              className="shrink-0"
              style={{
                height: isMobile ? 34 : 44,
                width: isMobile ? 60 : 78,
              }}
            >
              <Image
                source={BRAND_LOGO}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
                accessibilityLabel={`Logo ${BRAND.name}`}
              />
            </View>

            <View className="min-w-0 flex-1">
              <Text
                className={`font-black tracking-[-0.3px] text-[#271d19] ${
                  isMobile ? (isUltraCompactMobile ? 'text-sm' : 'text-[15px]') : 'text-base'
                }`}
                numberOfLines={1}
              >
                {BRAND.name}
              </Text>
              {!isUltraCompactMobile && (
                <Text className="text-[11px] font-semibold text-[#8d171e]" numberOfLines={1}>
                  {i18n.menuSubtitle}
                </Text>
              )}
            </View>
          </View>

          <View className={`shrink-0 flex-row items-center ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.account}
              onPress={() => router.push('/(tabs)/account')}
              className={`flex-row items-center gap-2 rounded-lg active:opacity-70 web:hover:bg-[#8d171e]/[0.06] ${
                isMobile ? 'px-1.5 py-1.5' : 'px-2.5 py-2'
              }`}
            >
              <View
                className={`items-center justify-center rounded-full border border-[#8d171e]/20 bg-white ${
                  isMobile ? 'h-8 w-8' : 'h-9 w-9'
                }`}
              >
                {isAuthenticated ? (
                  <Text className="text-xs font-bold text-[#8d171e]">{accountInitial}</Text>
                ) : (
                  <FontAwesome name="user-o" size={isMobile ? 13 : 14} color="#8d171e" />
                )}
              </View>
              {!isMobile && (
                <View className="max-w-[140px]">
                  <Text className="text-sm font-bold text-[#342b27]" numberOfLines={1}>
                    {accountDisplayName}
                  </Text>
                  <Text className="text-[10px] font-semibold uppercase tracking-wide text-[#8d171e]/80">
                    {isAuthenticated ? i18n.account : i18n.guest}
                  </Text>
                </View>
              )}
            </Pressable>

            {totalItems > 0 && (
              <View
                className={`flex-row items-center gap-1.5 rounded-lg border border-[#8d171e]/20 bg-white ${
                  isMobile ? 'px-2.5 py-1.5' : 'px-3 py-2'
                }`}
                accessibilityLabel={`${i18n.cart}: ${totalItems}`}
              >
                <FontAwesome name="shopping-bag" size={isMobile ? 12 : 13} color="#8d171e" />
                <Text className={`font-bold text-[#8d171e] ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  {totalItems}
                </Text>
              </View>
            )}

            {(isAuthenticated || isGuest) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={i18n.signOut}
                onPress={handleLogout}
                className={`rounded-lg border border-[#8d171e]/12 bg-white active:opacity-70 web:hover:bg-[#8d171e]/[0.05] ${
                  isMobile ? 'px-2.5 py-2' : 'px-3 py-2'
                }`}
              >
                {isMobile ? (
                  <FontAwesome name="sign-out" size={14} color="#8d171e" />
                ) : (
                  <Text className="text-sm font-semibold text-[#453831]">{i18n.signOut}</Text>
                )}
              </Pressable>
            )}

            {!isAuthenticated && !isGuest && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/login')}
                className={`items-center justify-center rounded-lg bg-[#8d171e] active:opacity-90 web:hover:bg-[#741218] ${
                  isMobile ? 'px-3 py-2' : 'px-4 py-2.5'
                }`}
              >
                <Text className={`font-bold text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  {i18n.signIn}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Main Content Area - Split Layout */}
      <View className="flex-1 flex-row">
        {/* Left Sidebar - Categories (Toggleable) */}
        {showDesktopSidebars && (
          <CategoryFilter
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={(id) => { setMenuSearchQuery(''); setSelectedCategoryId(id); }}
            categoryImages={categoryImages}
          />
        )}

        {/* Center - Product Grid */}
        <View className="flex-1 bg-[#f9ecdd]">
          {/* Offline Indicator */}
          <OfflineIndicator />

          {!showDesktopSidebars ? (
            <MobileCategoryBar
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(id) => { setMenuSearchQuery(''); setSelectedCategoryId(id); }}
              searchQuery={menuSearchQuery}
              onChangeSearch={setMenuSearchQuery}
              categoryImages={categoryImages}
            />
          ) : null}

          {productsLoading ? (
            <FlatList
              data={Array.from({ length: 6 })}
              keyExtractor={(_, index) => `skeleton-${index}`}
              numColumns={effectiveProductColumns}
              key={`skeleton-${effectiveProductColumns}`}
              contentContainerClassName={`${isMobile ? 'p-3 pb-40' : 'p-4 md:p-6 pb-24'}`}
              columnWrapperClassName={effectiveProductColumns > 1 ? (isMobile ? 'gap-3' : 'gap-6') : undefined}
              ItemSeparatorComponent={() => <View className={isMobile ? 'h-3' : 'h-4 md:h-6'} />}
              showsVerticalScrollIndicator={false}
              renderItem={() => (
                <View className={`flex-1 ${effectiveProductColumns > 1 ? (isMobile ? 'h-[330px]' : 'h-[450px]') : 'h-[380px]'} ${isMobile ? '' : 'max-w-[500px]'}`}>
                  <SkeletonProductCard isLarge={effectiveProductColumns > 1} />
                </View>
              )}
            />
          ) : displayProducts.length === 0 ? (
            <View className="flex-1 items-center justify-center p-8">
              <FontAwesome name="cutlery" size={44} color="#9ca3af" style={{ marginBottom: 12 }} />
              <Text className="text-muted-foreground text-xl font-medium">
                Nessun prodotto trovato
              </Text>
            </View>
          ) : (
            <FlatList
              ref={productListRef}
              data={displayProducts}
              extraData={`${highlightedDrinkId}-${showContinueWithoutDrinks}-${totalItems}`}
              keyExtractor={(item) => item.id}
              numColumns={effectiveProductColumns}
              key={`products-${effectiveProductColumns}`}
              contentContainerClassName={`${isMobile ? 'p-3 pb-44' : 'p-4 md:p-6 pb-24'}`}
              columnWrapperClassName={effectiveProductColumns > 1 ? (isMobile ? 'gap-3' : 'gap-6') : undefined}
              ItemSeparatorComponent={() => <View className={isMobile ? 'h-3' : 'h-4 md:h-6'} />}
              showsVerticalScrollIndicator={false}
              refreshing={productsLoading}
              onScrollToIndexFailed={(info) => {
                const offset = Math.max(0, info.averageItemLength * info.index);
                productListRef.current?.scrollToOffset({ offset, animated: true });
              }}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ['products'] });
              }}
              ListHeaderComponent={
                !showDesktopSidebars && featuredProduct && menuSearchQuery.trim().length === 0 ? (
                  <View className="mb-3">
                    <Pressable
                      onPress={() => handleProductPress(featuredProduct.id)}
                      className="overflow-hidden rounded-2xl border border-[#e1a255]/40 bg-white active:opacity-90"
                    >
                      {featuredProduct.image_url ? (
                        <Image
                          source={{ uri: featuredProduct.image_url }}
                          style={{ width: '100%', height: 168 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="h-[168px] items-center justify-center bg-[#f0daca]">
                          <FontAwesome name="cutlery" size={40} color="#9ca3af" />
                        </View>
                      )}
                      <View className="p-4">
                        <Text className="text-xs font-bold uppercase text-[#8d171e]">{i18n.featuredBadge}</Text>
                        <Text className="mt-1 text-xl font-extrabold text-gray-900">{i18n.featuredTitle}</Text>
                        <Text className="mt-1 text-xs text-gray-600">{i18n.featuredDescription}</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const isSpotlight = showContinueWithoutDrinks && highlightedDrinkId === item.id;
                const quantityInCart = items.reduce(
                  (sum, cartItem) => (cartItem.product.id === item.id ? sum + cartItem.quantity : sum),
                  0
                );

                return isMobile ? (
                  <DrinkSpotlightWrap
                    active={isSpotlight}
                    title={i18n.drinkPromptTitle}
                    closeLabel={language === 'en' ? 'Close' : 'Chiudi'}
                    onDismiss={dismissDrinkHint}
                  >
                    <Pressable
                      onPress={() => handleProductPress(item.id)}
                      className="overflow-hidden rounded-2xl border border-[#e1a255]/40 bg-white active:opacity-90"
                    >
                      <View className="flex-row items-stretch gap-0">
                        <View style={{ width: 104, minHeight: 104 }}>
                          {item.image_url ? (
                            <Image
                              source={{ uri: item.image_url }}
                              style={{ width: 104, height: '100%', minHeight: 104 }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="h-full min-h-[104px] items-center justify-center bg-[#f0daca]">
                              <FontAwesome name="cutlery" size={28} color="#9ca3af" />
                            </View>
                          )}
                        </View>
                        <View className="min-w-0 flex-1 flex-row items-start justify-between gap-2 p-3">
                          <View className="min-w-0 flex-1">
                            <Text className="text-[11px] font-bold uppercase text-gray-500">
                              {selectedCategoryName}
                            </Text>
                            <Text className="mt-0.5 text-base font-extrabold text-gray-900" numberOfLines={2}>
                              {item.name}
                            </Text>
                            <Text className="mt-1 text-xs text-gray-600" numberOfLines={2}>
                              {item.description || item.ingredients?.join(', ') || i18n.artisanalRecipe}
                            </Text>
                            <Text className="mt-2 text-lg font-extrabold text-[#8d171e]">
                              €{item.price.toFixed(2)}
                            </Text>
                          </View>
                          <View className="flex-row items-center rounded-full border border-[#e1a255]/60 bg-[#f9ecdd]">
                            <Pressable
                              onPress={(event) => {
                                event.stopPropagation();
                                handleQuickDecrement(item);
                              }}
                              disabled={quantityInCart <= 0}
                              className="h-10 w-10 items-center justify-center"
                            >
                              <FontAwesome
                                name="minus"
                                size={12}
                                color={quantityInCart > 0 ? '#8d171e' : '#c4a494'}
                              />
                            </Pressable>
                            <Text className="w-5 text-center text-sm font-extrabold text-[#8d171e]">
                              {quantityInCart}
                            </Text>
                            <Pressable
                              onPress={(event) => {
                                event.stopPropagation();
                                handleQuickAdd(item);
                              }}
                              className="h-10 w-10 items-center justify-center rounded-full bg-[#8d171e]"
                            >
                              <FontAwesome name="plus" size={12} color="#ffffff" />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  </DrinkSpotlightWrap>
                ) : (
                  <View className={`flex-1 ${effectiveProductColumns > 1 ? 'h-[450px]' : 'h-[380px]'} max-w-[500px]`}>
                    <DrinkSpotlightWrap
                      active={isSpotlight}
                      title={i18n.drinkPromptTitle}
                      closeLabel={language === 'en' ? 'Close' : 'Chiudi'}
                      onDismiss={dismissDrinkHint}
                    >
                      <ProductCard
                        product={item}
                        onPress={handleProductPress}
                        onAddToCart={handleProductPress}
                        quickAddAsNormalPizza={isStandardMenuPizza(
                          item,
                          categories.find((category) => category.id === item.category_id)?.name
                        )}
                        onEditPress={isAdmin ? () => handleEditPress(item) : undefined}
                      />
                    </DrinkSpotlightWrap>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Right Sidebar - Cart Summary (Desktop/Tablet only) */}
        {showDesktopSidebars && (
          <View className="w-[350px] border-l border-[#e1a255]/40 bg-white shadow-[-5px_0_15px_rgba(0,0,0,0.02)]">
            <CartSummary onCheckout={handleCheckout} isCheckingOut={createOrder.isPending} />
          </View>
        )}
      </View>

      {/* Mobile Cart Button (Fixed at bottom) */}
      {!showDesktopSidebars && totalItems > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-[#e1a255]/40"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={() => setIsCartVisible(true)}
            className="bg-[#8d171e] rounded-2xl p-4 shadow-xl flex-row items-center justify-between active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <FontAwesome name="shopping-cart" size={20} color="#ffffff" />
              <View>
                <Text className="text-white font-bold text-lg">
                  {i18n.yourOrder}
                </Text>
                <Text className="text-[#f3dabb] text-sm">
                  {totalItems} {i18n.itemsLabel}
                </Text>
              </View>
            </View>
            <Text className="text-white font-extrabold text-2xl">
              €{totalAmount.toFixed(2)}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Categories Modal (mobile/tablet when sidebar is hidden) */}
      <Modal
        transparent
        animationType="fade"
        visible={!showDesktopSidebars && isMobileCategoriesOpen}
        onRequestClose={() => setIsMobileCategoriesOpen(false)}
      >
        <View className="flex-1 bg-black/35 justify-start" style={{ paddingTop: insets.top + 60 }}>
          <Pressable className="absolute inset-0" onPress={() => setIsMobileCategoriesOpen(false)} />
          <View className="mx-3 rounded-2xl bg-white border border-[#e1a255]/40 p-3 max-h-[55%]">
            <Text className="text-gray-900 font-bold text-base mb-3">Categorie</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2 pb-1">
                <Pressable
                    className={`rounded-xl px-4 py-3 min-h-[44px] items-center justify-center ${selectedCategoryId === null ? 'bg-[#8d171e]' : 'bg-[#f9ecdd] border border-[#e1a255]/60'}`}
                  onPress={() => {
                    setSelectedCategoryId(null);
                    setIsMobileCategoriesOpen(false);
                  }}
                >
                  <Text className={`${selectedCategoryId === null ? 'text-white' : 'text-[#8d171e]'} font-semibold text-sm`}>
                    Tutti
                  </Text>
                </Pressable>
                {categories.map((category) => {
                  const isSelected = selectedCategoryId === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      className={`rounded-xl px-4 py-3 min-h-[44px] items-center justify-center ${isSelected ? 'bg-[#8d171e]' : 'bg-[#f9ecdd] border border-[#e1a255]/60'}`}
                      onPress={() => {
                        setSelectedCategoryId(category.id);
                        setIsMobileCategoriesOpen(false);
                      }}
                    >
                      <Text className={`${isSelected ? 'text-white' : 'text-[#8d171e]'} font-semibold text-sm`}>
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            {!isAuthenticated && (
              <Pressable
                className="mt-3 bg-[#8d171e] rounded-xl px-4 py-3 items-center active:opacity-80"
                onPress={() => {
                  setIsMobileCategoriesOpen(false);
                  router.push('/login');
                }}
              >
                <Text className="text-white font-bold">Accedi o Registrati</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!showDesktopSidebars && isCartVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCartVisible(false)}
      >
        <View className="flex-1 bg-[#f8f5f1]" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center justify-between p-4 border-b border-[#e1a255]/40 bg-white">
            <View className="flex-row items-center gap-2">
              <FontAwesome name="shopping-cart" size={17} color="#111827" />
              <Text className="text-gray-900 font-extrabold text-2xl">Carrello</Text>
            </View>
            <Pressable
              onPress={() => setIsCartVisible(false)}
              className="bg-[#f9ecdd] border border-[#e1a255]/60 rounded-full p-2 w-10 h-10 items-center justify-center active:opacity-80"
            >
              <FontAwesome name="close" size={20} color="black" />
            </Pressable>
          </View>
          <CartSummary onCheckout={() => {
            setIsCartVisible(false);
            handleCheckout();
          }} isCheckingOut={createOrder.isPending} />
        </View>
      </Modal>

      {/* Product Details Modal / Pizza Builder */}
      {selectedProduct && !isEditModalVisible && (
        selectedProduct.name === BUILDER_PRODUCT_NAME ? (
          <PizzaBuilderModal
            visible={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            product={selectedProduct}
          />
        ) : (
          <ProductDetailsModal
            visible={!!selectedProduct}
            onClose={() => {
              writeJsonStorage('ambrosia.menu.selectedProduct.v1', { productId: null }, 'session');
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            categoryName={categories.find((category) => category.id === selectedProduct.category_id)?.name}
          />
        )
      )}

      {/* Edit Modal */}
      {selectedProduct && isEditModalVisible && (
        <EditProductModal
          visible={isEditModalVisible}
          product={selectedProduct}
          onClose={() => {
            setIsEditModalVisible(false);
            setSelectedProduct(null);
          }}
        />
      )}

      {/* Create Modal */}
      <EditProductModal
        visible={isCreateModalVisible}
        product={null}
        onClose={() => setIsCreateModalVisible(false)}
      />
    </View>
  );
}
