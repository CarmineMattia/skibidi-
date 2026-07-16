/**
 * Skeleton Loading Components
 * Provide visual loading states for data fetching
 */

import type { ReactNode } from 'react';
import type { DimensionValue } from 'react-native';
import { ScrollView, View, Text } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
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

export function SkeletonOfferCard({
  width,
  height,
}: {
  width: number;
  height: number;
}): ReactNode {
  const imageWidth = Math.round(width * 0.42);

  return (
    <View
      style={{ width, height }}
      className="flex-row rounded-2xl overflow-hidden bg-white border-2 border-[#e1a255]/30"
    >
      <Skeleton width={imageWidth} height={height} borderRadius={0} />
      <View className="flex-1 px-3 py-2.5 justify-between">
        <View className="gap-2">
          <Skeleton width="80%" height={18} borderRadius={4} />
          <Skeleton width="60%" height={14} borderRadius={4} />
        </View>
        <View className="flex-row items-center justify-between">
          <Skeleton width="35%" height={24} borderRadius={8} />
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonOfferCardStack({
  width,
}: {
  width: number;
}): ReactNode {
  const imageHeight = width >= 560 ? 208 : 184;

  return (
    <View
      style={{ width }}
      className="overflow-hidden rounded-[24px] border border-[#ead8c7] bg-white"
    >
      <Skeleton width="100%" height={imageHeight} borderRadius={0} />
      <View className="gap-3 p-4">
        <SkeletonText lines={2} />
        <View className="flex-row gap-1.5">
          <Skeleton width={32} height={32} borderRadius={8} />
          <Skeleton width={32} height={32} borderRadius={8} />
          <Skeleton width={32} height={32} borderRadius={8} />
        </View>
        <View className="flex-row items-end justify-between">
          <Skeleton width="35%" height={28} borderRadius={8} />
          <Skeleton width={44} height={44} borderRadius={22} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonHomeOffers({
  isCompact = false,
  cardWidth = 360,
}: {
  isCompact?: boolean;
  cardWidth?: number;
}): ReactNode {
  const cardCount = isCompact ? 2 : 3;

  return (
    <View className="gap-4">
      {Array.from({ length: cardCount }).map((_, index) => (
        <SkeletonOfferCardStack key={`home-offer-skeleton-${index}`} width={cardWidth} />
      ))}
      <Skeleton width={180} height={16} borderRadius={4} />
    </View>
  );
}

export function SkeletonOffersPage({ cardWidth }: { cardWidth: number }): ReactNode {
  return (
    <View className="gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonOfferCardStack key={`offer-page-skeleton-${index}`} width={cardWidth} />
      ))}
    </View>
  );
}

export function SkeletonOrderCard(): ReactNode {
  return (
    <View className="rounded-xl bg-[#fffaf5] border border-orange-100 p-3 gap-2">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-2">
          <Skeleton width="45%" height={18} borderRadius={4} />
          <Skeleton width="55%" height={12} borderRadius={4} />
        </View>
        <Skeleton width={72} height={22} borderRadius={12} />
      </View>
      <Skeleton width="80%" height={12} borderRadius={4} />
      <View className="flex-row items-center justify-between">
        <Skeleton width="25%" height={24} borderRadius={6} />
        <Skeleton width={80} height={36} borderRadius={8} />
      </View>
    </View>
  );
}

export function SkeletonKitchenOrderCard(): ReactNode {
  return (
    <View className="bg-card rounded-2xl border-2 border-border p-4 gap-3" style={{ minHeight: 220 }}>
      <View className="flex-row justify-between items-start">
        <View className="gap-2">
          <Skeleton width={100} height={22} borderRadius={4} />
          <Skeleton width={140} height={14} borderRadius={4} />
        </View>
        <Skeleton width={80} height={26} borderRadius={12} />
      </View>
      <View className="gap-2">
        <Skeleton width="90%" height={14} borderRadius={4} />
        <Skeleton width="70%" height={14} borderRadius={4} />
        <Skeleton width="60%" height={14} borderRadius={4} />
      </View>
      <View className="flex-row justify-between items-center mt-1">
        <Skeleton width={70} height={28} borderRadius={6} />
        <Skeleton width="48%" height={44} borderRadius={12} />
      </View>
    </View>
  );
}

export function SkeletonKitchenGrid({
  count = 4,
  columns = 1,
}: {
  count?: number;
  columns?: number;
}): ReactNode {
  return (
    <View
      className={`gap-3 ${columns > 1 ? 'flex-row flex-wrap' : ''}`}
      style={columns > 1 ? { padding: 12 } : { padding: 12 }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={`kitchen-skeleton-${index}`}
          style={columns > 1 ? { width: `${100 / columns}%`, padding: columns > 1 ? 6 : 0 } : undefined}
          className={columns > 1 ? 'flex-1' : undefined}
        >
          <SkeletonKitchenOrderCard />
        </View>
      ))}
    </View>
  );
}

export function SkeletonMetricCard(): ReactNode {
  return (
    <View className="rounded-2xl border border-[#e1a255]/40 bg-white p-4 flex-row items-center justify-between">
      <View className="flex-1 gap-2">
        <Skeleton width="50%" height={12} borderRadius={4} />
        <Skeleton width="35%" height={32} borderRadius={6} />
      </View>
      <Skeleton width={40} height={40} borderRadius={20} />
    </View>
  );
}

