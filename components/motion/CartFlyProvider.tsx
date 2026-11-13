/**
 * Puntino che va al carrello su un arco (anticipazione + easing, <=300ms).
 * Il bersaglio è l'icona carrello in alto a destra.
 */

import { ANTICIPATION_MS, motionDuration } from '@/lib/motion/timings';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useMotionEnabled } from '@/components/motion/motionParts';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type Point = { x: number; y: number };

type CartFlyContextValue = {
  registerTarget: Ref<View>;
  flyFrom: (origin: Point) => void;
};

const noopFly: CartFlyContextValue = {
  registerTarget: () => undefined,
  flyFrom: () => undefined,
};

const CartFlyContext = createContext<CartFlyContextValue>(noopFly);

export function useCartFly(): CartFlyContextValue {
  return useContext(CartFlyContext);
}

export function CartFlyProvider({ children }: { readonly children: ReactNode }) {
  const motion = useMotionEnabled();
  const targetRef = useRef<View | null>(null);
  const progress = useSharedValue(0);
  const visible = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);

  const registerTarget = useCallback((node: View | null) => {
    targetRef.current = node;
  }, []);

  const flyFrom = useCallback(
    (origin: Point) => {
      if (!motion) return;
      const node = targetRef.current;
      if (!node) return;
      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 && height <= 0) return;
        originX.value = origin.x;
        originY.value = origin.y;
        targetX.value = x + width / 2;
        targetY.value = y + height / 2;
        progress.value = 0;
        visible.value = 1;
        progress.value = withDelay(
          ANTICIPATION_MS,
          withTiming(
            1,
            {
              duration: motionDuration(false, 240),
              easing: Easing.inOut(Easing.cubic),
            },
            (finished) => {
              if (finished) visible.value = 0;
            }
          )
        );
      });
    },
    [motion, originX, originY, progress, targetX, targetY, visible]
  );

  const dotStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const arc = Math.sin(t * Math.PI) * -56;
    return {
      opacity: visible.value * (1 - t * 0.2),
      transform: [
        { translateX: originX.value + (targetX.value - originX.value) * t - 7 },
        { translateY: originY.value + (targetY.value - originY.value) * t + arc - 7 },
        { scale: 0.9 + Math.sin(t * Math.PI) * 0.18 },
      ],
    };
  });

  const value = useMemo(() => ({ registerTarget, flyFrom }), [flyFrom, registerTarget]);

  return (
    <CartFlyContext.Provider value={value}>
      <View style={styles.host}>
        {children}
        <Animated.View pointerEvents="none" style={[styles.dot, dotStyle]} />
      </View>
    </CartFlyContext.Provider>
  );
}
const styles = StyleSheet.create({
  host: { flex: 1 },
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#8d171e',
    zIndex: 80,
  },
});
