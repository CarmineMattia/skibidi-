/**
 * Menu Screen
 * Main POS interface with product grid and cart
 */

import { CartSummary } from '@/components/features/CartSummary';
import { CategoryFilter } from '@/components/features/CategoryFilter';
import { EditProductModal } from '@/components/features/EditProductModal';
import { ProductCard } from '@/components/features/ProductCard';
import { ProductDetailsModal } from '@/components/features/ProductDetailsModal';
import { useCategories } from '@/lib/hooks/useCategories';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { useProducts } from '@/lib/hooks/useProducts';
import { useAuth } from '@/lib/stores/AuthContext';
import { useCart } from '@/lib/stores/CartContext';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MenuScreen() {
  const { width } = useWindowDimensions();
  // Determine if we're on a tablet/desktop (show cart sidebar) or mobile (show cart modal)
  const isLargeScreen = width >= 768;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  // Default sidebar to hidden on mobile, visible on desktop
  const [isSidebarVisible, setIsSidebarVisible] = useState(isLargeScreen);
  const insets = useSafeAreaInsets();




  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: products = [], isLoading: productsLoading } = useProducts(
    selectedCategoryId || undefined
  );
  const { items, clearCart, totalItems, totalAmount } = useCart();
  const { isAuthenticated, profile, signOut, isKioskMode, userRole } = useAuth();
  const createOrder = useCreateOrder();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isAdmin = profile?.role === 'admin';

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

  const handleCreatePress = () => {
    setSelectedProduct(null);
    setIsCreateModalVisible(true);
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
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Errore', 'Impossibile effettuare il logout.');
    }
  };

  if (categoriesLoading || productsLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" className="text-primary" />
        <Text className="text-muted-foreground mt-4">Caricamento menu...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Top Bar - Minimal */}
      <View className="px-8 py-4 border-b border-border flex-row items-center justify-between bg-background z-10">
        <View className="flex-row items-center gap-3">
          {/* Hamburger Menu */}
          <Pressable
            onPress={() => setIsSidebarVisible(!isSidebarVisible)}
            className="bg-secondary rounded-lg p-2 w-10 h-10 items-center justify-center active:opacity-80 mr-2"
          >
            <FontAwesome name={isSidebarVisible ? "close" : "bars"} size={20} color="black" />
          </Pressable>

          <Text className="text-3xl">🍟</Text>
          <Text className="text-foreground font-extrabold text-2xl tracking-tight">
            SKIBIDI ORDERS
          </Text>
          {isAdmin && (
            <Pressable
              onPress={handleCreatePress}
              className="bg-primary px-4 py-3 rounded-full flex-row items-center gap-2 active:opacity-80"
            >
              <FontAwesome name="plus" size={16} color="white" />
              <Text className="text-primary-foreground font-bold text-base">Nuovo</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center gap-4">
          {/* User Info - Show user name or "Ospite" for guests */}
          <View className="bg-secondary rounded-full px-4 py-2">
            <Text className="text-secondary-foreground font-medium">
              {isAuthenticated && profile
                ? `👤 ${profile.full_name || profile.email}`
                : '👤 Ospite'}
            </Text>
          </View>

          {/* Order Counter Badge - Minimal */}
          {totalItems > 0 && (
            <View className="bg-primary rounded-full px-5 py-2 flex-row items-center gap-2">
              <Text className="text-primary-foreground font-bold text-lg">
                🛒 {totalItems}
              </Text>
            </View>
          )}

          {/* Logout Button - Only show for authenticated users */}
          {isAuthenticated && (
            <Pressable
              className="bg-destructive rounded-full px-5 py-2 flex-row items-center gap-2 active:opacity-80"
              onPress={handleLogout}
            >
              <Text className="text-destructive-foreground font-bold text-lg">
                🚪 Esci
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* DEBUG INFO - REMOVE LATER */}
      {isAuthenticated && (
        <View className="bg-yellow-200 p-2 items-center">
          <Text className="text-xs font-mono">
            Debug: Role={userRole} | Kiosk={isKioskMode ? 'YES' : 'NO'} | Auth={isAuthenticated ? 'YES' : 'NO'}
          </Text>
        </View>
      )}

      {/* Main Content Area - Split Layout */}
      <View className="flex-1 flex-row">
        {/* Left Sidebar - Categories (Toggleable) */}
        {isSidebarVisible && (
          <CategoryFilter
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        )}

        {/* Center - Product Grid */}
        <View className="flex-1 bg-secondary/10">

          {products.length === 0 ? (
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
              numColumns={isLargeScreen ? 3 : 1}
              key={isLargeScreen ? 'large' : 'small'}
              contentContainerClassName="p-4 md:p-6 pb-24"
              columnWrapperClassName={isLargeScreen ? "gap-6" : undefined}
              ItemSeparatorComponent={() => <View className="h-4 md:h-6" />}
              showsVerticalScrollIndicator={false}
              refreshing={productsLoading}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ['products'] });
              }}
              renderItem={({ item }) => (
                <View className={`flex-1 ${isLargeScreen ? 'h-[450px]' : 'h-[380px]'} max-w-[500px]`}>
                  <ProductCard
                    product={item}
                    onAddToCart={handleProductPress}
                    onEditPress={isAdmin ? () => handleEditPress(item) : undefined}
                  />
                </View>
              )}
            />
          )}
        </View>

        {/* Right Sidebar - Cart Summary (Desktop/Tablet only) */}
        {isLargeScreen && (
          <View className="w-[350px] border-l border-border bg-card shadow-[-5px_0_15px_rgba(0,0,0,0.02)]">
            <CartSummary onCheckout={handleCheckout} isCheckingOut={createOrder.isPending} />
          </View>
        )}
      </View>

      {/* Mobile Cart Button (Fixed at bottom) */}
      {!isLargeScreen && totalItems > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0 p-5 bg-background border-t border-border"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={() => setIsCartVisible(true)}
            className="bg-primary rounded-2xl p-5 shadow-xl flex-row items-center justify-between active:opacity-80"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-primary-foreground text-4xl">🛒</Text>
              <View>
                <Text className="text-primary-foreground font-bold text-xl">
                  Vedi Carrello
                </Text>
                <Text className="text-primary-foreground/80 text-base">
                  {totalItems} {totalItems === 1 ? 'prodotto' : 'prodotti'}
                </Text>
              </View>
            </View>
            <Text className="text-primary-foreground font-extrabold text-3xl">
              €{totalAmount.toFixed(2)}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Mobile Cart Modal */}
      <Modal
        visible={!isLargeScreen && isCartVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCartVisible(false)}
      >
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-foreground font-extrabold text-2xl">🛒 Carrello</Text>
            <Pressable
              onPress={() => setIsCartVisible(false)}
              className="bg-secondary rounded-full p-2 w-10 h-10 items-center justify-center active:opacity-80"
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
