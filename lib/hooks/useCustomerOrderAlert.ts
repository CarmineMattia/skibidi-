import { DEFAULT_CUSTOMER_STATUS_SOUND_URL } from '@/lib/data/defaultAlertSounds';
import { Audio } from 'expo-av';
import { useCallback, useRef } from 'react';

export function useCustomerOrderAlert() {
  const dedupeMap = useRef<Record<string, number>>({});

  const playStatusAlert = useCallback(async (dedupeKey?: string) => {
    if (dedupeKey) {
      const now = Date.now();
      const lastPlayedAt = dedupeMap.current[dedupeKey] ?? 0;
      if (now - lastPlayedAt < 4000) return;
      dedupeMap.current[dedupeKey] = now;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: DEFAULT_CUSTOMER_STATUS_SOUND_URL },
        { shouldPlay: true, volume: 0.85 }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !status.didJustFinish) return;
        void sound.unloadAsync();
      });
    } catch (error) {
      console.warn('[CustomerOrderAlert] playback failed:', error);
    }
  }, []);

  return { playStatusAlert };
}
