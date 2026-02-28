import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { QueryProvider } from '@/lib/api/QueryProvider';
import { CartProvider } from '@/lib/stores/CartContext';
import { AuthProvider, useAuth } from '@/lib/stores/AuthContext';
import { FiscalProvider } from '@/lib/stores/FiscalContext';
import { OfflineQueueProvider, OfflineIndicator } from '@/lib/hooks/useOfflineQueue';

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

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryProvider>
      <FiscalProvider>
        <OfflineQueueProvider>
          <AuthProvider>
            <CartProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <AuthGuard>
                  <Stack>
                    <Stack.Screen name="login" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                  </Stack>
                </AuthGuard>
              </ThemeProvider>
            </CartProvider>
          </AuthProvider>
        </OfflineQueueProvider>
      </FiscalProvider>
    </QueryProvider>
  );
}

/**
 * Authentication Guard
 * Allows guest/anonymous users to browse as "ospite" (kiosk mode)
 * Only redirects authenticated users away from login page
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Wait for auth to initialize

    const inAuthGroup = segments[0] === 'login';

    // Only redirect if user is authenticated AND trying to access login
    // This prevents logged-in users from seeing login page
    // But allows guests/anonymous users everywhere
    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/menu');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <>{children}</>;
}
