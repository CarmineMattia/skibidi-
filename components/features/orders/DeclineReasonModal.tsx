import { FontAwesome } from '@expo/vector-icons';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';

const PRESET_REASONS = [
  'Cucina in ritardo',
  'Ingrediente terminato',
  'Ordine fuori area',
  'Richiesta non disponibile',
] as const;

interface DeclineReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (payload: { preset: string; note: string }) => void;
  isSubmitting?: boolean;
}

export function DeclineReasonModal({ visible, onClose, onConfirm, isSubmitting = false }: DeclineReasonModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_REASONS[0]);
  const [note, setNote] = useState('');
  const canSubmit = useMemo(() => selectedPreset.trim().length > 0, [selectedPreset]);

  const handleConfirm = () => {
    if (!canSubmit || isSubmitting) return;
    onConfirm({ preset: selectedPreset, note: note.trim() });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
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
                  onPress={() => setSelectedPreset(reason)}
                  className={`px-3 py-2 rounded-full border ${selected ? 'bg-orange-600 border-orange-700' : 'bg-orange-50 border-orange-100'}`}
                >
                  <Text className={`text-xs font-bold ${selected ? 'text-white' : 'text-orange-700'}`}>{reason}</Text>
                </Pressable>
              );
            })}
          </View>

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
  );
}
