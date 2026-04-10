import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'it' | 'en';

interface AppSettingsContextType {
  language: AppLanguage;
  deliveryFee: number;
  setLanguage: (language: AppLanguage) => void;
  setDeliveryFee: (fee: number) => void;
}

const LANGUAGE_KEY = 'skibidi_admin_language';
const DELIVERY_FEE_KEY = 'skibidi_delivery_fee_eur';

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

function getStorage(): Storage | null {
  try {
    const globalObject: any = globalThis as any;
    if (globalObject && globalObject.localStorage) {
      return globalObject.localStorage as Storage;
    }
  } catch {
    // Ignore environments without localStorage.
  }
  return null;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('it');
  const [deliveryFee, setDeliveryFeeState] = useState(2);

  useEffect(() => {
    const storage = getStorage();
    if (!storage) return;

    const savedLanguage = storage.getItem(LANGUAGE_KEY);
    const savedFee = storage.getItem(DELIVERY_FEE_KEY);

    if (savedLanguage === 'it' || savedLanguage === 'en') {
      setLanguageState(savedLanguage);
    }

    if (savedFee) {
      const parsed = Number(savedFee);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setDeliveryFeeState(parsed);
      }
    }
  }, []);

  const setLanguage = (next: AppLanguage) => {
    setLanguageState(next);
    const storage = getStorage();
    if (storage) {
      storage.setItem(LANGUAGE_KEY, next);
    }
  };

  const setDeliveryFee = (fee: number) => {
    const normalized = Math.max(0, Number(fee) || 0);
    setDeliveryFeeState(normalized);
    const storage = getStorage();
    if (storage) {
      storage.setItem(DELIVERY_FEE_KEY, String(normalized));
    }
  };

  const value = useMemo(
    () => ({
      language,
      deliveryFee,
      setLanguage,
      setDeliveryFee,
    }),
    [language, deliveryFee]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return context;
}
