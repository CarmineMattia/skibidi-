import { Button } from '@/components/ui/Button';
import { Text, View } from 'react-native';

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
  return (
    <View className="bg-white rounded-xl border border-gray-200 p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-xl">⚡</Text>
        <Text className="font-extrabold text-gray-900">Azioni Rapide</Text>
      </View>

      <Button title="🛒 Vai al Menu" variant="default" onPress={onOpenMenu} size="default" />

      <Button
        title="📍 Traccia Ordine"
        variant="outline"
        onPress={onOpenTracking}
        size="default"
      />
      <Button
        title="🏅 Loyalty & Rewards"
        variant="outline"
        onPress={onOpenRewards}
        size="default"
      />

      {isAdmin && (
        <Button title="👨‍🍳 Apri Cucina" variant="outline" onPress={onOpenKitchen} size="default" />
      )}

      <Button title="🚪 Esci" variant="ghost" onPress={onLogout} size="default" />
    </View>
  );
}