export function SkeletonDashboardMetrics(): ReactNode {
  const barHeights = [24, 48, 32, 56, 40, 28, 64];

  return (
    <View className="gap-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <SkeletonMetricCard key={`metric-${index}`} />
      ))}
      <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-3">
        <Skeleton width="30%" height={12} borderRadius={4} />
        <Skeleton width="60%" height={20} borderRadius={4} />
        <View className="flex-row items-end justify-between gap-1 mt-2">
          {barHeights.map((height, index) => (
            <View key={`bar-${index}`} className="flex-1 items-center max-w-[14px]">
              <Skeleton width="100%" height={height} borderRadius={2} />
            </View>
          ))}
        </View>
      </View>
      <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-3">
        <Skeleton width="45%" height={12} borderRadius={4} />
        <View className="flex-row items-end justify-between gap-2 mt-2">
          {barHeights.map((height, index) => (
            <View key={`day-bar-${index}`} className="flex-1 items-center">
              <Skeleton width="100%" height={height} borderRadius={4} className="max-w-[32px]" />
              <Skeleton width={24} height={10} borderRadius={4} className="mt-2" />
            </View>
          ))}
        </View>
      </View>
      <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-3">
        <Skeleton width="55%" height={12} borderRadius={4} />
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={`action-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3 gap-2">
            <Skeleton width="40%" height={16} borderRadius={4} />
            <Skeleton width="65%" height={12} borderRadius={4} />
            <View className="flex-row gap-2 mt-1">
              <Skeleton width="48%" height={36} borderRadius={8} />
              <Skeleton width="48%" height={36} borderRadius={8} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonOrderTracking(): ReactNode {
  return (
    <View className="gap-3.5">
      <View className="bg-white rounded-2xl border border-[#e1a255]/40 px-4 py-3.5 gap-2.5">
        <Skeleton width="55%" height={12} borderRadius={4} />
        <Skeleton width="40%" height={14} borderRadius={4} />
        <Skeleton width="50%" height={48} borderRadius={8} />
        <Skeleton width="80%" height={14} borderRadius={4} />
        <Skeleton width={100} height={28} borderRadius={16} />
      </View>
      <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={`step-${index}`} className="flex-row gap-3">
            <Skeleton width={36} height={36} borderRadius={18} />
            <View className="flex-1 gap-2 pt-1">
              <Skeleton width="50%" height={16} borderRadius={4} />
              <Skeleton width="70%" height={12} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
      <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-3">
        <Skeleton width="45%" height={22} borderRadius={6} />
        <Skeleton width="85%" height={14} borderRadius={4} />
        <View className="flex-row gap-2">
          <Skeleton width="48%" height={44} borderRadius={12} />
          <Skeleton width="48%" height={44} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonMenuScreen({
  numColumns = 2,
  isMobile = false,
}: {
  numColumns?: number;
  isMobile?: boolean;
}): ReactNode {
  return (
    <View className="flex-1 bg-[#f9ecdd]">
      <View
        className={`${isMobile ? 'px-3 py-2.5' : 'px-8 py-4'} border-b border-[#e1a255]/40 flex-row items-center justify-between bg-white/95`}
      >
        <View className="flex-row items-center gap-3">
          {!isMobile ? null : <Skeleton width={36} height={36} borderRadius={8} />}
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={isMobile ? 140 : 200} height={20} borderRadius={4} />
        </View>
        <View className="flex-row items-center gap-2">
          <Skeleton width={90} height={32} borderRadius={16} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={`cat-${index}`} width={80} height={32} borderRadius={16} />
        ))}
      </ScrollView>
      <View className={`${isMobile ? 'p-3' : 'p-4 md:p-6'}`}>
        <SkeletonGrid count={6} numColumns={numColumns} />
      </View>
    </View>
  );
}

export function SkeletonReceipt(): ReactNode {
  return (
    <View className="p-4 gap-4">
      <View className="border border-border rounded-lg p-4 gap-3 bg-background">
        <Skeleton width="60%" height={18} borderRadius={4} className="self-center" />
        <Skeleton width="80%" height={12} borderRadius={4} className="self-center" />
        <Skeleton width="70%" height={12} borderRadius={4} className="self-center" />
        <View className="h-px bg-border my-2" />
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={`item-${index}`} className="flex-row justify-between gap-2">
            <Skeleton width="55%" height={14} borderRadius={4} />
            <Skeleton width="20%" height={14} borderRadius={4} />
          </View>
        ))}
        <View className="h-px bg-border my-2" />
        <View className="flex-row justify-between">
          <Skeleton width="30%" height={18} borderRadius={4} />
          <Skeleton width="25%" height={18} borderRadius={4} />
        </View>
      </View>
      <Skeleton width="100%" height={48} borderRadius={12} />
      <Skeleton width="100%" height={48} borderRadius={12} />
    </View>
  );
}

export function SkeletonAccountProfile(): ReactNode {
  return (
    <View className="gap-4">
      <View className="bg-white rounded-2xl p-5 border border-[#e1a255]/40 gap-2">
        <Skeleton width="40%" height={12} borderRadius={4} />
        <Skeleton width="35%" height={28} borderRadius={6} />
        <Skeleton width="70%" height={14} borderRadius={4} />
      </View>
      <View className="bg-white rounded-2xl p-5 border border-[#e1a255]/40 gap-3">
        <Skeleton width="20%" height={12} borderRadius={4} />
        <Skeleton width="50%" height={20} borderRadius={4} />
        <Skeleton width="20%" height={12} borderRadius={4} className="mt-2" />
        <Skeleton width="65%" height={16} borderRadius={4} />
        <Skeleton width="20%" height={12} borderRadius={4} className="mt-2" />
        <Skeleton width="30%" height={16} borderRadius={4} />
      </View>
      <Skeleton width="100%" height={52} borderRadius={12} />
    </View>
  );
}

export function SkeletonShiftDoughStats(): ReactNode {
  return (
    <View className="flex-row gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={`dough-${index}`} className="gap-1">
          <Skeleton width={48} height={12} borderRadius={4} />
          <Skeleton width={36} height={28} borderRadius={6} />
        </View>
      ))}
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