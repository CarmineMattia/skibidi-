import { Button } from '@/components/ui/Button';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

interface TimeWheelModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly initialHour?: number;
  readonly initialMinute?: number;
  readonly hourMin?: number;
  readonly hourMax?: number;
  readonly minuteStep?: number;
  readonly onClose: () => void;
  readonly onConfirm: (hour: number, minute: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function TimeWheelModal({
  visible,
  title,
  confirmLabel = 'Conferma',
  cancelLabel = 'Chiudi',
  initialHour = 0,
  initialMinute = 0,
  hourMin = 0,
  hourMax = 23,
  minuteStep = 1,
  onClose,
  onConfirm,
}: TimeWheelModalProps) {
  const safeHourMin = clamp(hourMin, 0, 23);
  const safeHourMax = clamp(hourMax, safeHourMin, 23);
  const safeMinuteStep = clamp(minuteStep, 1, 30);

  const hours = useMemo(
    () => Array.from({ length: safeHourMax - safeHourMin + 1 }, (_, index) => safeHourMin + index),
    [safeHourMin, safeHourMax]
  );
  const minutes = useMemo(
    () => Array.from({ length: Math.floor(60 / safeMinuteStep) }, (_, index) => index * safeMinuteStep),
    [safeMinuteStep]
  );

  const normalizeMinute = (value: number): number => {
    const rounded = Math.round(value / safeMinuteStep) * safeMinuteStep;
    const maxMinute = 60 - safeMinuteStep;
    return clamp(rounded, 0, maxMinute);
  };

  const [hour, setHour] = useState(clamp(initialHour, safeHourMin, safeHourMax));
  const [minute, setMinute] = useState(normalizeMinute(initialMinute));
  const [manualMode, setManualMode] = useState(false);
  const [manualHour, setManualHour] = useState(twoDigits(clamp(initialHour, safeHourMin, safeHourMax)));
  const [manualMinute, setManualMinute] = useState(twoDigits(normalizeMinute(initialMinute)));

  useEffect(() => {
    if (!visible) return;
    const normalizedHour = clamp(initialHour, safeHourMin, safeHourMax);
    const normalizedMinute = normalizeMinute(initialMinute);
    setHour(normalizedHour);
    setMinute(normalizedMinute);
    setManualHour(twoDigits(normalizedHour));
    setManualMinute(twoDigits(normalizedMinute));
    setManualMode(false);
  }, [visible, initialHour, initialMinute, safeHourMin, safeHourMax, safeMinuteStep]);

  const handleConfirm = () => {
    if (manualMode) {
      const parsedHour = Number(manualHour.replaceAll(/\D/g, ''));
      const parsedMinute = Number(manualMinute.replaceAll(/\D/g, ''));
      const normalizedHour = clamp(Number.isNaN(parsedHour) ? safeHourMin : parsedHour, safeHourMin, safeHourMax);
      const normalizedMinute = normalizeMinute(Number.isNaN(parsedMinute) ? 0 : parsedMinute);
      onConfirm(normalizedHour, normalizedMinute);
      return;
    }

    onConfirm(hour, minute);
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-2xl p-4 border-t border-orange-100">
          <Text className="text-base font-bold mb-3">{title}</Text>

          {manualMode ? (
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Ore</Text>
                <TextInput
                  className="h-12 rounded-xl border border-border bg-background px-4 text-foreground font-semibold"
                  keyboardType="number-pad"
                  value={manualHour}
                  onChangeText={setManualHour}
                  maxLength={2}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Minuti</Text>
                <TextInput
                  className="h-12 rounded-xl border border-border bg-background px-4 text-foreground font-semibold"
                  keyboardType="number-pad"
                  value={manualMinute}
                  onChangeText={setManualMinute}
                  maxLength={2}
                />
              </View>
            </View>
          ) : (
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1 max-h-[220px] rounded-xl border border-border bg-background">
                <Text className="text-xs text-muted-foreground px-3 pt-2">Ore</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View className="p-2 gap-1">
                    {hours.map((value) => (
                      <Pressable
                        key={value}
                        className={`h-10 rounded-lg items-center justify-center ${
                          value === hour ? 'bg-orange-50 border border-orange-200' : 'bg-white'
                        }`}
                        onPress={() => setHour(value)}
                      >
                        <Text className="font-semibold">{twoDigits(value)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View className="flex-1 max-h-[220px] rounded-xl border border-border bg-background">
                <Text className="text-xs text-muted-foreground px-3 pt-2">Minuti</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View className="p-2 gap-1">
                    {minutes.map((value) => (
                      <Pressable
                        key={value}
                        className={`h-10 rounded-lg items-center justify-center ${
                          value === minute ? 'bg-orange-50 border border-orange-200' : 'bg-white'
                        }`}
                        onPress={() => setMinute(value)}
                      >
                        <Text className="font-semibold">{twoDigits(value)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-between mb-3">
            <Pressable
              className="h-10 w-10 rounded-full bg-secondary items-center justify-center"
              onPress={() => setManualMode((prev) => !prev)}
            >
              <FontAwesome name="keyboard-o" size={16} color="#374151" />
            </Pressable>
            <Text className="text-sm text-muted-foreground">
              {twoDigits(hour)}:{twoDigits(minute)}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <Button title={cancelLabel} variant="outline" onPress={onClose} className="flex-1" />
            <Button title={confirmLabel} onPress={handleConfirm} className="flex-1" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
