import {
  DEFAULT_NEW_ORDER_SOUND_URL,
  DEFAULT_ORDER_READY_SOUND_URL,
} from '@/lib/data/defaultAlertSounds';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { Audio } from 'expo-av';
import { useCallback, useRef } from 'react';

type OrderAlertEvent = 'new-order' | 'order-ready';

export function useOrderAlertSound() {
  const { alertSounds } = useAppSettings();
  const dedupeMap = useRef<Record<string, number>>({});

  const playAlert = useCallback(
    async (event: OrderAlertEvent, dedupeKey?: string) => {
      if (!alertSounds.enabled) return;
      const soundUrl =
        event === 'new-order'
          ? alertSounds.newOrderSoundUrl || DEFAULT_NEW_ORDER_SOUND_URL
          : alertSounds.orderReadySoundUrl || DEFAULT_ORDER_READY_SOUND_URL;
      if (!soundUrl) return;

      if (dedupeKey) {
        const now = Date.now();
        const key = `${event}:${dedupeKey}`;
        const lastPlayedAt = dedupeMap.current[key] ?? 0;
        if (now - lastPlayedAt < 4000) {
          return;
        }
        dedupeMap.current[key] = now;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: soundUrl }, { shouldPlay: true, volume: 1 });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !status.didJustFinish) return;
        void sound.unloadAsync();
      });
    },
    [alertSounds.enabled, alertSounds.newOrderSoundUrl, alertSounds.orderReadySoundUrl]
  );

  return { playAlert };
}
