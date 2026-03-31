/**
 * Menu Screen
 * Main POS interface with product grid and cart
 */

import { CartSummary } from '@/components/features/CartSummary';
import { CategoryFilter } from '@/components/features/CategoryFilter';
import { EditProductModal } from '@/components/features/EditProductModal';
import { ProductCard } from '@/components/features/ProductCard';
import { ProductDetailsModal } from '@/components/features/ProductDetailsModal';
import { SkeletonProductCard, FullPageLoading } from '@/components/ui/Skeleton';
import { useCategories } from '@/lib/hooks/useCategories';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { OfflineIndicator } from '@/lib/hooks/useOfflineQueue';
import { useProducts } from '@/lib/hooks/useProducts';
import { useAuth } from '@/lib/stores/AuthContext';
import { useCart } from '@/lib/stores/CartContext';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: products = [], isLoading: productsLoading } = useProducts(
    selectedCategoryId || undefined
  );
  const { items, totalItems, totalAmount } = useCart();
  const { isAuthenticated, profile, signOut, isGuest, exitGuestMode, isAdmin } = useAuth();
  const showDesktopSidebars = isDesktop && isAdmin;
  const createOrder = useCreateOrder();
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedCategoryName = categories.find((category) => category.id === selectedCategoryId)?.name || 'Pizzas';
  const featuredProduct = products[0];

  useEffect(() => {
    if (!isMobile) {
      setIsMobileCategoriesOpen(false);
    }
  }, [isMobile]);

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
    <View className="flex-1 bg-[#fdf9f3]" style={{ paddingTop: insets.top }}>
      {/* Top Bar - Minimal */}
      <View
        className={`${isMobile ? (isUltraCompactMobile ? 'px-3 py-2' : 'px-3 py-2.5') : 'px-8 py-4'} border-b border-orange-100 flex-row items-center justify-between bg-white/95 z-10`}
      >
        <View className={`flex-row items-center ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
          {isMobile && (
            <Pressable
              onPress={() => setIsMobileCategoriesOpen(prev => !prev)}
              className={`bg-orange-50 border border-orange-200 rounded-lg items-center justify-center active:opacity-80 ${isUltraCompactMobile ? 'p-1.5 w-8 h-8' : 'p-2 w-9 h-9'}`}
            >
              <FontAwesome name={isMobileCategoriesOpen ? 'close' : 'bars'} size={isUltraCompactMobile ? 14 : 16} color="black" />
            </Pressable>
          )}
          {showDesktopSidebars && (
            <View className="w-9 h-9" />
          )}

          <Text className={isMobile ? (isUltraCompactMobile ? 'text-lg' : 'text-xl') : 'text-2xl'}>🍕</Text>
          <Text
            className={`text-gray-900 font-extrabold tracking-tight ${isMobile ? (isUltraCompactMobile ? 'text-sm' : 'text-base') : 'text-lg'}`}
            numberOfLines={1}
          >
            AMBROSIA - Artisanal Menu
          </Text>
        </View>

        <View className={`flex-row items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
          {/* User Info - Compact */}
          <View className={`bg-orange-50 border border-orange-200 rounded-full ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
            <Text className={`text-orange-700 font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {isAuthenticated && profile
                ? `👤 ${profile.full_name?.split(' ')[0] || profile.email.split('@')[0]}`
                : '👤 Guest'}
            </Text>
          </View>

          {/* Order Counter Badge - Compact */}
          {totalItems > 0 && (
            <View className={`bg-orange-500 rounded-full flex-row items-center ${isMobile ? 'px-3 py-1 gap-1' : 'px-4 py-1.5 gap-1.5'}`}>
              <Text className={`text-white font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>
                🛒 {totalItems}
              </Text>
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
        <View className="flex-1 bg-[#fdf9f3]">
          {/* Offline Indicator */}
          <OfflineIndicator />

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
          ) : products.length === 0 ? (
            <View className="flex-1 items-center justify-center p-8">
              <Text className="text-6xl mb-4 opacity-50">🍽️</Text>
              <Text className="text-muted-foreground text-xl font-medium">
                Nessun prodotto in questa categoria
              </Text>
            </View>
          ) : (
            <FlatList
              data={products}
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
                isMobile ? (
                  <View className="mb-3 gap-3">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
                      {['Pizzas', 'Pasta', 'Sides', 'Drinks', 'Desserts'].map((label) => (
                        <Pressable
                          key={label}
                          className={`px-3 py-1.5 rounded-full border ${
                            selectedCategoryName.toLowerCase().includes(label.toLowerCase().slice(0, 4))
                              ? 'bg-[#d4451a] border-[#d4451a]'
                              : 'bg-white border-orange-200'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${
                              selectedCategoryName.toLowerCase().includes(label.toLowerCase().slice(0, 4))
                                ? 'text-white'
                                : 'text-orange-700'
                            }`}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {featuredProduct && (
                      <Pressable
                        onPress={() => handleProductPress(featuredProduct.id)}
                        className="bg-white rounded-2xl border border-orange-100 p-4 active:opacity-90"
                      >
                        <Text className="text-xs font-bold text-orange-700 uppercase">Chef's Choice</Text>
                        <Text className="text-xl font-extrabold text-gray-900 mt-1">The Truffle Hearth</Text>
                        <Text className="text-xs text-gray-600 mt-1">
                          Wild mushrooms, black truffle oil, fresh fior di latte and aged parmesan.
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
                    className="bg-white rounded-2xl border border-orange-100 p-4 active:opacity-90"
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
                          {item.description || item.ingredients?.join(', ') || 'Artisanal recipe'}
                        </Text>
                        <Text className="text-lg font-extrabold text-[#d4451a] mt-2">
                          ${item.price.toFixed(0)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleProductPress(item.id)}
                        className="w-8 h-8 rounded-full bg-orange-500 items-center justify-center"
                      >
                        <Text className="text-white text-lg font-bold leading-none">+</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ) : (
                  <View className={`flex-1 ${effectiveProductColumns > 1 ? 'h-[450px]' : 'h-[380px]'} max-w-[500px]`}>
                    <ProductCard
                      product={item}
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
          <View className="w-[350px] border-l border-orange-100 bg-white shadow-[-5px_0_15px_rgba(0,0,0,0.02)]">
            <CartSummary onCheckout={handleCheckout} isCheckingOut={createOrder.isPending} />
          </View>
        )}
      </View>

      {/* Mobile Cart Button (Fixed at bottom) */}
      {!showDesktopSidebars && totalItems > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-orange-100"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={() => setIsCartVisible(true)}
            className="bg-orange-500 rounded-2xl p-4 shadow-xl flex-row items-center justify-between active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-white text-3xl">🛒</Text>
              <View>
                <Text className="text-white font-bold text-lg">
                  Your Order
                </Text>
                <Text className="text-orange-100 text-sm">
                  {totalItems} items
                </Text>
              </View>
            </View>
            <Text className="text-white font-extrabold text-2xl">
              ${totalAmount.toFixed(2)}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Mobile Cart Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={!showDesktopSidebars && isMobile && isMobileCategoriesOpen}
        onRequestClose={() => setIsMobileCategoriesOpen(false)}
      >
        <View className="flex-1 bg-black/35 justify-start" style={{ paddingTop: insets.top + 60 }}>
          <Pressable className="absolute inset-0" onPress={() => setIsMobileCategoriesOpen(false)} />
          <View className="mx-3 rounded-2xl bg-white border border-orange-100 p-3 max-h-[55%]">
            <Text className="text-gray-900 font-bold text-base mb-3">Categorie</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2 pb-1">
                <Pressable
                    className={`rounded-xl px-4 py-3 min-h-[44px] items-center justify-center ${selectedCategoryId === null ? 'bg-orange-500' : 'bg-orange-50 border border-orange-200'}`}
                  onPress={() => {
                    setSelectedCategoryId(null);
                    setIsMobileCategoriesOpen(false);
                  }}
                >
                  <Text className={`${selectedCategoryId === null ? 'text-white' : 'text-orange-700'} font-semibold text-sm`}>
                    Tutti
                  </Text>
                </Pressable>
                {categories.map((category) => {
                  const isSelected = selectedCategoryId === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      className={`rounded-xl px-4 py-3 min-h-[44px] items-center justify-center ${isSelected ? 'bg-orange-500' : 'bg-orange-50 border border-orange-200'}`}
                      onPress={() => {
                        setSelectedCategoryId(category.id);
                        setIsMobileCategoriesOpen(false);
                      }}
                    >
                      <Text className={`${isSelected ? 'text-white' : 'text-orange-700'} font-semibold text-sm`}>
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
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
          <View className="flex-row items-center justify-between p-4 border-b border-orange-100 bg-white">
            <Text className="text-gray-900 font-extrabold text-2xl">🛒 Carrello</Text>
            <Pressable
              onPress={() => setIsCartVisible(false)}
              className="bg-orange-50 border border-orange-200 rounded-full p-2 w-10 h-10 items-center justify-center active:opacity-80"
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

      {/* Product Details Modal */}
      {selectedProduct && !isEditModalVisible && (
        <ProductDetailsModal
          visible={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
        />
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
