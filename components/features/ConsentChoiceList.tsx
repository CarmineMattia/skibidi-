import { CONSENT_PURPOSES } from '@/lib/privacy/consentDraft';
import type { ConsentChoice, ConsentPurpose } from '@/lib/privacy/consent';
import { FontAwesome } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

export function ConsentChoiceList({
  choices,
  disabled,
  onToggle,
}: {
  readonly choices: readonly ConsentChoice[];
  readonly disabled: boolean;
  readonly onToggle: (purpose: ConsentPurpose, granted: boolean) => void;
}) {
  return (
    <View className="gap-3">
      {CONSENT_PURPOSES.map((purpose) => {
        const choice = choices.find((item) => item.purpose === purpose.purpose);
        const checked = choice?.granted === true;
        return (
          <Pressable
            key={purpose.purpose}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled }}
            accessibilityLabel={purpose.title}
            disabled={disabled}
            onPress={() => onToggle(purpose.purpose, !checked)}
            className="flex-row items-start gap-3"
          >
            <View
              className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 border-[#8d171e] ${
                checked ? 'bg-[#8d171e]' : 'bg-white'
              }`}
            >
              {checked ? <FontAwesome name="check" size={14} color="#ffffff" /> : null}
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-base font-bold text-[#271d19]">{purpose.title}</Text>
              <Text className="text-sm leading-5 text-[#65554c]">{purpose.detail}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
