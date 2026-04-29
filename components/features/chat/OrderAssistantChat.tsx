import { useOrderAssistantChat } from '@/lib/hooks/useOrderAssistantChat';
import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const QUICK_PROMPTS = [
  'Consigliami una pizza leggera',
  'Voglio un ordine vegetariano',
  'Quale combo conviene oggi?',
];

export function OrderAssistantChat() {
  const [draft, setDraft] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { messages, suggestedActions, isLoading, canSend, sendMessage } = useOrderAssistantChat();

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await sendMessage(text);
  };

  return (
    <View className="bg-white rounded-2xl border border-orange-100 p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="w-9 h-9 rounded-full bg-orange-100 items-center justify-center">
            <FontAwesome name="comments" size={15} color="#c2410c" />
          </View>
          <View>
            <Text className="text-sm text-gray-500 uppercase font-bold">Assistente ordini</Text>
            <Text className="text-base font-extrabold text-gray-900">Chat rapida per clienti</Text>
          </View>
        </View>
        <Pressable
          onPress={() => setIsOpen((prev) => !prev)}
          className="px-3 py-2 rounded-lg bg-orange-50 border border-orange-200"
        >
          <Text className="text-xs font-bold text-orange-700">{isOpen ? 'Chiudi' : 'Apri chat'}</Text>
        </Pressable>
      </View>

      {!isOpen ? (
        <Text className="text-xs text-gray-600 mt-3">
          Apri la chat per aiutare il cliente a scegliere e completare l&apos;ordine.
        </Text>
      ) : (
        <View className="mt-3 gap-3">
          <View className="max-h-64 gap-2">
            {messages.slice(-6).map((message) => (
              <View
                key={message.id}
                className={`rounded-xl px-3 py-2 border ${
                  message.role === 'user'
                    ? 'self-end bg-orange-50 border-orange-200'
                    : message.isError
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className={`text-sm ${message.isError ? 'text-red-700' : 'text-gray-800'}`}>
                  {message.text}
                </Text>
              </View>
            ))}
            {isLoading && <Text className="text-xs text-gray-500">Assistente sta scrivendo...</Text>}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => void sendMessage(prompt)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50"
              >
                <Text className="text-xs text-gray-700">{prompt}</Text>
              </Pressable>
            ))}
            {suggestedActions.map((action) => (
              <Pressable
                key={action.id}
                onPress={() => void sendMessage(action.prompt)}
                className="px-2.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50"
              >
                <Text className="text-xs text-orange-700">{action.label}</Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Scrivi il messaggio del cliente..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
              editable={!isLoading}
            />
            <Pressable
              onPress={() => void handleSend()}
              disabled={isLoading || !canSend}
              className={`px-3 py-2 rounded-xl ${isLoading || !canSend ? 'bg-gray-300' : 'bg-orange-600'}`}
            >
              <Text className="text-xs font-bold text-white">Invia</Text>
            </Pressable>
            <Pressable
              disabled
              className="px-3 py-2 rounded-xl bg-gray-100 border border-gray-200"
            >
              <FontAwesome name="microphone" size={14} color="#6b7280" />
            </Pressable>
          </View>
          <Text className="text-[11px] text-gray-500">
            Microfono in arrivo: architettura pronta per messaggi vocali in Fase 2.
          </Text>
        </View>
      )}
    </View>
  );
}
