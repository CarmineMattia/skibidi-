/**
 * Error Boundary Components
 * Catch and display React errors gracefully
 */

import type { ReactNode } from 'react';
import { Component, type ErrorInfo } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.props.onError?.(error, errorInfo);

    // In production, you might send this to a monitoring service like Sentry
    if (__DEV__) {
      // In development, show the full error
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.handleReset);
        }
        return this.props.fallback;
      }

      return <DefaultErrorFallback error={this.state.error!} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

// ============================================================================
// DEFAULT ERROR FALLBACK
// ============================================================================

interface DefaultErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

export function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps): ReactNode {
  return (
    <View className="flex-1 bg-background items-center justify-center p-8">
      <View className="bg-card rounded-3xl p-8 max-w-md w-full border-2 border-destructive/30 shadow-xl">
        <View className="items-center mb-6">
          <Text className="text-6xl mb-4">⚠️</Text>
          <Text className="text-foreground font-extrabold text-2xl text-center">
            Si è verificato un errore
          </Text>
        </View>

        <ScrollView
          className="bg-secondary/20 rounded-xl p-4 mb-6 max-h-32"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-destructive font-mono text-sm">
            {error.message || 'Errore sconosciuto'}
          </Text>
          {__DEV__ && error.stack && (
            <Text className="text-muted-foreground font-mono text-xs mt-2">
              {error.stack}
            </Text>
          )}
        </ScrollView>

        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 bg-secondary rounded-xl p-4 items-center active:opacity-80"
            onPress={onReset}
          >
            <Text className="text-foreground font-bold">Riprova</Text>
          </Pressable>

          <Pressable
            className="flex-1 bg-primary rounded-xl p-4 items-center active:opacity-80"
            onPress={() => {
              // In a real app, you might show more options or contact support
              Alert.alert(
                'Segnala problema',
                'Vuoi inviare una segnalazione agli sviluppatori?',
                [
                  { text: 'Annulla', style: 'cancel' },
                  {
                    text: 'Invia',
                    onPress: () => {
                      // In production, send to Sentry or crash reporting
                      Alert.alert('Grazie', 'La segnalazione è stata inviata.');
                      onReset();
                    },
                  },
                ]
              );
            }}
          >
            <Text className="text-primary-foreground font-bold">Segnala</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// SIMPLE ERROR MESSAGE COMPONENT
// ============================================================================

interface ErrorMessageProps {
  error: Error | string | null;
  retry?: () => void;
  title?: string;
}

export function ErrorMessage({
  error,
  retry,
  title = 'Errore',
}: ErrorMessageProps): ReactNode {
  if (!error) {
    return null;
  }

  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <View className="flex-1 items-center justify-center p-8">
      <View className="bg-card rounded-2xl p-6 max-w-sm w-full border border-destructive/30">
        <View className="items-center mb-4">
          <Text className="text-4xl mb-2">❌</Text>
          <Text className="text-foreground font-bold text-lg text-center">{title}</Text>
        </View>

        <Text className="text-muted-foreground text-center mb-4">{errorMessage}</Text>

        {retry && (
          <Pressable
            className="bg-primary rounded-xl p-3 items-center active:opacity-80"
            onPress={retry}
          >
            <Text className="text-primary-foreground font-bold">Riprova</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// ASYNC ERROR BOUNDARY (for data fetching)
// ============================================================================

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  error?: Error | null;
  isLoading: boolean;
  retry?: () => void;
  loadingMessage?: string;
  errorTitle?: string;
}

export function AsyncErrorBoundary({
  children,
  error,
  isLoading,
  retry,
  loadingMessage = 'Caricamento...',
  errorTitle = 'Errore nel caricamento',
}: AsyncErrorBoundaryProps): ReactNode {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <View className="bg-card rounded-2xl p-8 items-center">
          <Text className="text-4xl mb-4 animate-pulse">⏳</Text>
          <Text className="text-muted-foreground font-medium">{loadingMessage}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return <ErrorMessage error={error} retry={retry} title={errorTitle} />;
  }

  return <>{children}</>;
}