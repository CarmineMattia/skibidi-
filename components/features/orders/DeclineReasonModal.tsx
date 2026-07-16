import { TimeWheelModal } from '@/components/ui/TimeWheelModal';
import { buildRescheduleNote } from '@/lib/utils/orderDecline';
import { FontAwesome } from '@expo/vector-icons';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';

const PRESET_REASONS = [
  'Cucina in ritardo',
  'Ingrediente terminato',
  'Ordine fuori area',
  'Richiesta non disponibile',
  'Ripianifica ordine',
] as const;

const RESCHEDULE_PRESET = 'Ripianifica ordine';

interface DeclineReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (payload: { preset: string; note: string }) => void;
  isSubmitting?: boolean;
}

function buildRescheduleIso(hour: number, minute: number): string {
  const target = new Date();
  target.setSeconds(0, 0);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString();
}

export function DeclineReasonModal({ visible, onClose, onConfirm, isSubmitting = false }: DeclineReasonModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_REASONS[0]);
  const [note, setNote] = useState('');
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [rescheduleLabel, setRescheduleLabel] = useState<string | null>(null);
  const [rescheduleIso, setRescheduleIso] = useState<string | null>(null);
  const requiresReschedule = selectedPreset === RESCHEDULE_PRESET;
  const canSubmit = useMemo(
    () => selectedPreset.trim().length > 0 && (!requiresReschedule || Boolean(rescheduleIso)),
    [requiresReschedule, rescheduleIso, selectedPreset]
  );

  const handleConfirm = () => {
    if (!canSubmit || isSubmitting) return;
    const finalNote = requiresReschedule && rescheduleIso
      ? buildRescheduleNote(rescheduleIso, note)
      : note.trim();
    onConfirm({ preset: selectedPreset, note: finalNote });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handlePresetSelect = (reason: string) => {
    setSelectedPreset(reason);
    if (reason !== RESCHEDULE_PRESET) {
      setRescheduleIso(null);
      setRescheduleLabel(null);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <View className="flex-1 bg-black/45 justify-center items-center p-5">
          <View className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-extrabold text-gray-900">Rifiuta ordine</Text>
              <Pressable onPress={handleClose} disabled={isSubmitting}>
                <FontAwesome name="times" size={20} color="#6b7280" />
              </Pressable>
            </View>

            <Text className="text-sm font-semibold text-gray-700 mb-2">Motivo rapido</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {PRESET_REASONS.map((reason) => {
                const selected = selectedPreset === reason;
                return (
                  <Pressable
                    key={reason}
                    onPress={() => handlePresetSelect(reason)}
                    className={`px-3 py-2 rounded-full border ${selected ? 'bg-[#8d171e] border-[#8d171e]' : 'bg-[#f9ecdd] border-[#e1a255]/40'}`}
                  >
                    <Text className={`text-xs font-bold ${selected ? 'text-white' : 'text-[#8d171e]'}`}>{reason}</Text>
                  </Pressable>
                );
              })}
            </View>

            {requiresReschedule ? (
              <View className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <Text className="text-sm font-semibold text-amber-900 mb-2">Nuovo orario proposto al cliente</Text>
                <Pressable
                  className="h-11 rounded-xl bg-white border border-amber-300 items-center justify-center"
                  onPress={() => setShowReschedulePicker(true)}
                  disabled={isSubmitting}
                >
                  <Text className="font-bold text-amber-900">
                    {rescheduleLabel || 'Scegli orario di ripianificazione'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Text className="text-sm font-semibold text-gray-700 mb-2">Nota (opzionale)</Text>
            <TextInput
              multiline
              numberOfLines={3}
              className="min-h-[82px] rounded-xl border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="Aggiungi dettagli per staff/cliente..."
              value={note}
              onChangeText={setNote}
              editable={!isSubmitting}
            />

            <View className="flex-row gap-2 mt-5">
              <Pressable
                className="flex-1 h-11 rounded-xl border border-gray-300 items-center justify-center"
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Text className="font-bold text-gray-700">Annulla</Text>
              </Pressable>
              <Pressable
                className={`flex-1 h-11 rounded-xl items-center justify-center ${canSubmit ? 'bg-red-600' : 'bg-red-300'}`}
                onPress={handleConfirm}
                disabled={!canSubmit || isSubmitting}
              >
                <Text className="font-bold text-white">{isSubmitting ? 'Invio...' : 'Conferma rifiuto'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <TimeWheelModal
        visible={showReschedulePicker}
        title="Ripianifica ordine"
        confirmLabel="Usa questo orario"
        initialHour={new Date().getHours()}
        initialMinute={Math.min(55, Math.ceil(new Date().getMinutes() / 5) * 5)}
        minuteStep={5}
        onClose={() => setShowReschedulePicker(false)}
        onConfirm={(hour, minute) => {
          const iso = buildRescheduleIso(hour, minute);
          const labelDate = new Date(iso);
          setRescheduleIso(iso);
          setRescheduleLabel(
            labelDate.toLocaleString('it-IT', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          );
          setShowReschedulePicker(false);
        }}
      />
    </>
  );
}
