import { Agent } from '@cursor/sdk';
import type { OrderAssistantRequest, OrderAssistantResponse } from '@/types/chat.types';

type JsonResponse = {
  status: number;
  body: OrderAssistantResponse | { error: string };
};

type AssistantStep = {
  type: string;
  message?: { text?: string };
};

type AgentConversationTurn = {
  type: string;
  turn: {
    steps: AssistantStep[];
  };
};

const API_KEY = process.env.CURSOR_API_KEY || '';
const LOCAL_WORKDIR = process.env.CURSOR_AGENT_CWD || process.cwd();

function buildPrompt(input: string) {
  return [
    'Sei un assistente ordini per una pizzeria italiana.',
    'Obiettivo: aiutare il cliente a scegliere piatti e chiudere l ordine in modo chiaro e breve.',
    'Regole: proponi max 3 opzioni, chiedi conferma finale, usa tono gentile.',
    `Messaggio cliente: ${input}`,
  ].join('\n');
}

async function getAgent(conversationId?: string) {
  if (conversationId && conversationId.trim()) {
    try {
      return await Agent.resume(conversationId, { apiKey: API_KEY });
    } catch {
      // If conversation cannot be resumed, fallback to a new agent.
    }
  }
  return Agent.create({
    apiKey: API_KEY,
    model: { id: 'gpt-5.5' },
    local: { cwd: LOCAL_WORKDIR },
    name: 'order-assistant',
  });
}

async function resolveAssistantText(run: any) {
  const result = await run.wait();
  if (result.status === 'finished' && result.result?.trim()) {
    return result.result.trim();
  }

  try {
    const turns = await run.conversation();
    const extracted: string[] = [];

    turns.forEach((turnEntry: AgentConversationTurn) => {
      if (turnEntry.type !== 'agentConversationTurn') return;
      turnEntry.turn.steps.forEach((step: AssistantStep) => {
        if (step.type === 'assistantMessage' && typeof step.message?.text === 'string') {
          const text = step.message.text.trim();
          if (text) extracted.push(text);
        }
      });
    });

    return extracted.at(-1) ?? '';
  } catch {
    return '';
  }
}

export async function handleOrderAssistant(payload: OrderAssistantRequest): Promise<JsonResponse> {
  if (!API_KEY) {
    return { status: 500, body: { error: 'CURSOR_API_KEY non configurata sul server' } };
  }

  const text = payload.text?.trim();
  if (!text) {
    return { status: 400, body: { error: 'Campo text obbligatorio' } };
  }

  try {
    const agent = await getAgent(payload.conversationId);

    const run = await agent.send(buildPrompt(text), { model: { id: 'gpt-5.5' } });
    const assistantText = await resolveAssistantText(run);
    await agent[Symbol.asyncDispose]();

    if (!assistantText) {
      return { status: 502, body: { error: 'Risposta assistente non disponibile' } };
    }

    return {
      status: 200,
      body: {
        conversationId: agent.agentId,
        assistantText,
        suggestedActions: [
          { id: 'menu', label: 'Apri menu', prompt: 'Fammi vedere opzioni del menu piu vendute' },
          { id: 'veg', label: 'Opzioni vegetariane', prompt: 'Consigliami opzioni vegetariane' },
        ],
      },
    };
  } catch (error) {
    console.error('order assistant failure', error);
    return { status: 500, body: { error: 'Errore interno assistente ordini' } };
  }
}

export async function orderAssistantHttpHandler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = (await request.json()) as OrderAssistantRequest;
  const outcome = await handleOrderAssistant(payload);
  return new Response(JSON.stringify(outcome.body), {
    status: outcome.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
