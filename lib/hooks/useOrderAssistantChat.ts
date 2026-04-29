import type {
  ChatMessage,
  ChatSuggestedAction,
  OrderAssistantRequest,
  OrderAssistantResponse,
} from '@/types/chat.types';
import { useCallback, useMemo, useState } from 'react';

const ORDER_ASSISTANT_URL = process.env.EXPO_PUBLIC_ORDER_ASSISTANT_URL || '';

function createMessage(role: ChatMessage['role'], text: string, isError = false): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: new Date().toISOString(),
    isError,
  };
}

export function useOrderAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      'Ciao! Ti aiuto a completare il tuo ordine. Dimmi cosa vuoi mangiare e ti guido passo passo.'
    ),
  ]);
  const [suggestedActions, setSuggestedActions] = useState<ChatSuggestedAction[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const canSend = useMemo(() => Boolean(ORDER_ASSISTANT_URL), []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage = createMessage('user', trimmed);
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      if (!ORDER_ASSISTANT_URL) {
        setMessages((prev) => [
          ...prev,
          createMessage(
            'assistant',
            'Assistente non configurato. Imposta EXPO_PUBLIC_ORDER_ASSISTANT_URL per abilitare la chat.',
            true
          ),
        ]);
        setIsLoading(false);
        return;
      }

      try {
        const payload: OrderAssistantRequest = {
          text: trimmed,
          conversationId,
          channel: 'text',
        };

        const response = await fetch(ORDER_ASSISTANT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as OrderAssistantResponse;
        setConversationId(data.conversationId);
        setSuggestedActions(data.suggestedActions ?? []);
        setMessages((prev) => [...prev, createMessage('assistant', data.assistantText)]);
      } catch (error) {
        console.error('Order assistant error:', error);
        setMessages((prev) => [
          ...prev,
          createMessage('assistant', 'Errore di rete. Riprova tra qualche secondo.', true),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading]
  );

  return {
    messages,
    suggestedActions,
    isLoading,
    canSend,
    sendMessage,
  };
}
