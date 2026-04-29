export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatChannel = 'text' | 'voice';

export type ChatSuggestedAction = {
  id: string;
  label: string;
  prompt: string;
};

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  text: string;
  createdAt: string;
  isError?: boolean;
};

export type OrderAssistantRequest = {
  text: string;
  conversationId?: string;
  channel: ChatChannel;
  audioMeta?: {
    mimeType?: string;
    durationMs?: number;
  };
};

export type OrderAssistantResponse = {
  conversationId: string;
  assistantText: string;
  suggestedActions?: ChatSuggestedAction[];
};
