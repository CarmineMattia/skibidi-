/**
 * ProtectedRoute Component
 * Protegge route che richiedono autenticazione admin
 */

import { ReactNode } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/stores/AuthContext';
import { Button } from '@/components/ui/Button';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isLoading, userRole, isKioskMode } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" className="text-primary" />
        <Text className="text-muted-foreground mt-4">Verifica autenticazione...</Text>
      </View>
    );
  }

  // If admin is required and user is not admin
  if (requireAdmin && (isKioskMode || userRole !== 'admin')) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-8">
        <Text className="text-6xl mb-4">🔒</Text>
        <Text className="text-foreground font-bold text-2xl mb-2 text-center">
          Accesso Riservato
        </Text>
        <Text className="text-muted-foreground text-center mb-8">
          Questa sezione è riservata agli amministratori.
        </Text>
        <Button
          title="Vai al Login"
          variant="default"
          onPress={() => router.push('/login')}
        />
      </View>
    );
  }

  return <>{children}</>;
}
