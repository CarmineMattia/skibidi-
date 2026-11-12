/**
 * Prototipo locale dell'assistente ordini.
 * Nessuna schermata lo monta e `lib/hooks/index.ts` non esporta l'hook, quindi
 * l'export web di produzione non lo include.
 * Metro (metro.config.js) risolve il modulo di sviluppo su uno stub, salvo
 * EXPO_PUBLIC_ENABLE_ORDER_ASSISTANT=true in un build che non è production.
 * Anche un import diretto non chiama la rete fuori da quel caso.
 * Vedi docs/SECURITY-CHECKLIST.md (prompt injection).
 */
import { OrderAssistantChatDev } from './OrderAssistantChatDev';

const ORDER_ASSISTANT_DEV_ENABLED =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_ENABLE_ORDER_ASSISTANT === 'true';

export function OrderAssistantChat() {
  if (!ORDER_ASSISTANT_DEV_ENABLED) return null;
  return <OrderAssistantChatDev />;
}
