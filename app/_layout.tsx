import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
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
import { OfflineQueueProvider, OfflineIndicator } from '@/lib/hooks/useOfflineQueue';
import { OrderNotificationProvider } from '@/lib/stores/OrderNotificationContext';

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
        <AppSettingsProvider>
          <FiscalProvider>
            <OfflineQueueProvider>
              <AuthProvider>
                <OrderNotificationProvider>
                  <CartProvider>
                    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                      <AuthGuard>
                        <Stack>
                          <Stack.Screen name="login" options={{ headerShown: false }} />
                          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                          <Stack.Screen name="admin-options" options={{ headerShown: false }} />
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
      </TenantProvider>
    </QueryProvider>
  );
}

/**
 * Authentication Guard
 * - Il menu resta navigabile senza login.
 * - Checkout/ordine richiedono un utente loggato (Google): altrimenti /login.
 * - Gli utenti già autenticati non restano sulla pagina di login.
 */
const ORDER_ROUTES = new Set(['modal', 'one-screen-checkout']);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Wait for auth to initialize

    const first = segments[0] as string | undefined;
    if (isAuthenticated && first === 'login') {
      router.replace('/(tabs)/menu');
    } else if (!isAuthenticated && first && ORDER_ROUTES.has(first)) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <>{children}</>;
}
