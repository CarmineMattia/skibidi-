const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });

// Prototipo chatbot: nel bundle di produzione, e in dev senza il flag, Metro
// risolve i moduli dell'assistente su uno stub. Il codice vero entra solo con
// EXPO_PUBLIC_ENABLE_ORDER_ASSISTANT=true e un build che non è production.
// Vedi docs/SECURITY-CHECKLIST.md.
const assistantInBundle =
  process.env.EXPO_PUBLIC_ENABLE_ORDER_ASSISTANT === 'true' &&
  process.env.NODE_ENV !== 'production' &&
  process.env.BABEL_ENV !== 'production';

if (!assistantInBundle) {
  const stub = path.resolve(__dirname, 'lib/dev/orderAssistantStub.ts');
  const previous = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const spec = String(moduleName).replace(/\\/g, '/');
    if (
      spec.includes('useOrderAssistantChat') ||
      spec.includes('OrderAssistantChatDev') ||
      spec.includes('server/order-assistant')
    ) {
      return { type: 'sourceFile', filePath: stub };
    }
    if (typeof previous === 'function') return previous(context, moduleName, platform);
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
