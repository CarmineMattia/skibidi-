/**
 * Skeleton Loading Components
 * Provide visual loading states for data fetching
 */

import type { ReactNode } from 'react';
import { View, Text } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
}

// ============================================================================
// BASE SKELETON
// ============================================================================

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  className = '',
}: SkeletonProps): ReactNode {
  return (
    <View
      className={`bg-secondary/30 animate-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
      }}
    />
  );
}

// ============================================================================
// SKELETON VARIANTS
// ============================================================================

export function SkeletonCard(): ReactNode {
  return (
    <View className="bg-card rounded-xl p-4 border border-border">
      <View className="flex-row gap-4">
        <Skeleton width={80} height={80} borderRadius={8} />
        <View className="flex-1 gap-2">
          <Skeleton width="60%" height={20} borderRadius={4} />
          <Skeleton width="40%" height={16} borderRadius={4} />
          <Skeleton width="30%" height={24} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonProductCard({ isLarge = false }: { isLarge?: boolean }): ReactNode {
  const height = isLarge ? 450 : 380;

  return (
    <View
      className="bg-card rounded-xl overflow-hidden border border-border"
      style={{ height }}
    >
      <Skeleton width="100%" height={isLarge ? 250 : 200} borderRadius={0} />
      <View className="p-4 gap-2">
        <Skeleton width="70%" height={24} borderRadius={4} />
        <Skeleton width="50%" height={16} borderRadius={4} />
        <View className="flex-row justify-between items-center mt-2">
          <Skeleton width="30%" height={28} borderRadius={8} />
          <Skeleton width={48} height={48} borderRadius={24} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList(
  {
    count = 5,
    renderItem,
  }: {
    count?: number;
    renderItem?: () => ReactNode;
  },
): ReactNode {
  return (
    <View className="gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <View key={index}>
          {renderItem?.() ?? <SkeletonCard />}
        </View>
      ))}
    </View>
  );
}

export function SkeletonGrid({
  count = 6,
  numColumns = 2,
}: {
  count?: number;
  numColumns?: number;
}): ReactNode {
  return (
    <View
      className="gap-4"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ width: `${100 / numColumns}%`, padding: 8 }}>
          <SkeletonProductCard />
        </View>
      ))}
    </View>
  );
}

export function SkeletonText({
  lines = 3,
}: {
  lines?: number;
}): ReactNode {
  return (
    <View className="gap-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? '60%' : '100%'}
          height={16}
          borderRadius={4}
        />
      ))}
    </View>
  );
}

export function SkeletonButton(): ReactNode {
  return (
    <View className="flex-row gap-3">
      <Skeleton width={100} height={48} borderRadius={12} />
      <Skeleton width={150} height={48} borderRadius={12} />
    </View>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}): ReactNode {
  return (
    <View className="gap-2">
      {/* Header row */}
      <View className="flex-row gap-2">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} width={80} height={24} borderRadius={4} />
        ))}
      </View>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View key={`row-${rowIndex}`} className="flex-row gap-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} width={80} height={20} borderRadius={4} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function SkeletonForm(): ReactNode {
  return (
    <View className="gap-4">
      <Skeleton width="30%" height={20} borderRadius={4} />
      <Skeleton width="100%" height={56} borderRadius={12} />
      <Skeleton width="30%" height={20} borderRadius={4} />
      <Skeleton width="100%" height={56} borderRadius={12} />
      <Skeleton width="100%" height={100} borderRadius={12} />
    </View>
  );
}

// ============================================================================
// LOADING OVERLAY
// ============================================================================

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = 'Elaborazione...' }: LoadingOverlayProps): ReactNode {
  if (!visible) {
    return null;
  }

  return (
    <View className="absolute inset-0 bg-black/50 items-center justify-center z-50">
      <View className="bg-card rounded-2xl p-8 items-center min-w-[200px]">
        <View className="mb-4">
          <View className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </View>
        <Text className="text-foreground font-medium">{message}</Text>
      </View>
    </View>
  );
}

// ============================================================================
// PULSE ANIMATION (for inline use)
// ============================================================================

export function PulseDot({ size = 8 }: { size?: number }): ReactNode {
  return (
    <View
      className="bg-primary rounded-full animate-pulse"
      style={{ width: size, height: size }}
    />
  );
}

// ============================================================================
// FULL PAGE LOADING
// ============================================================================

interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({ message = 'Caricamento in corso...' }: FullPageLoadingProps): ReactNode {
  return (
    <View className="flex-1 bg-background items-center justify-center p-8">
      <View className="items-center">
        <View className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <Text className="text-muted-foreground font-medium text-lg">{message}</Text>
      </View>
    </View>
  );
}