/**
 * Sostituto usato da Metro quando il prototipo dell'assistente non è abilitato.
 * Non fa richieste di rete.
 */
export function OrderAssistantChatDev() {
  return null;
}

export function useOrderAssistantChat() {
  return {
    messages: [] as { id: string; role: string; text: string; createdAt: string; isError?: boolean }[],
    suggestedActions: [] as { id: string; label: string; prompt: string }[],
    isLoading: false,
    canSend: false,
    sendMessage: async (_text: string) => {},
  };
}
