import { supabase } from '@/lib/api/supabase';
import type { BusinessHoursDay, BusinessHoursInterval, WeeklyBusinessHours } from '@/lib/utils/businessHours';
import { useTenant } from '@/lib/stores/TenantContext';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'it' | 'en';
type UpdateSource = 'local' | 'remote';
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface OrderCapacitySettings {
  acceptingOrders: boolean;
  ordersPausedUntil: string | null;
  maxOrdersPerWindow: number;
  orderWindowMinutes: number;
  deliveryMaxOrdersPerWindow: number;
  deliveryOrderWindowMinutes: number;
  disabledTimeSlots: string[];
  businessHours: WeeklyBusinessHours;
}

interface AlertSoundSettings {
  enabled: boolean;
  newOrderSoundUrl: string | null;
  orderReadySoundUrl: string | null;
}

interface AppSettingsContextType {
  language: AppLanguage;
  deliveryFee: number;
  acceptingOrders: boolean;
  ordersPausedUntil: string | null;
  maxOrdersPerWindow: number;
  orderWindowMinutes: number;
  deliveryMaxOrdersPerWindow: number;
  deliveryOrderWindowMinutes: number;
  disabledTimeSlots: string[];
  businessHours: WeeklyBusinessHours;
  alertSounds: AlertSoundSettings;
  setLanguage: (language: AppLanguage) => void;
  setDeliveryFee: (fee: number) => void;
  setAcceptingOrders: (value: boolean) => void;
  pauseOrdersForMinutes: (minutes: number) => void;
  resumeOrders: () => void;
  setMaxOrdersPerWindow: (value: number) => void;
  setOrderWindowMinutes: (value: number) => void;
  setDeliveryMaxOrdersPerWindow: (value: number) => void;
  setDeliveryOrderWindowMinutes: (value: number) => void;
  addDisabledTimeSlot: (slot: string) => void;
  removeDisabledTimeSlot: (slot: string) => void;
  clearDisabledTimeSlots: () => void;
  setBusinessDayEnabled: (dayIndex: number, enabled: boolean) => void;
  setBusinessDayIntervals: (dayIndex: number, intervals: BusinessHoursInterval[]) => void;
  setAlertSoundsEnabled: (value: boolean) => void;
  setNewOrderSoundUrl: (url: string | null) => void;
  setOrderReadySoundUrl: (url: string | null) => void;
}

const LANGUAGE_KEY = 'skibidi_admin_language';
const DELIVERY_FEE_KEY = 'skibidi_delivery_fee_eur';
const ORDER_SETTINGS_KEY = 'skibidi_order_capacity_settings';
const ALERT_SOUND_SETTINGS_KEY = 'skibidi_alert_sound_settings';
export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'] as const;

function buildDefaultBusinessHours(): WeeklyBusinessHours {
  return Array.from({ length: 7 }, () => ({
    enabled: true,
    intervals: [{ start: '00:00', end: '23:59' }],
  }));
}

const DEFAULT_ORDER_SETTINGS: OrderCapacitySettings = {
  acceptingOrders: true,
  ordersPausedUntil: null,
  maxOrdersPerWindow: 8,
  orderWindowMinutes: 10,
  deliveryMaxOrdersPerWindow: 8,
  deliveryOrderWindowMinutes: 10,
  disabledTimeSlots: [],
  businessHours: buildDefaultBusinessHours(),
};

const DEFAULT_ALERT_SOUND_SETTINGS: AlertSoundSettings = {
  enabled: true,
  newOrderSoundUrl: null,
  orderReadySoundUrl: null,
};

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

