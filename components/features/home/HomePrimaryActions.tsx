import { FontAwesome } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

interface HomePrimaryActionsProps {
  readonly onOrderNow: () => void;
  readonly onViewMenu: () => void;
}

export function HomePrimaryActions({ onOrderNow, onViewMenu }: HomePrimaryActionsProps) {
  return (
    <View className="bg-white border border-[#ead8c7] rounded-2xl p-3 gap-2 shadow-sm">
      <Pressable
        onPress={onOrderNow}
        className="bg-[#d4451a] rounded-xl h-12 items-center justify-center active:opacity-90"
      >
        <View className="flex-row items-center gap-2">
          <FontAwesome name="shopping-bag" size={13} color="#ffffff" />
          <Text className="text-white font-extrabold text-base">Ordina ora</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onViewMenu}
        className="bg-white border border-orange-200 rounded-xl h-12 items-center justify-center active:opacity-90"
      >
        <View className="flex-row items-center gap-2">
          <FontAwesome name="cutlery" size={13} color="#c2410c" />
          <Text className="text-orange-700 font-bold text-base">Vedi menu</Text>
        </View>
      </Pressable>
    </View>
  );
}
