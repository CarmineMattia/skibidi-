/**
 * useOfflineQueue Hook
 * Queue orders when offline and auto-sync when connection restored
 */

import { useCart, type CartItem } from '@/lib/stores/CartContext';
import type { PaymentMethod } from '@/types/fiscal.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  type ReactNode,
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  View,
} from 'react-native';

// Storage keys
const PENDING_ORDERS_KEY = 'skibidi_pending_orders';
const OFFLINE_INDICATOR_KEY = 'skibidi_offline_indicator';

// ============================================================================
// TYPES
// ============================================================================

export interface PendingOrder {
  id: string;
  items: CartItem[];
  notes?: string;
  orderType: 'eat_in' | 'take_away' | 'delivery';
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableNumber?: string;
  paymentMethod: PaymentMethod;
  createdAt: string; // ISO timestamp
  syncAttempts: number;
  lastSyncAttempt?: string;
  error?: string;
}

interface OfflineQueueContextType {
  // State
  pendingOrders: PendingOrder[];
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;

  // Actions
  addToQueue: (order: Omit<PendingOrder, 'id' | 'createdAt' | 'syncAttempts'>) => Promise<void>;
  removeFromQueue: (orderId: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  forceSync: () => Promise<void>;
  retryOrder: (orderId: string) => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const OfflineQueueContext = createContext<OfflineQueueContextType | null>(null);

export function useOfflineQueue(): OfflineQueueContextType {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface OfflineQueueProviderProps {
  children: ReactNode;
}

export function OfflineQueueProvider({ children }: OfflineQueueProviderProps) {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  // Load pending orders from storage on mount
  useEffect(() => {
    const loadPendingOrders = async () => {
      try {
        const stored = await AsyncStorage.getItem(PENDING_ORDERS_KEY);
        if (stored) {
          const orders: PendingOrder[] = JSON.parse(stored);
          setPendingOrders(orders);
          console.log(`[OfflineQueue] Loaded ${orders.length} pending orders`);
        }
      } catch (error) {
        console.error('[OfflineQueue] Failed to load pending orders:', error);
      }
    };

    loadPendingOrders();
  }, []);

  // Auto-sync when online and there are pending orders
  const syncPendingOrders = useCallback(async (): Promise<void> => {
    if (!isOnline || pendingOrders.length === 0 || isSyncing) {
      return;
    }

    setIsSyncing(true);
    console.log(`[OfflineQueue] Starting sync for ${pendingOrders.length} orders...`);

    const successfulIds: string[] = [];
    const failedIds: string[] = [];

    for (const order of pendingOrders) {
      try {
        const result = await processOrder(order);

        if (result.success) {
          successfulIds.push(order.id);
          // Navigate to success screen for this order
          router.replace(`/order-success?orderId=${result.orderId}&offline=true`);
        } else {
          failedIds.push(order.id);
        }
      } catch {
        failedIds.push(order.id);
      }
    }

    // Remove successful orders from queue
    if (successfulIds.length > 0) {
      const updatedOrders = pendingOrders.filter((o) => !successfulIds.includes(o.id));
      setPendingOrders(updatedOrders);
      await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedOrders));
      console.log(`[OfflineQueue] Synced ${successfulIds.length} orders successfully`);
    }

    // Update failed orders with attempt count
    if (failedIds.length > 0) {
      const updatedOrders = pendingOrders.map((o) => {
        if (failedIds.includes(o.id)) {
          return {
            ...o,
            syncAttempts: o.syncAttempts + 1,
            lastSyncAttempt: new Date().toISOString(),
          };
        }
        return o;
      });
      setPendingOrders(updatedOrders);
      await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedOrders));
    }

    setIsSyncing(false);
  }, [isOnline, pendingOrders, isSyncing, router]);

  // Monitor network status (web-friendly, no native dependency)
  useEffect(() => {
    const updateStatusAndMaybeSync = () => {
      const wasOffline = !isOnline;
      const nowOnline =
        typeof navigator !== 'undefined' ? navigator.onLine : true;

      setIsOnline(nowOnline);

      if (wasOffline && nowOnline) {
        console.log('[OfflineQueue] Connection restored, triggering sync...');
        void syncPendingOrders();
      }
    };

    updateStatusAndMaybeSync();

    if (typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => {
      console.log('[OfflineQueue] Online event, triggering sync...');
      updateStatusAndMaybeSync();
    };

    const handleOffline = () => {
      console.log('[OfflineQueue] Offline event detected');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, syncPendingOrders]);

  // Process a single order (mock implementation - replace with actual API call)
  const processOrder = async (
    order: PendingOrder
  ): Promise<{ success: boolean; orderId?: string }> => {
    // Simulate API call - replace with actual supabase call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate 90% success rate for demo
    const success = Math.random() > 0.1;

    if (success) {
      return { success: true, orderId: order.id };
    }

    return { success: false };
  };

  // Add order to queue
  const addToQueue = useCallback(
    async (order: Omit<PendingOrder, 'id' | 'createdAt' | 'syncAttempts'>): Promise<void> => {
      const newOrder: PendingOrder = {
        ...order,
        id: `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date().toISOString(),
        syncAttempts: 0,
      };

      const updatedOrders = [...pendingOrders, newOrder];
      setPendingOrders(updatedOrders);
      await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedOrders));
      console.log(`[OfflineQueue] Order ${newOrder.id} added to queue`);
    },
    [pendingOrders]
  );

  // Remove specific order from queue
  const removeFromQueue = useCallback(async (orderId: string): Promise<void> => {
    const updatedOrders = pendingOrders.filter((o) => o.id !== orderId);
    setPendingOrders(updatedOrders);
    await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedOrders));
    console.log(`[OfflineQueue] Order ${orderId} removed from queue`);
  }, [pendingOrders]);

  // Clear all orders from queue
  const clearQueue = useCallback(async (): Promise<void> => {
    setPendingOrders([]);
    await AsyncStorage.removeItem(PENDING_ORDERS_KEY);
    console.log('[OfflineQueue] Queue cleared');
  }, []);

  // Force sync all pending orders
  const forceSync = useCallback(async (): Promise<void> => {
    if (!isOnline) {
      Alert.alert(
        'Offline',
        'Non sei connesso a internet. Gli ordini verranno sincronizzati quando la connessione sarà ripristinata.'
      );
      return;
    }
    await syncPendingOrders();
  }, [isOnline, syncPendingOrders]);

  // Retry specific order
  const retryOrder = useCallback(
    async (orderId: string): Promise<void> => {
      const order = pendingOrders.find((o) => o.id === orderId);
      if (!order) return;

      setIsSyncing(true);
      try {
        const result = await processOrder(order);

        if (result.success) {
          const updatedOrders = pendingOrders.filter((o) => o.id !== orderId);
          setPendingOrders(updatedOrders);
          await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedOrders));
          router.replace(`/order-success?orderId=${orderId}&offline=true`);
        } else {
          // Update attempt count
          const updatedOrders = pendingOrders.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                syncAttempts: o.syncAttempts + 1,
                lastSyncAttempt: new Date().toISOString(),
                error: 'Tentativo di sincronizzazione fallito',
              };
            }
            return o;
          });
          setPendingOrders(updatedOrders);
          await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedOrders));
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [pendingOrders, router]
  );

  const value: OfflineQueueContextType = {
    pendingOrders,
    isOnline,
    isSyncing,
    pendingCount: pendingOrders.length,
    addToQueue,
    removeFromQueue,
    clearQueue,
    forceSync,
    retryOrder,
  };

  return createElement(
    OfflineQueueContext.Provider,
    { value },
    children,
  );
}

// ============================================================================
// OFFLINE INDICATOR COMPONENT
// ============================================================================

export function OfflineIndicator(): ReactNode {
  const { isOnline, pendingCount, isSyncing } = useOfflineQueue();

  if (isOnline) {
    return null;
  }

  return createElement(
    View,
    {
      className: `px-4 py-2 flex-row items-center justify-center gap-2 ${
        pendingCount > 0 ? 'bg-amber-500' : 'bg-red-500'
      }`,
    },
    createElement(
      Text,
      { className: 'text-white font-bold text-sm' },
      pendingCount > 0
        ? `Offline - ${pendingCount} ordini in coda`
        : 'Offline - Connessione assente',
    ),
    isSyncing
      ? createElement(ActivityIndicator, {
          size: 'small',
          color: '#FFFFFF',
        })
      : null,
  );
}