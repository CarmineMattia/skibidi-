/**
 * Empty State Components
 * Provide helpful empty state UIs for lists and collections
 */

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  testID?: string;
}

// ============================================================================
// BASE EMPTY STATE
// ============================================================================

export function EmptyState({
  icon = '📦',
  title,
  description,
  action,
  testID,
}: EmptyStateProps): ReactNode {
  return (
    <View
      className="flex-1 items-center justify-center p-8"
      testID={testID}
    >
      <View className="bg-secondary/30 rounded-3xl p-12 items-center max-w-sm w-full border-2 border-secondary/50">
        <Text className="text-7xl mb-4">{icon}</Text>
        <Text className="text-foreground font-extrabold text-xl text-center mb-2">
          {title}
        </Text>
        {description && (
          <Text className="text-muted-foreground text-center text-base mb-6">
            {description}
          </Text>
        )}
        {action && (
          <Pressable
            className="bg-primary rounded-xl px-6 py-3 active:opacity-80"
            onPress={action.onPress}
            testID={`${testID}-action`}
          >
            <Text className="text-primary-foreground font-bold">{action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// COMMON EMPTY STATES
// ============================================================================

interface EmptyCartProps {
  onBrowseMenu?: () => void;
}

export function EmptyCart({ onBrowseMenu }: EmptyCartProps): ReactNode {
  return (
    <EmptyState
      icon="🛒"
      title="Il carrello è vuoto"
      description="Aggiungi prodotti dal menu per iniziare"
      action={
        onBrowseMenu
          ? { label: 'Sfoglia Menu', onPress: onBrowseMenu }
          : undefined
      }
      testID="empty-cart"
    />
  );
}

interface EmptyOrdersProps {
  onBrowseMenu?: () => void;
}

export function EmptyOrders({ onBrowseMenu }: EmptyOrdersProps): ReactNode {
  return (
    <EmptyState
      icon="📋"
      title="Nessun ordine ancora"
      description="I tuoi ordini appariranno qui una volta effettuati"
      action={
        onBrowseMenu
          ? { label: 'Ordina Ora', onPress: onBrowseMenu }
          : undefined
      }
      testID="empty-orders"
    />
  );
}

interface EmptyProductsProps {
  onAddProduct?: () => void;
  isAdmin?: boolean;
}

export function EmptyProducts({ onAddProduct, isAdmin }: EmptyProductsProps): ReactNode {
  return (
    <EmptyState
      icon="🍽️"
      title="Nessun prodotto disponibile"
      description={
        isAdmin
          ? 'Aggiungi il primo prodotto al tuo menu'
          : 'I prodotti saranno presto disponibili'
      }
      action={
        isAdmin && onAddProduct
          ? { label: 'Aggiungi Prodotto', onPress: onAddProduct }
          : undefined
      }
      testID="empty-products"
    />
  );
}

interface EmptyCategoriesProps {
  onAddCategory?: () => void;
  isAdmin?: boolean;
}

export function EmptyCategories({ onAddCategory, isAdmin }: EmptyCategoriesProps): ReactNode {
  return (
    <EmptyState
      icon="🏷️"
      title="Nessuna categoria"
      description={
        isAdmin
          ? 'Crea la prima categoria per organizzare i tuoi prodotti'
          : 'Le categorie saranno presto disponibili'
      }
      action={
        isAdmin && onAddCategory
          ? { label: 'Aggiungi Categoria', onPress: onAddCategory }
          : undefined
      }
      testID="empty-categories"
    />
  );
}

interface EmptySearchProps {
  onClearSearch?: () => void;
}

export function EmptySearch({ onClearSearch }: EmptySearchProps): ReactNode {
  return (
    <EmptyState
      icon="🔍"
      title="Nessun risultato"
      description="Prova a cercare qualcos'altro"
      action={
        onClearSearch
          ? { label: 'Pulisci Ricerca', onPress: onClearSearch }
          : undefined
      }
      testID="empty-search"
    />
  );
}

interface EmptyFavoritesProps {
  onBrowseMenu?: () => void;
}

export function EmptyFavorites({ onBrowseMenu }: EmptyFavoritesProps): ReactNode {
  return (
    <EmptyState
      icon="❤️"
      title="Nessun preferito"
      description="Aggiungi i tuoi prodotti preferiti per vederli qui"
      action={
        onBrowseMenu
          ? { label: 'Esplora Menu', onPress: onBrowseMenu }
          : undefined
      }
      testID="empty-favorites"
    />
  );
}

interface EmptyOfflineQueueProps {
  onSync?: () => void;
  pendingCount?: number;
}

export function EmptyOfflineQueue({ onSync, pendingCount = 0 }: EmptyOfflineQueueProps): ReactNode {
  if (pendingCount > 0) {
    return (
      <EmptyState
        icon="📤"
        title={`${pendingCount} ordini in coda`}
        description="Gli ordini verranno sincronizzati quando la connessione sarà ripristinata"
        action={onSync ? { label: 'Sincronizza Ora', onPress: onSync } : undefined}
        testID="pending-orders"
      />
    );
  }

  return (
    <EmptyState
      icon="✅"
      title="Tutto sincronizzato"
      description="Non ci sono ordini in attesa"
      testID="empty-offline-queue"
    />
  );
}

interface EmptyKitchenOrdersProps {
  onRefresh?: () => void;
}

export function EmptyKitchenOrders({ onRefresh }: EmptyKitchenOrdersProps): ReactNode {
  return (
    <EmptyState
      icon="👨‍🍳"
      title="Nessun ordine attivo"
      description="Gli ordini da preparare appariranno qui"
      action={
        onRefresh
          ? { label: 'Aggiorna', onPress: onRefresh }
          : undefined
      }
      testID="empty-kitchen-orders"
    />
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Si è verificato un errore',
  message,
  onRetry,
}: ErrorStateProps): ReactNode {
  return (
    <EmptyState
      icon="⚠️"
      title={title}
      description={message}
      action={
        onRetry
          ? { label: 'Riprova', onPress: onRetry }
          : undefined
      }
      testID="error-state"
    />
  );
}

// ============================================================================
// OFFLINE STATE
// ============================================================================

interface OfflineStateProps {
  onRetry?: () => void;
}

export function OfflineState({ onRetry }: OfflineStateProps): ReactNode {
  return (
    <EmptyState
      icon="📡"
      title="Sei offline"
      description="Controlla la tua connessione internet"
      action={
        onRetry
          ? { label: 'Riprova', onPress: onRetry }
          : undefined
      }
      testID="offline-state"
    />
  );
}

// ============================================================================
// MAINTENANCE STATE
// ============================================================================

interface MaintenanceStateProps {
  estimatedTime?: string;
}

export function MaintenanceState({ estimatedTime }: MaintenanceStateProps): ReactNode {
  return (
    <EmptyState
      icon="🔧"
      title="Manutenzione in corso"
      description={
        estimatedTime
          ? `Torneremo operativi entro ${estimatedTime}`
          : 'Il servizio è temporaneamente non disponibile'
      }
      testID="maintenance-state"
    />
  );
}