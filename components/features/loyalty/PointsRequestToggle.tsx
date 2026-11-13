import { clampPointsRequest, discountEur, pointsRequestCaption } from '@/lib/loyalty/points';
import { Pressable, Text, View } from 'react-native';

interface PointsRequestToggleProps {
  balance: number;
  unit: number;
  redeemValueEur: number;
  maxPoints: number;
  value: number;
  onChange: (points: number) => void;
}

export function PointsRequestToggle({
  balance,
  unit,
  redeemValueEur,
  maxPoints,
  value,
  onChange,
}: PointsRequestToggleProps) {
  const points = clampPointsRequest(value, maxPoints, unit);

  if (maxPoints < unit) {
    return (
      <View className="rounded-xl border border-[#e1a255]/50 bg-[#fffaf5] p-4 gap-1">
        <Text className="font-bold text-gray-900">Usa i punti</Text>
        <Text className="text-sm text-gray-600">
          Servono almeno {unit} punti. Ora ne hai {balance}.
        </Text>
      </View>
    );
  }

  const selected = points >= unit;
  return (
    <View className="rounded-xl border border-[#e1a255]/50 bg-[#fffaf5] p-4 gap-3">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        onPress={() => onChange(selected ? 0 : unit)}
        className="flex-row items-center gap-3"
      >
        <View className={`h-6 w-6 rounded-md border-2 items-center justify-center ${selected ? 'bg-[#8d171e] border-[#8d171e]' : 'border-[#8d171e] bg-white'}`}>
          {selected ? <Text className="text-white font-black text-xs">✓</Text> : null}
        </View>
        <View className="flex-1">
          <Text className="font-bold text-gray-900">Usa i punti</Text>
          <Text className="text-xs text-gray-600">
            {unit} punti = €{redeemValueEur.toFixed(2)} di sconto, solo se la cassa conferma.
          </Text>
        </View>
      </Pressable>
      {selected ? (
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Meno punti"
              disabled={value <= unit}
              onPress={() => onChange(Math.max(unit, points - unit))}
              className="h-10 w-10 rounded-lg bg-white border border-[#e1a255] items-center justify-center"
            >
              <Text className="text-lg font-black text-[#8d171e]">−</Text>
            </Pressable>
            <Text className="font-black text-gray-900">{points} punti</Text>
            <Pressable
              accessibilityLabel="Più punti"
              disabled={points >= maxPoints}
              onPress={() => onChange(Math.min(maxPoints, points + unit))}
              className="h-10 w-10 rounded-lg bg-white border border-[#e1a255] items-center justify-center"
            >
              <Text className="text-lg font-black text-[#8d171e]">+</Text>
            </Pressable>
          </View>
          <Text className="text-sm font-bold text-[#8d171e]">{pointsRequestCaption()}</Text>
          <Text className="text-xs text-gray-600">
            Sconto previsto €{discountEur(points, unit, redeemValueEur).toFixed(2)}, se confermato insieme al pagamento. Il totale di questa pagina non cambia.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
