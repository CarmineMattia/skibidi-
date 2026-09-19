import { BRAND } from '@/lib/data/brand';
import { openSatispayApp } from '@/lib/utils/satispay';
import { FontAwesome5 } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

interface SatispayOpenHintProps {
  /** importo in euro già formattato, es. "12,50" — opzionale */
  readonly amountLabel?: string | null;
}

/**
 * Guida intermedia: apri Satispay + cerca Pizzeria Ambrosia a mano
 * (finché non abbiamo lo shop_id del link ufficiale).
 */
export function SatispayOpenHint({ amountLabel }: SatispayOpenHintProps) {
  return (
    <View className="gap-3 rounded-2xl border border-[#f94c43]/25 bg-[#fff5f4] p-4">
      <Text className="text-sm font-bold text-[#271d19]">Paga con Satispay</Text>
      <Text className="text-sm leading-5 text-[#65554c]">
        {`1. Apri l'app Satispay\n2. Cerca `}
        <Text className="font-extrabold text-[#271d19]">{BRAND.name}</Text>
        {`\n3. Invia l'importo`}
        {amountLabel ? (
          <Text className="font-extrabold text-[#8d171e]">{` (${amountLabel})`}</Text>
        ) : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apri app Satispay"
        onPress={() => {
          void openSatispayApp();
        }}
        className="min-h-[56px] flex-row items-center justify-center gap-3 rounded-2xl bg-[#f94c43] px-5 active:opacity-90"
      >
        <FontAwesome5 name="wallet" size={18} color="#ffffff" />
        <Text className="text-base font-extrabold text-white">Apri Satispay</Text>
      </Pressable>

      <Text className="text-[11px] leading-4 text-[#8f7068]">
        {`Se l'app non si apre, aprila tu e cerca «${BRAND.name}».`}
      </Text>
    </View>
  );
}
