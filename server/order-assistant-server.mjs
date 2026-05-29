import 'dotenv/config';
import { createServer } from 'node:http';
import { Agent } from '@cursor/sdk';

const PORT = Number(process.env.ORDER_ASSISTANT_PORT || 8787);
const API_KEY = process.env.CURSOR_API_KEY || '';
const AGENT_CWD = process.env.CURSOR_AGENT_CWD || process.cwd();

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function buildPrompt(text) {
  return [
    'Sei un assistente ordini per una pizzeria italiana.',
    'Aiuta il cliente a scegliere cosa ordinare in modo concreto e breve.',
    'Dai max 3 opzioni e chiudi con una domanda di conferma.',
    `Messaggio cliente: ${text}`,
  ].join('\n');
}

async function getAgent(conversationId) {
  if (typeof conversationId === 'string' && conversationId.trim()) {
    try {
      return await Agent.resume(conversationId, { apiKey: API_KEY });
    } catch {
      // If resume fails (stale/unknown id), start a fresh conversation.
    }
  }
  return Agent.create({
    apiKey: API_KEY,
    model: { id: 'gpt-5.5' },
    local: { cwd: AGENT_CWD },
    name: 'order-assistant',
  });
}

async function resolveAssistantText(run, result) {
  if (result.status === 'finished' && result.result && result.result.trim()) {
    return result.result.trim();
  }

  try {
    const turns = await run.conversation();
    const extracted = [];

    for (const turnEntry of turns) {
      if (turnEntry?.type !== 'agentConversationTurn') continue;
      for (const step of turnEntry.turn?.steps ?? []) {
        if (step?.type === 'assistantMessage' && typeof step.message?.text === 'string') {
          const text = step.message.text.trim();
          if (text) extracted.push(text);
        }
      }
    }

    return extracted.at(-1) || '';
  } catch {
    return '';
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.url !== '/order-assistant' || req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (!API_KEY) {
    sendJson(res, 500, { error: 'CURSOR_API_KEY mancante nel server env' });
    return;
  }

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const body = JSON.parse(raw || '{}');
      const text = String(body?.text || '').trim();
      const conversationId = body?.conversationId;

      if (!text) {
        sendJson(res, 400, { error: 'Campo text obbligatorio' });
        return;
      }

      const agent = await getAgent(conversationId);

      const run = await agent.send(buildPrompt(text), { model: { id: 'gpt-5.5' } });
      const result = await run.wait();
      const assistantText = await resolveAssistantText(run, result);

      const response = {
        conversationId: agent.agentId,
        assistantText: assistantText || 'Non sono riuscito a rispondere, riprova tra poco.',
        suggestedActions: [
          { id: 'bestseller', label: 'Best seller', prompt: 'Consigliami le pizze piu ordinate' },
          { id: 'veg', label: 'Vegetariano', prompt: 'Voglio opzioni vegetariane' },
        ],
      };

      await agent[Symbol.asyncDispose]();
      sendJson(res, 200, response);
    } catch (error) {
      console.error('order-assistant error', error);
      sendJson(res, 500, { error: 'Errore interno server assistente' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Order assistant server running on http://localhost:${PORT}/order-assistant`);
});
