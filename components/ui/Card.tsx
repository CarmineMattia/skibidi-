/**
 * Card Component
 * Componente card riutilizzabile stile shadcn/ui
 */

import { View, Text, ViewProps, TextProps } from 'react-native';
import { cn } from '@/lib/utils/cn';

export interface CardProps extends ViewProps {}

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends ViewProps {}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <View className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  );
}

export interface CardTitleProps extends TextProps {}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <Text
      className={cn(
        'text-2xl font-semibold leading-none tracking-tight text-card-foreground',
        className
      )}
      {...props}
    />
  );
}

export interface CardDescriptionProps extends TextProps {}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <Text className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export interface CardContentProps extends ViewProps {}

export function CardContent({ className, ...props }: CardContentProps) {
  return <View className={cn('p-6 pt-0', className)} {...props} />;
}

export interface CardFooterProps extends ViewProps {}

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <View className={cn('flex flex-row items-center p-6 pt-0', className)} {...props} />
  );
}
