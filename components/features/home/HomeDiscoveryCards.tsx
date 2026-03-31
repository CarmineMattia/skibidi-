import { Pressable, Text, View } from 'react-native';

interface HomeDiscoveryCardsProps {
  readonly onOpenChef: () => void;
  readonly onOpenNearby: () => void;
}

export function HomeDiscoveryCards({ onOpenChef, onOpenNearby }: HomeDiscoveryCardsProps) {
  return (
    <View className="flex-row gap-2">
      <Pressable
        className="flex-1 bg-[#f7f3ed] border border-orange-100 rounded-xl p-3 active:opacity-90"
        onPress={onOpenChef}
      >
        <Text className="text-sm font-extrabold text-gray-900">👨‍🍳 Selezione dello Chef</Text>
        <Text className="text-[11px] text-gray-600 mt-1">Le creazioni artigianali della settimana.</Text>
      </Pressable>
      <Pressable
        className="flex-1 bg-[#fff7ee] border border-orange-100 rounded-xl p-3 active:opacity-90"
        onPress={onOpenNearby}
      >
        <Text className="text-sm font-extrabold text-gray-900">📍 Popolari in zona</Text>
        <Text className="text-[11px] text-gray-600 mt-1">I piatti piu ordinati vicino a te.</Text>
      </Pressable>
    </View>
  );
}
