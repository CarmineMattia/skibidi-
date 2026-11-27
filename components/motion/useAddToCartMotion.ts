import { useCallback, useRef } from 'react';
import { type View } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useCartFly } from '@/components/motion/CartFlyProvider';
import { useMotionEnabled } from '@/components/motion/motionParts';

const easeOut = Easing.out(Easing.cubic);

/**
 * Posa dell'aggiunta: piccolo wind-up, poi stretch, poi riposo.
 * Il volo ad arco parte solo se il carrello in testata è misurabile.
 */
export function useAddToCartMotion() {
  const ref = useRef<View>(null);
  const { flyFrom } = useCartFly();
  const motion = useMotionEnabled();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const play = useCallback(
    (action: () => void) => {
      if (motion) {
        scale.value = withSequence(
          withTiming(0.96, { duration: 60, easing: easeOut }),
          withTiming(1.04, { duration: 90, easing: easeOut }),
          withTiming(1, { duration: 80, easing: easeOut })
        );
        ref.current?.measureInWindow((x, y, width, height) => {
          if (width <= 0 && height <= 0) return;
          flyFrom({ x: x + width / 2, y: y + height / 2 });
        });
      }
      action();
    },
    [flyFrom, motion, scale]
  );

  return { ref, style, play };
}
