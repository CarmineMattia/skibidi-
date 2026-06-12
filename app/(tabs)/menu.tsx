/**
 * Menu Screen
 * Main POS interface with product grid and cart
 */

import { CartSummary } from '@/components/features/CartSummary';
import { CategoryFilter } from '@/components/features/CategoryFilter';
import { EditProductModal } from '@/components/features/EditProductModal';
import { PizzaBuilderModal } from '@/components/features/PizzaBuilderModal';
import { ProductCard } from '@/components/features/ProductCard';
import { ProductDetailsModal } from '@/components/features/ProductDetailsModal';
import { SkeletonProductCard, FullPageLoading } from '@/components/ui/Skeleton';
import { BUILDER_PRODUCT_NAME } from '@/lib/data/pizzaBuilder';
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
import { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [isMobileCategoriesOpen, setIsMobileCategoriesOpen] = useState(false);
  const [showContinueWithoutDrinks, setShowContinueWithoutDrinks] = useState(false);
  const insets = useSafeAreaInsets();

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: products = [], isLoading: productsLoading } = useProducts(
    selectedCategoryId || undefined
  );
  const { items, totalItems, totalAmount } = useCart();
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
    // Default menu mode: show only food, unless user explicitly selects a drinks category.
    if (selectedCategoryId === null) {
      return products.filter((product) => !drinkCategoryIds.has(product.category_id));
    }
    return products;
  }, [products, selectedCategoryId, drinkCategoryIds]);
  const featuredProduct = displayProducts[0];
  const i18n = useMemo(
    () =>
      language === 'en'
        ? {
            appTitle: 'AMBROSIA - Artisanal Menu',
            guest: 'Guest',
            featuredBadge: "Chef's Choice",
            featuredTitle: 'The Truffle Hearth',
            featuredDescription: 'Wild mushrooms, black truffle oil, fresh fior di latte and aged parmesan.',
            artisanalRecipe: 'Artisanal recipe',
            yourOrder: 'Your Order',
            itemsLabel: 'items',
          }
        : {
            appTitle: 'AMBROSIA - Menu Artigianale',
            guest: 'Ospite',
            featuredBadge: 'Scelta dello chef',
            featuredTitle: 'La Fiamma al Tartufo',
            featuredDescription: 'Funghi di bosco, olio al tartufo nero, fior di latte fresco e parmigiano stagionato.',
            artisanalRecipe: 'Ricetta artigianale',
            yourOrder: 'Il tuo ordine',
            itemsLabel: 'articoli',
          },
    [language]
  );

  useEffect(() => {
    if (!isMobile) {
      setIsMobileCategoriesOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const cartHasDrinks = items.some((item) => drinkCategoryIds.has(item.product.category_id));
    if (cartHasDrinks) {
      setShowContinueWithoutDrinks(false);
    }
  }, [items, drinkCategoryIds]);

  const handleProductPress = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
    }
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
    return <FullPageLoading message="Caricamento categorie..." />;
  }

  return (
    <View className="flex-1 bg-[#f9ecdd]" style={{ paddingTop: insets.top }}>
      {/* Top Bar - Minimal */}
      <View
        className={`${isMobile ? (isUltraCompactMobile ? 'px-3 py-2' : 'px-3 py-2.5') : 'px-8 py-4'} border-b border-[#e1a255]/40 flex-row items-center justify-between bg-white/95 z-10`}
      >
        <View className={`flex-row items-center ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
          {!showDesktopSidebars && (
            <Pressable
              onPress={() => setIsMobileCategoriesOpen(prev => !prev)}
              className={`bg-[#f9ecdd] border border-[#e1a255]/60 rounded-lg items-center justify-center active:opacity-80 ${isUltraCompactMobile ? 'p-1.5 w-8 h-8' : 'p-2 w-9 h-9'}`}
            >
              <FontAwesome name={isMobileCategoriesOpen ? 'close' : 'bars'} size={isUltraCompactMobile ? 14 : 16} color="black" />
            </Pressable>
          )}
          {showDesktopSidebars && (
            <View className="w-9 h-9" />
          )}

          <View className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-[#f9ecdd] border border-[#e1a255]/60 items-center justify-center`}>
            <FontAwesome name="cutlery" size={isMobile ? 14 : 16} color="#8d171e" />
          </View>
          <Text
            className={`text-gray-900 font-extrabold tracking-tight ${isMobile ? (isUltraCompactMobile ? 'text-sm' : 'text-base') : 'text-lg'}`}
            numberOfLines={1}
          >
            {i18n.appTitle}
          </Text>
        </View>

        <View className={`flex-row items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
          {/* User Info - Compact */}
          <View className={`bg-[#f9ecdd] border border-[#e1a255]/60 rounded-full ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
            <View className="flex-row items-center gap-1.5">
              <FontAwesome name="user" size={isMobile ? 10 : 11} color="#8d171e" />
              <Text className={`text-[#8d171e] font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {isAuthenticated && profile
                  ? `${profile.full_name?.split(' ')[0] || profile.email?.split('@')[0] || 'utente'}`
                  : i18n.guest}
              </Text>
            </View>
          </View>

          {/* Order Counter Badge - Compact */}
          {totalItems > 0 && (
            <View className={`bg-[#8d171e] rounded-full flex-row items-center ${isMobile ? 'px-3 py-1 gap-1' : 'px-4 py-1.5 gap-1.5'}`}>
              <FontAwesome name="shopping-cart" size={isMobile ? 10 : 11} color="#ffffff" />
              <Text className={`text-white font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>{totalItems}</Text>
            </View>
          )}

          {/* Logout Button - Compact */}
          {(isAuthenticated || isGuest) && (
            <Pressable
              className={`${isMobile ? 'p-1.5' : 'p-2'} bg-destructive/10 rounded-full active:opacity-80`}
              onPress={handleLogout}
            >
              <FontAwesome name="sign-out" size={isMobile ? 14 : 18} color="#ef4444" />
            </Pressable>
          )}

          {!isAuthenticated && (
            <Pressable
              className={`${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} bg-[#8d171e] rounded-full active:opacity-80`}
              onPress={() => router.push('/login')}
            >
              <Text className={`text-white font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>Accedi</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Content Area - Split Layout */}
      <View className="flex-1 flex-row">
        {/* Left Sidebar - Categories (Toggleable) */}
        {showDesktopSidebars && (
          <CategoryFilter
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        )}

        {/* Center - Product Grid */}
        <View className="flex-1 bg-[#f9ecdd]">
          {/* Offline Indicator */}
          <OfflineIndicator />

          {showContinueWithoutDrinks && selectedCategoryId && drinkCategoryIds.has(selectedCategoryId) && (
            <View className="mx-3 mt-3 bg-white border border-[#e1a255]/60 rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-start gap-2">
                <FontAwesome name="glass" size={16} color="#8d171e" style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-base font-extrabold text-gray-900">Aggiungi una bevanda?</Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    Se hai gia finito, puoi completare subito l&apos;ordine.
                  </Text>
                </View>
              </View>

              <Pressable
                className="mt-3 h-11 bg-[#8d171e] rounded-xl items-center justify-center active:opacity-90"
                onPress={() => {
                  setShowContinueWithoutDrinks(false);
                  router.push('/modal');
                }}
              >
                <Text className="text-white font-bold text-sm">Completa ordine senza bevande</Text>
              </Pressable>
            </View>
          )}
 
          {showContinueWithoutDrinks && selectedCategoryId && !drinkCategoryIds.has(selectedCategoryId) && (
            <View className="mx-3 mt-2">
              <Pressable
                className="h-10 rounded-xl border border-[#e1a255]/60 bg-white items-center justify-center active:opacity-90"
                onPress={() => {
                  setShowContinueWithoutDrinks(false);
                  router.push('/modal');
                }}
              >
                <Text className="text-[#8d171e] font-semibold text-sm">Completa ordine senza bevande</Text>
              </Pressable>
            </View>
          )}

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
                Nessun prodotto in questa categoria
              </Text>
            </View>
          ) : (
            <FlatList
              data={displayProducts}
              keyExtractor={(item) => item.id}
              numColumns={effectiveProductColumns}
              key={`products-${effectiveProductColumns}`}
              contentContainerClassName={`${isMobile ? 'p-3 pb-44' : 'p-4 md:p-6 pb-24'}`}
              columnWrapperClassName={effectiveProductColumns > 1 ? (isMobile ? 'gap-3' : 'gap-6') : undefined}
              ItemSeparatorComponent={() => <View className={isMobile ? 'h-3' : 'h-4 md:h-6'} />}
              showsVerticalScrollIndicator={false}
              refreshing={productsLoading}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ['products'] });
              }}
              ListHeaderComponent={
                !showDesktopSidebars ? (
                  <View className="mb-3 gap-3">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
                      <Pressable
                        key="food-only"
                        onPress={() => setSelectedCategoryId(null)}
                        className={`px-3 py-1.5 rounded-full border ${
                          selectedCategoryId === null
                            ? 'bg-[#8d171e] border-[#8d171e]'
                            : 'bg-white border-[#e1a255]/60'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            selectedCategoryId === null ? 'text-white' : 'text-[#8d171e]'
                          }`}
                        >
                          Solo mangiare
                        </Text>
                      </Pressable>

                      {categories.map((category) => (
                        <Pressable
                          key={category.id}
                          onPress={() => setSelectedCategoryId(category.id)}
                          className={`px-3 py-1.5 rounded-full border ${
                            selectedCategoryId === category.id
                              ? 'bg-[#8d171e] border-[#8d171e]'
                              : 'bg-white border-[#e1a255]/60'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${
                              selectedCategoryId === category.id
                                ? 'text-white'
                                : 'text-[#8d171e]'
                            }`}
                          >
                            {category.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {featuredProduct && (
                      <Pressable
                        onPress={() => handleProductPress(featuredProduct.id)}
                        className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 active:opacity-90"
                      >
                        <Text className="text-xs font-bold text-[#8d171e] uppercase">{i18n.featuredBadge}</Text>
                        <Text className="text-xl font-extrabold text-gray-900 mt-1">{i18n.featuredTitle}</Text>
                        <Text className="text-xs text-gray-600 mt-1">
                          {i18n.featuredDescription}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                isMobile ? (
                  <Pressable
                    onPress={() => handleProductPress(item.id)}
                    className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 active:opacity-90"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-[11px] font-bold text-gray-500 uppercase">
                          {selectedCategoryName}
                        </Text>
                        <Text className="text-lg font-extrabold text-gray-900 mt-0.5" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-xs text-gray-600 mt-1" numberOfLines={2}>
                          {item.description || item.ingredients?.join(', ') || i18n.artisanalRecipe}
                        </Text>
                        <Text className="text-lg font-extrabold text-[#8d171e] mt-2">
                          €{item.price.toFixed(2)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleProductPress(item.id)}
                        className="w-8 h-8 rounded-full bg-[#8d171e] items-center justify-center"
                      >
                        <Text className="text-white text-lg font-bold leading-none">+</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ) : (
                  <View className={`flex-1 ${effectiveProductColumns > 1 ? 'h-[450px]' : 'h-[380px]'} max-w-[500px]`}>
                    <ProductCard
                      product={item}
                      onPress={handleProductPress}
                      onAddToCart={handleProductPress}
                      onEditPress={isAdmin ? () => handleEditPress(item) : undefined}
                    />
                  </View>
                )
              )}
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
            onClose={() => setSelectedProduct(null)}
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