function normalizeSlot(slot: string): string | null {
  const trimmed = slot.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const [hoursString, minutesString] = trimmed.split(':');
  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function slotToMinutes(slot: string): number {
  const [hoursString, minutesString] = slot.split(':');
  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function sortBusinessIntervals(intervals: BusinessHoursInterval[]): BusinessHoursInterval[] {
  return [...intervals].sort((a, b) => slotToMinutes(a.start) - slotToMinutes(b.start));
}

function parseOrderSettings(raw: unknown): OrderCapacitySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_ORDER_SETTINGS;
  const source = raw as Partial<OrderCapacitySettings>;

  const normalizedSlots = Array.isArray(source.disabledTimeSlots)
    ? source.disabledTimeSlots
        .map((slot) => (typeof slot === 'string' ? normalizeSlot(slot) : null))
        .filter((slot): slot is string => Boolean(slot))
    : [];

  const maxOrders =
    typeof source.maxOrdersPerWindow === 'number' && Number.isFinite(source.maxOrdersPerWindow)
      ? Math.max(1, Math.floor(source.maxOrdersPerWindow))
      : DEFAULT_ORDER_SETTINGS.maxOrdersPerWindow;
  const windowMinutes =
    typeof source.orderWindowMinutes === 'number' && Number.isFinite(source.orderWindowMinutes)
      ? Math.max(5, Math.floor(source.orderWindowMinutes))
      : DEFAULT_ORDER_SETTINGS.orderWindowMinutes;
  const deliveryMaxOrders =
    typeof source.deliveryMaxOrdersPerWindow === 'number' && Number.isFinite(source.deliveryMaxOrdersPerWindow)
      ? Math.max(1, Math.floor(source.deliveryMaxOrdersPerWindow))
      : DEFAULT_ORDER_SETTINGS.deliveryMaxOrdersPerWindow;
  const deliveryWindowMinutes =
    typeof source.deliveryOrderWindowMinutes === 'number' && Number.isFinite(source.deliveryOrderWindowMinutes)
      ? Math.max(5, Math.floor(source.deliveryOrderWindowMinutes))
      : DEFAULT_ORDER_SETTINGS.deliveryOrderWindowMinutes;
  const pausedUntil =
    typeof source.ordersPausedUntil === 'string' && source.ordersPausedUntil.trim().length > 0
      ? source.ordersPausedUntil
      : null;

  const rawBusinessHours = Array.isArray(source.businessHours) ? source.businessHours : [];
  const businessHours: WeeklyBusinessHours = Array.from({ length: 7 }, (_, dayIndex) => {
    const entry = rawBusinessHours[dayIndex] as Partial<BusinessHoursDay> | undefined;
    const enabled = typeof entry?.enabled === 'boolean' ? entry.enabled : true;
    const hasIntervals = Array.isArray(entry?.intervals);
    const rawIntervals: unknown[] = hasIntervals ? entry?.intervals ?? [] : [];
    const intervals = hasIntervals
      ? rawIntervals
          .map((interval) => {
            if (!interval || typeof interval !== 'object') return null;
            const typedInterval = interval as { start?: unknown; end?: unknown };
            const start = typeof typedInterval.start === 'string' ? normalizeSlot(typedInterval.start) : null;
            const end = typeof typedInterval.end === 'string' ? normalizeSlot(typedInterval.end) : null;
            if (!start || !end) return null;
            return { start, end };
          })
          .filter((interval): interval is BusinessHoursInterval => Boolean(interval))
      : [];

    return {
      enabled,
      intervals: hasIntervals ? sortBusinessIntervals(intervals) : [{ start: '00:00', end: '23:59' }],
    };
  });

  return {
    acceptingOrders: typeof source.acceptingOrders === 'boolean' ? source.acceptingOrders : DEFAULT_ORDER_SETTINGS.acceptingOrders,
    ordersPausedUntil: pausedUntil,
    maxOrdersPerWindow: maxOrders,
    orderWindowMinutes: windowMinutes,
    deliveryMaxOrdersPerWindow: deliveryMaxOrders,
    deliveryOrderWindowMinutes: deliveryWindowMinutes,
    disabledTimeSlots: Array.from(new Set(normalizedSlots)).sort(),
    businessHours,
  };
}

function parseAlertSoundSettings(raw: unknown): AlertSoundSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_ALERT_SOUND_SETTINGS;
  const source = raw as Partial<AlertSoundSettings>;
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_ALERT_SOUND_SETTINGS.enabled,
    newOrderSoundUrl:
      typeof source.newOrderSoundUrl === 'string' && source.newOrderSoundUrl.trim().length > 0
        ? source.newOrderSoundUrl
        : null,
    orderReadySoundUrl:
      typeof source.orderReadySoundUrl === 'string' && source.orderReadySoundUrl.trim().length > 0
        ? source.orderReadySoundUrl
        : null,
  };
}

