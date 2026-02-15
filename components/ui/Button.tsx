/**
 * Button Component
 * Componente bottone riutilizzabile stile shadcn/ui
 */

import { Pressable, Text, PressableProps } from 'react-native';
import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'flex flex-row items-center justify-center rounded-md font-medium transition-colors active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'border border-input bg-background',
        secondary: 'bg-secondary',
        ghost: 'bg-transparent',
        link: 'bg-transparent underline-offset-4',
      },
      size: {
        default: 'h-12 px-5 py-3',
        sm: 'h-11 rounded-md px-4',
        lg: 'h-14 rounded-xl px-10',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('font-medium text-center', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-accent-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-accent-foreground',
      link: 'text-primary underline',
    },
    size: {
      default: 'text-base',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  title?: string;
  children?: ReactNode;
}

export function Button({
  title,
  children,
  variant,
  size,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children || (title && <Text className={cn(buttonTextVariants({ variant, size }))}>{title}</Text>)}
    </Pressable>
  );
}
