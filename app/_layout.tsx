import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { QueryProvider } from '@/lib/api/QueryProvider';
import { CartProvider } from '@/lib/stores/CartContext';
import { AppSettingsProvider } from '@/lib/stores/AppSettingsContext';
import { AuthProvider, useAuth } from '@/lib/stores/AuthContext';
import { FiscalProvider } from '@/lib/stores/FiscalContext';
import { TenantProvider } from '@/lib/stores/TenantContext';
import { MenuPricingProvider } from '@/lib/stores/MenuPricingContext';
import { OfflineQueueProvider, OfflineIndicator } from '@/lib/hooks/useOfflineQueue';
import { OrderNotificationProvider } from '@/lib/stores/OrderNotificationContext';
import {
  authRouteKey,
  clearAuthReturn,
  readAuthReturn,
  resolveAuthRedirect,
  writeAuthReturn,
} from '@/lib/utils/authReturn';

// Import global CSS for NativeWind
import '../global.css';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';
export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Native: hold rendering behind the splash screen until fonts are ready.
  // Web: paint immediately — the UI uses the system font stack, so blocking
  // the statically-rendered page on the icon font download would blank the
  // first viewport for no visual benefit (icons swap in when ready).
  if (!loaded && Platform.OS !== 'web') {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryProvider>
      <TenantProvider>
        <MenuPricingProvider>
        <AppSettingsProvider>
          <FiscalProvider>
            <OfflineQueueProvider>
              <AuthProvider>
                <OrderNotificationProvider>
                  <CartProvider>
                    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                      <AuthGuard>
                        <Stack
                          screenOptions={{
                            // L'header calcola maxWidth del titolo dalla larghezza della finestra,
                            // che nell'HTML statico è 0: valore fisso per evitare React #418.
                            // Su web lo stack usa l'header JS, che accetta questa opzione (non tipizzata in native-stack).
                            ...({ headerTitleContainerStyle: { maxWidth: '100%' } } as object),
                          }}
                        >
                          <Stack.Screen name="login" options={{ headerShown: false }} />
                          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                          <Stack.Screen name="admin-options" options={{ headerShown: false }} />
                          <Stack.Screen name="commission-summary" options={{ headerShown: false, title: 'Resoconto commissioni' }} />
                          <Stack.Screen
                            name="modal"
                            options={{
                              headerShown: true,
                              title: 'Checkout',
                              presentation: 'card',
                              animation: 'slide_from_right',
                            }}
                          />
                          <Stack.Screen
                            name="one-screen-checkout"
                            options={{
                              headerShown: true,
                              title: 'Checkout',
                              presentation: 'card',
                            }}
                          />
                          <Stack.Screen name="order-success" options={{ headerShown: false }} />
                          <Stack.Screen name="rewards" options={{ headerShown: false }} />
                          <Stack.Screen name="offers" options={{ headerShown: false }} />
                        </Stack>
                      </AuthGuard>
                    </ThemeProvider>
                  </CartProvider>
                </OrderNotificationProvider>
              </AuthProvider>
            </OfflineQueueProvider>
          </FiscalProvider>
        </AppSettingsProvider>
        </MenuPricingProvider>
      </TenantProvider>
    </QueryProvider>
  );
}

/**
 * Authentication Guard
 * - Il menu resta navigabile senza login.
 * - Checkout e tracking richiedono un utente loggato (Google): altrimenti /login.
 * - Il link nell'email di conferma apre /order-tracking; se la sessione non c'è,
 *   dopo il login Google si torna su quella pagina (il redirect OAuth resta /login).
 * - Gli utenti già autenticati non restano sulla pagina di login.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ orderId?: string; orderType?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const route = authRouteKey(segments);
    const webLocation = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : null;
    const nativeLocation = route === 'order-tracking'
      ? `/order-tracking?${new URLSearchParams({
          ...(typeof params.orderId === 'string' ? { orderId: params.orderId } : {}),
          ...(typeof params.orderType === 'string' ? { orderType: params.orderType } : {}),
        }).toString()}`
      : null;
    const decision = resolveAuthRedirect({
      isLoading,
      isAuthenticated,
      route,
      location: webLocation ?? nativeLocation,
      storedReturn: readAuthReturn(),
    });
    if (decision.action === 'none') {
      if (decision.remember) writeAuthReturn(decision.remember);
      return;
    }
    if (decision.action === 'login') {
      if (decision.remember) writeAuthReturn(decision.remember);
      router.replace('/login');
      return;
    }
    if (decision.clearStored) clearAuthReturn();
    router.replace(decision.href as '/login');
  }, [isAuthenticated, isLoading, params.orderId, params.orderType, segments, router]);

  return <>{children}</>;
}
