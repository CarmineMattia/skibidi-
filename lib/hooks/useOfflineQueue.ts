/**
 * useOfflineQueue Hook
 * Queue orders when offline and auto-sync when connection restored
 */

import type { CartItem } from '@/lib/stores/CartContext';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { useTenant } from '@/lib/stores/TenantContext';
import type { PaymentMethod } from '@/types/fiscal.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  type ReactNode,
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
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
  companyId?: string;
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
  const ordersRef = useRef<PendingOrder[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const syncingRef = useRef(false);
  const wasOnlineRef = useRef(false);
  const initialSyncRef = useRef(false);
  const storageWriteRef = useRef<Promise<void>>(Promise.resolve());
  const router = useRouter();
  const { companyId } = useTenant();
  const { mutateAsync: createOrder } = useCreateOrder();

  const saveOrders = useCallback(async (orders: PendingOrder[]) => {
    // Preserve additions made during an in-flight sync; serialize storage writes.
    ordersRef.current = orders;
    setPendingOrders(orders);
    const write = storageWriteRef.current.catch(() => undefined).then(() =>
      AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(orders))
    );
    storageWriteRef.current = write;
    await write;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(PENDING_ORDERS_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(parsed)) throw new Error('Coda ordini non valida');
        const orders = parsed.map((order: PendingOrder) => ({
          ...order,
          // Migrate old demo ids once, persist before making any request.
          id: /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(order.id) ? order.id : crypto.randomUUID(),
          companyId: order.companyId ?? (order.items?.every(item => item.product.company_id === order.items[0]?.product.company_id)
            ? order.items[0]?.product.company_id : undefined),
        }));
        if (!cancelled) await saveOrders(orders);
      } catch (error) {
        console.error('[OfflineQueue] Failed to load orders:', error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [saveOrders]);

  const syncOrders = useCallback(async (onlyOrderId?: string) => {
    if (!isOnline || !hydrated || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const candidates = ordersRef.current.filter(order => !onlyOrderId || order.id === onlyOrderId);
      for (const order of candidates) {
        // It may have been removed by the user during a previous request.
        if (!ordersRef.current.some(current => current.id === order.id)) continue;
        try {
          if (!companyId || order.companyId !== companyId) {
            throw new Error('Questo ordine appartiene a un altro ristorante o non ha un ristorante identificato.');
          }
          const result = await createOrder({ ...order, orderId: order.id, skipFiscal: true });
          // Only remove after a real atomic server acknowledgement. A lost
          // response is retried with the same UUID, which cannot duplicate it.
          await saveOrders(ordersRef.current.filter(current => current.id !== order.id));
          router.replace(`/order-tracking?orderId=${encodeURIComponent(result.orderId)}&orderType=${encodeURIComponent(order.orderType)}`);
        } catch (error) {
          await saveOrders(ordersRef.current.map(current => current.id === order.id ? {
            ...current,
            syncAttempts: current.syncAttempts + 1,
            lastSyncAttempt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Invio non riuscito. Ordine conservato sul dispositivo.',
          } : current));
        }
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [companyId, createOrder, hydrated, isOnline, router, saveOrders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const reconnected = isOnline && !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!hydrated || !companyId || !isOnline) return;
    if (reconnected || !initialSyncRef.current) {
      initialSyncRef.current = true;
      void syncOrders();
    }
  }, [companyId, hydrated, isOnline, syncOrders]);

  const addToQueue = useCallback(async (order: Omit<PendingOrder, 'id' | 'createdAt' | 'syncAttempts'>) => {
    if (!hydrated || !companyId) throw new Error('Attendi il caricamento del ristorante e riprova.');
    await saveOrders([...ordersRef.current, { ...order, companyId, id: crypto.randomUUID(), createdAt: new Date().toISOString(), syncAttempts: 0 }]);
  }, [companyId, hydrated, saveOrders]);
  const removeFromQueue = useCallback(async (id: string) => {
    await saveOrders(ordersRef.current.filter(order => order.id !== id));
  }, [saveOrders]);
  const clearQueue = useCallback(async () => { await saveOrders([]); }, [saveOrders]);
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'L’ordine è salvato solo su questo dispositivo e non è ancora arrivato alla pizzeria.');
      return;
    }
    await syncOrders();
  }, [isOnline, syncOrders]);
  const retryOrder = useCallback(async (id: string) => { await syncOrders(id); }, [syncOrders]);

  return createElement(OfflineQueueContext.Provider, {
    value: { pendingOrders, isOnline, isSyncing, pendingCount: pendingOrders.length, addToQueue, removeFromQueue, clearQueue, forceSync, retryOrder },
  }, children);
}

// ============================================================================
// OFFLINE INDICATOR COMPONENT
// ============================================================================

export function OfflineIndicator(): ReactNode {
  const { isOnline, pendingCount, isSyncing, forceSync, pendingOrders } = useOfflineQueue();

  if (isOnline && pendingCount === 0) return null;

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
        ? `${isOnline ? 'Invio in sospeso' : 'Offline'} - ${pendingCount} ordini non ancora inviati alla pizzeria${pendingOrders.some(order => order.error) ? '. Invio non riuscito.' : ''}`
        : 'Offline - Connessione assente',
    ),
    isOnline && pendingCount > 0 && !isSyncing
      ? createElement(Pressable, { onPress: () => void forceSync(), accessibilityRole: 'button', className: 'px-3 py-2 bg-white rounded-lg' }, createElement(Text, { className: 'font-bold text-amber-900' }, 'Riprova invio'))
      : null,
    isSyncing
      ? createElement(ActivityIndicator, {
          size: 'small',
          color: '#FFFFFF',
        })
      : null,
  );
}