function asCompanySettingsJson(value: Record<string, unknown>): JsonValue {
  return value as unknown as JsonValue;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { companyId } = useTenant();
  const [language, setLanguageState] = useState<AppLanguage>('it');
  const [deliveryFee, setDeliveryFeeState] = useState(2);
  const [orderSettings, setOrderSettings] = useState<OrderCapacitySettings>(DEFAULT_ORDER_SETTINGS);
  const [alertSounds, setAlertSounds] = useState<AlertSoundSettings>(DEFAULT_ALERT_SOUND_SETTINGS);

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

    const savedOrderSettings = storage.getItem(ORDER_SETTINGS_KEY);
    if (savedOrderSettings) {
      try {
        const parsed = JSON.parse(savedOrderSettings);
        setOrderSettings(parseOrderSettings(parsed));
      } catch {
        setOrderSettings(DEFAULT_ORDER_SETTINGS);
      }
    }
    const savedAlertSettings = storage.getItem(ALERT_SOUND_SETTINGS_KEY);
    if (savedAlertSettings) {
      try {
        const parsed = JSON.parse(savedAlertSettings);
        setAlertSounds(parseAlertSoundSettings(parsed));
      } catch {
        setAlertSounds(DEFAULT_ALERT_SOUND_SETTINGS);
      }
    }
  }, []);

  useEffect(() => {
    if (!companyId) return;

    const fetchCompanySettings = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('settings')
          .eq('id', companyId)
          .single();

        if (error || !data) return;
        const rawSettings = (data.settings ?? {}) as {
          checkoutLanguage?: AppLanguage;
          deliveryFeeEur?: number;
          orderCapacity?: OrderCapacitySettings;
          alerts?: AlertSoundSettings;
        };

        if (rawSettings.checkoutLanguage === 'it' || rawSettings.checkoutLanguage === 'en') {
          setLanguageState(rawSettings.checkoutLanguage);
        }
        if (typeof rawSettings.deliveryFeeEur === 'number' && rawSettings.deliveryFeeEur >= 0) {
          setDeliveryFeeState(rawSettings.deliveryFeeEur);
        }
        if (rawSettings.orderCapacity) {
          setOrderSettings(parseOrderSettings(rawSettings.orderCapacity));
        }
        if (rawSettings.alerts) {
          setAlertSounds(parseAlertSoundSettings(rawSettings.alerts));
        }
      } catch {
        // Ignore remote sync failures and keep local settings.
      }
    };

    void fetchCompanySettings();
  }, [companyId]);

  const persistOrderSettings = (nextSettings: OrderCapacitySettings, source: UpdateSource) => {
    setOrderSettings(nextSettings);
    const storage = getStorage();
    if (storage) {
      storage.setItem(ORDER_SETTINGS_KEY, JSON.stringify(nextSettings));
    }
    if (source === 'remote' || !companyId) return;

    void (async () => {
      const { data } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', companyId)
        .single();

      const previousSettings =
        data && typeof data.settings === 'object' && data.settings !== null
          ? (data.settings as Record<string, unknown>)
          : {};

      const mergedSettings = {
        ...previousSettings,
        orderCapacity: nextSettings,
      };

      await supabase
        .from('companies')
        .update({ settings: asCompanySettingsJson(mergedSettings) })
        .eq('id', companyId);
    })();
  };

  const persistAlertSoundSettings = (nextSettings: AlertSoundSettings, source: UpdateSource) => {
    setAlertSounds(nextSettings);
    const storage = getStorage();
    if (storage) {
      storage.setItem(ALERT_SOUND_SETTINGS_KEY, JSON.stringify(nextSettings));
    }
    if (source === 'remote' || !companyId) return;

    void (async () => {
      const { data } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', companyId)
        .single();

      const previousSettings =
        data && typeof data.settings === 'object' && data.settings !== null
          ? (data.settings as Record<string, unknown>)
          : {};

      const mergedSettings = {
        ...previousSettings,
        alerts: nextSettings,
      };

      await supabase
        .from('companies')
        .update({ settings: asCompanySettingsJson(mergedSettings) })
        .eq('id', companyId);
    })();
  };

  const setLanguage = (next: AppLanguage) => {
    setLanguageState(next);
    const storage = getStorage();
    if (storage) {
      storage.setItem(LANGUAGE_KEY, next);
    }
    if (companyId) {
      void (async () => {
        const { data } = await supabase
          .from('companies')
          .select('settings')
          .eq('id', companyId)
          .single();
        const previousSettings =
          data && typeof data.settings === 'object' && data.settings !== null
            ? (data.settings as Record<string, unknown>)
            : {};
        await supabase
          .from('companies')
          .update({ settings: asCompanySettingsJson({ ...previousSettings, checkoutLanguage: next }) })
          .eq('id', companyId);
      })();
    }
  };

  const setDeliveryFee = (fee: number) => {
    const normalized = Math.max(0, Number(fee) || 0);
    setDeliveryFeeState(normalized);
    const storage = getStorage();
    if (storage) {
      storage.setItem(DELIVERY_FEE_KEY, String(normalized));
    }
    if (companyId) {
      void (async () => {
        const { data } = await supabase
          .from('companies')
          .select('settings')
          .eq('id', companyId)
          .single();
        const previousSettings =
          data && typeof data.settings === 'object' && data.settings !== null
            ? (data.settings as Record<string, unknown>)
            : {};
        await supabase
          .from('companies')
          .update({ settings: asCompanySettingsJson({ ...previousSettings, deliveryFeeEur: normalized }) })
          .eq('id', companyId);
      })();
    }
  };

  const setAcceptingOrders = (value: boolean) => {
    persistOrderSettings(
      {
        ...orderSettings,
        acceptingOrders: value,
        ordersPausedUntil: value ? null : orderSettings.ordersPausedUntil,
      },
      'local'
    );
  };

  const pauseOrdersForMinutes = (minutes: number) => {
    const normalized = Math.max(1, Math.floor(Number(minutes) || 0));
    const pausedUntil = new Date(Date.now() + normalized * 60_000).toISOString();
    persistOrderSettings(
      {
        ...orderSettings,
        acceptingOrders: false,
        ordersPausedUntil: pausedUntil,
      },
      'local'
    );
  };

  const resumeOrders = () => {
    persistOrderSettings(
      {
        ...orderSettings,
        acceptingOrders: true,
        ordersPausedUntil: null,
      },
      'local'
    );
  };

  const setMaxOrdersPerWindow = (value: number) => {
    persistOrderSettings(
      {
        ...orderSettings,
        maxOrdersPerWindow: Math.max(1, Math.floor(Number(value) || 1)),
      },
      'local'
    );
  };

  const setOrderWindowMinutes = (value: number) => {
    persistOrderSettings(
      {
        ...orderSettings,
        orderWindowMinutes: Math.max(5, Math.floor(Number(value) || 5)),
      },
      'local'
    );
  };

  const setDeliveryMaxOrdersPerWindow = (value: number) => {
    persistOrderSettings(
      {
        ...orderSettings,
        deliveryMaxOrdersPerWindow: Math.max(1, Math.floor(Number(value) || 1)),
      },
      'local'
    );
  };

  const setDeliveryOrderWindowMinutes = (value: number) => {
    persistOrderSettings(
      {
        ...orderSettings,
        deliveryOrderWindowMinutes: Math.max(5, Math.floor(Number(value) || 5)),
      },
      'local'
    );
  };

  const addDisabledTimeSlot = (slot: string) => {
    const normalized = normalizeSlot(slot);
    if (!normalized) return;
    if (orderSettings.disabledTimeSlots.includes(normalized)) return;
    persistOrderSettings(
      {
        ...orderSettings,
        disabledTimeSlots: [...orderSettings.disabledTimeSlots, normalized].sort(),
      },
      'local'
    );
  };

  const removeDisabledTimeSlot = (slot: string) => {
    persistOrderSettings(
      {
        ...orderSettings,
        disabledTimeSlots: orderSettings.disabledTimeSlots.filter((existing) => existing !== slot),
      },
      'local'
    );
  };

  const clearDisabledTimeSlots = () => {
    persistOrderSettings(
      {
        ...orderSettings,
        disabledTimeSlots: [],
      },
      'local'
    );
  };

  const setBusinessDayEnabled = (dayIndex: number, enabled: boolean) => {
    if (dayIndex < 0 || dayIndex > 6) return;
    const next = [...orderSettings.businessHours];
    next[dayIndex] = {
      ...next[dayIndex],
      enabled,
      intervals: enabled ? next[dayIndex].intervals : [],
    };
    persistOrderSettings(
      {
        ...orderSettings,
        businessHours: next,
      },
      'local'
    );
  };

  const setBusinessDayIntervals = (dayIndex: number, intervals: BusinessHoursInterval[]) => {
    if (dayIndex < 0 || dayIndex > 6) return;
    const normalized = intervals
      .map((interval) => {
        const start = normalizeSlot(interval.start);
        const end = normalizeSlot(interval.end);
        if (!start || !end) return null;
        return { start, end };
      })
      .filter((interval): interval is BusinessHoursInterval => Boolean(interval));
    const sorted = sortBusinessIntervals(normalized);

    const next = [...orderSettings.businessHours];
    next[dayIndex] = {
      ...next[dayIndex],
      intervals: sorted,
    };

    persistOrderSettings(
      {
        ...orderSettings,
        businessHours: next,
      },
      'local'
    );
  };

  const setAlertSoundsEnabled = (value: boolean) => {
    persistAlertSoundSettings(
      {
        ...alertSounds,
        enabled: value,
      },
      'local'
    );
  };

  const setNewOrderSoundUrl = (url: string | null) => {
    persistAlertSoundSettings(
      {
        ...alertSounds,
        newOrderSoundUrl: url,
      },
      'local'
    );
  };

  const setOrderReadySoundUrl = (url: string | null) => {
    persistAlertSoundSettings(
      {
        ...alertSounds,
        orderReadySoundUrl: url,
      },
      'local'
    );
  };

  const value = useMemo(
    () => ({
      language,
      deliveryFee,
      acceptingOrders: orderSettings.acceptingOrders,
      ordersPausedUntil: orderSettings.ordersPausedUntil,
      maxOrdersPerWindow: orderSettings.maxOrdersPerWindow,
      orderWindowMinutes: orderSettings.orderWindowMinutes,
      deliveryMaxOrdersPerWindow: orderSettings.deliveryMaxOrdersPerWindow,
      deliveryOrderWindowMinutes: orderSettings.deliveryOrderWindowMinutes,
      disabledTimeSlots: orderSettings.disabledTimeSlots,
      businessHours: orderSettings.businessHours,
      alertSounds,
      setLanguage,
      setDeliveryFee,
      setAcceptingOrders,
      pauseOrdersForMinutes,
      resumeOrders,
      setMaxOrdersPerWindow,
      setOrderWindowMinutes,
      setDeliveryMaxOrdersPerWindow,
      setDeliveryOrderWindowMinutes,
      addDisabledTimeSlot,
      removeDisabledTimeSlot,
      clearDisabledTimeSlots,
      setBusinessDayEnabled,
      setBusinessDayIntervals,
      setAlertSoundsEnabled,
      setNewOrderSoundUrl,
      setOrderReadySoundUrl,
    }),
    [language, deliveryFee, orderSettings, alertSounds]
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
