/**
 * Motion piccola e condivisa: easing esplicito, tetto 300ms,
 * niente animazione se l'utente chiede meno movimento.
 */

import { motionDuration, UI_MOTION_MS } from '@/lib/motion/timings';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const easeOut = Easing.out(Easing.cubic);

/** True solo se né il sistema né reanimated chiedono meno movimento. */
export function useMotionEnabled(): boolean {
  const reduced = useReducedMotion();
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    let active = true;
    const apply = (value: boolean) => {
      if (active) setSystemReduced(value);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(apply).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced === false && !systemReduced;
}

/** Ingresso a scaglioni. index 0 e reduced-motion restano immediati. */
export function StaggerIn({
  index = 0,
  disabled = false,
  children,
}: {
  readonly index?: number;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}) {
  const motion = useMotionEnabled();
  const entering = useMemo(
    () => FadeIn.duration(160).delay(Math.min(index, 4) * 28).easing(easeOut),
    [index]
  );
  if (disabled || !motion || index <= 0) {
    return <>{children}</>;
  }

  return (
    <Animated.View entering={entering}>
      {children}
    </Animated.View>
  );
}

/** Il contenuto si assesta un filo dopo che il contenitore è arrivato. */
export function SettleIn({
  active,
  children,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
}) {
  const motion = useMotionEnabled();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    if (!motion) {
      translateY.value = 0;
      return;
    }
    translateY.value = 8;
    translateY.value = withTiming(0, {
      duration: motionDuration(false, 180),
      easing: easeOut,
    });
  }, [active, motion, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    flex: 1,
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Squash & stretch sul badge quando il conteggio sale. */
export function BumpingBadge({
  count,
  children,
  style,
}: {
  readonly count: number;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const motion = useMotionEnabled();
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const previous = useRef(count);

  useEffect(() => {
    const grew = count > previous.current;
    previous.current = count;
    if (!grew || !motion) return;
    scaleX.value = withSequence(
      withTiming(1.18, { duration: 90, easing: easeOut }),
      withTiming(0.96, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 80, easing: easeOut })
    );
    scaleY.value = withSequence(
      withTiming(0.84, { duration: 90, easing: easeOut }),
      withTiming(1.1, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 80, easing: easeOut })
    );
  }, [count, motion, scaleX, scaleY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }, { scaleY: scaleY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/** Shake corto su un campo non valido. */
export function ShakeView({
  signal,
  children,
}: {
  readonly signal: number;
  readonly children: ReactNode;
}) {
  const motion = useMotionEnabled();
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (!signal || !motion) return;
    translateX.value = withSequence(
      withTiming(-7, { duration: 45, easing: Easing.out(Easing.quad) }),
      withTiming(6, { duration: 45, easing: Easing.out(Easing.quad) }),
      withTiming(-3, { duration: 40, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 50, easing: easeOut })
    );
  }, [signal, motion, translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Pressione del "+" : squash minimo, sotto i 180ms. */
export function MicroPlus({
  onPress,
  disabled,
  accessibilityLabel,
  className,
  children,
}: {
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const motion = useMotionEnabled();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        className={className}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        hitSlop={8}
        onPress={onPress}
        onPressIn={() => {
          if (!motion) return;
          scale.value = withSequence(
            withTiming(0.88, { duration: 70, easing: easeOut }),
            withTiming(1, { duration: 90, easing: easeOut })
          );
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Profondità sulla card: scala e ombra in 120ms, niente se reduced motion. */
export function useCardPressDepth() {
  const motion = useMotionEnabled();
  const scale = useSharedValue(1);
  const shadow = useSharedValue(0.05);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: shadow.value,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowColor: '#5a1a12',
  }));

  const pressIn = () => {
    if (!motion) return;
    const duration = motionDuration(false, 120);
    scale.value = withTiming(0.985, { duration, easing: easeOut });
    shadow.value = withTiming(0.18, { duration, easing: easeOut });
  };

  const pressOut = () => {
    const duration = motionDuration(!motion, 140);
    scale.value = withTiming(1, { duration, easing: easeOut });
    shadow.value = withTiming(0.05, { duration, easing: easeOut });
  };

  return { style, pressIn, pressOut };
}

export const ADD_POSE_MS = UI_MOTION_MS;
