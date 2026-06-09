import { FontAwesome } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

interface HomeQuickActionsProps {
  readonly isAdmin: boolean;
  readonly onOpenMenu: () => void;
  readonly onOpenKitchen: () => void;
  readonly onOpenTracking: () => void;
  readonly onOpenRewards: () => void;
  readonly onLogout: () => void;
}

export function HomeQuickActions({
  isAdmin,
  onOpenMenu,
  onOpenKitchen,
  onOpenTracking,
  onOpenRewards,
  onLogout,
}: HomeQuickActionsProps) {
  const ActionButton = ({
    title,
    icon,
    onPress,
    tone = 'light',
  }: {
    readonly title: string;
    readonly icon: string;
    readonly onPress: () => void;
    readonly tone?: 'light' | 'primary' | 'ghost';
  }) => {
    const baseClass = 'h-11 rounded-xl px-3 flex-row items-center justify-center gap-2 active:opacity-90';
    const variantClass =
      tone === 'primary'
        ? 'bg-[#8d171e]'
        : tone === 'ghost'
          ? 'bg-white border border-[#e1a255]/40'
          : 'bg-white border border-gray-200';
    const iconColor = tone === 'primary' ? '#ffffff' : '#8d171e';
    const textClass = tone === 'primary' ? 'text-white' : tone === 'ghost' ? 'text-gray-600' : 'text-gray-800';

    return (
      <Pressable className={`${baseClass} ${variantClass}`} onPress={onPress}>
        <FontAwesome name={icon as any} size={14} color={iconColor} />
        <Text className={`${textClass} font-bold text-sm`}>{title}</Text>
      </Pressable>
    );
  };

  return (
    <View className="bg-white rounded-xl border border-gray-200 p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <FontAwesome name="bolt" size={14} color="#4b5563" />
        <Text className="font-extrabold text-gray-900">Azioni Rapide</Text>
      </View>

      <ActionButton title="Vai al Menu" icon="cutlery" onPress={onOpenMenu} tone="primary" />
      <ActionButton title="Traccia Ordine" icon="map-marker" onPress={onOpenTracking} />
      <ActionButton title="Loyalty & Rewards" icon="trophy" onPress={onOpenRewards} />

      {isAdmin && (
        <ActionButton title="Apri Cucina" icon="fire" onPress={onOpenKitchen} />
      )}

      <ActionButton title="Esci" icon="sign-out" onPress={onLogout} tone="ghost" />
    </View>
  );
}
