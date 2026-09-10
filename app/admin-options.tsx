import { Button } from '@/components/ui/Button';
import { SkeletonShiftDoughStats } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/api/supabase';
import { TimeWheelModal } from '@/components/ui/TimeWheelModal';
import { useShiftDoughUsage } from '@/lib/hooks/useShiftDoughUsage';
import { WEEKDAY_LABELS, useAppSettings, type AppLanguage } from '@/lib/stores/AppSettingsContext';
import { useAuth } from '@/lib/stores/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { BusinessHoursInterval } from '@/lib/utils/businessHours';

export default function AdminOptionsScreen() {
  const { isAdmin, isKioskMode, enterKioskMode, exitKioskMode, isLoading: isAuthLoading } = useAuth();
  const {
    language,
    deliveryFee,
    acceptingOrders,
    ordersPausedUntil,
    maxOrdersPerWindow,
    orderWindowMinutes,
    deliveryMaxOrdersPerWindow,
    deliveryOrderWindowMinutes,
    disabledTimeSlots,
    businessHours,
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
    shiftDoughBallsTotal,
    shiftStartedAt,
    setShiftDoughBallsTotal,
    resetShiftDoughTracking,
    clearShiftDoughTracking,
    setAlertSoundsEnabled,
    setNewOrderSoundUrl,
    setOrderReadySoundUrl,
  } = useAppSettings();
  const router = useRouter();
  const [pauseMinutesInput, setPauseMinutesInput] = useState('30');
  const [slotInput, setSlotInput] = useState('');
  const [showPausePicker, setShowPausePicker] = useState(false);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [showBusinessIntervalPicker, setShowBusinessIntervalPicker] = useState(false);
  const [isUploadingSound, setIsUploadingSound] = useState(false);
  const [businessPickerDayIndex, setBusinessPickerDayIndex] = useState<number>(1);
  const [businessPickerPhase, setBusinessPickerPhase] = useState<'start' | 'end'>('start');
  const [businessPickerStart, setBusinessPickerStart] = useState<{ hour: number; minute: number }>({ hour: 12, minute: 0 });
  const [businessPickerEnd, setBusinessPickerEnd] = useState<{ hour: number; minute: number }>({ hour: 14, minute: 0 });
  const [isBusinessHoursCollapsed, setIsBusinessHoursCollapsed] = useState(false);
  const [orderCapacityInput, setOrderCapacityInput] = useState(String(maxOrdersPerWindow));
  const [deliveryCapacityInput, setDeliveryCapacityInput] = useState(String(deliveryMaxOrdersPerWindow));
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(deliveryFee.toFixed(2));
  const [deliveryFeeSavedFlash, setDeliveryFeeSavedFlash] = useState(false);
  const [capacitySavedFlash, setCapacitySavedFlash] = useState(false);
  const [shiftDoughInput, setShiftDoughInput] = useState(
    shiftDoughBallsTotal !== null ? String(shiftDoughBallsTotal) : ''
  );
  const [shiftDoughSavedFlash, setShiftDoughSavedFlash] = useState(false);
  const {
    usedUnits: shiftUsedUnits,
    remainingUnits: shiftRemainingUnits,
    isTrackingEnabled: isShiftTrackingEnabled,
    isRpcMissing: isShiftUsageRpcMissing,
    hasTrackingError: hasShiftUsageError,
    isLoading: isShiftUsageLoading,
    refetch: refetchShiftUsage,
  } = useShiftDoughUsage({
    shiftStartedAt,
    shiftDoughBallsTotal,
  });
  const pauseDescription = useMemo(() => {
    if (!ordersPausedUntil) return null;
    const pausedDate = new Date(ordersPausedUntil);
    if (Number.isNaN(pausedDate.getTime())) return null;
    return pausedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }, [ordersPausedUntil]);
  const isKitchenClosed = !acceptingOrders || (ordersPausedUntil ? new Date(ordersPausedUntil).getTime() > Date.now() : false);

  useEffect(() => {
    setOrderCapacityInput(String(maxOrdersPerWindow));
  }, [maxOrdersPerWindow]);

  useEffect(() => {
    setDeliveryCapacityInput(String(deliveryMaxOrdersPerWindow));
  }, [deliveryMaxOrdersPerWindow]);

  useEffect(() => {
    setDeliveryFeeInput(deliveryFee.toFixed(2));
  }, [deliveryFee]);

  useEffect(() => {
    setShiftDoughInput(shiftDoughBallsTotal !== null ? String(shiftDoughBallsTotal) : '');
  }, [shiftDoughBallsTotal]);

  // Una sola durata fascia: allinea eventuali valori legacy diversi.
  useEffect(() => {
    if (deliveryOrderWindowMinutes !== orderWindowMinutes) {
      setDeliveryOrderWindowMinutes(orderWindowMinutes);
    }
  }, [deliveryOrderWindowMinutes, orderWindowMinutes, setDeliveryOrderWindowMinutes]);

  const shiftStartedLabel = useMemo(() => {
    if (!shiftStartedAt) return null;
    const startedAt = new Date(shiftStartedAt);
    if (Number.isNaN(startedAt.getTime())) return null;
    return startedAt.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, [shiftStartedAt]);

  // Se qualcuno arriva qui senza permessi admin, rimandiamo al menu principale.
  // Done in an effect (not during render) so web deep links don't throw
  // "Attempted to navigate before mounting the Root Layout component".
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAdmin) {
      router.replace('/(tabs)/menu');
    }
  }, [isAdmin, isAuthLoading, router]);

  if (!isAdmin) {
    return null;
  }

  const handleToggleKiosk = () => {
    if (isKioskMode) {
      exitKioskMode();
      Alert.alert('Modalità Kiosk disattivata', 'L\'app è tornata alla modalità normale.');
    } else {
      enterKioskMode();
      Alert.alert(
        'Modalità Kiosk attivata',
        'Questo dispositivo ora è configurato come kiosk. Per tornare alla modalità normale, disattiva la modalità dalle opzioni.'
      );
    }
  };

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    Alert.alert(
      nextLanguage === 'it' ? 'Lingua aggiornata' : 'Language updated',
      nextLanguage === 'it'
        ? 'L interfaccia checkout usera l italiano.'
        : 'Checkout interface will use English.'
    );
  };

  const sanitizeDeliveryFeeInput = (raw: string): string => {
    // Allow digits + one decimal separator while typing (comma or dot).
    const normalized = raw.replace(',', '.');
    const cleaned = normalized.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
  };

  const commitDeliveryFee = (raw = deliveryFeeInput) => {
    const normalized = raw.replace(',', '.').trim();
    if (normalized === '' || normalized === '.') {
      setDeliveryFeeInput(deliveryFee.toFixed(2));
      return;
    }
    const parsed = Number(normalized);
    if (Number.isNaN(parsed) || parsed < 0) {
      Alert.alert('Valore non valido', 'Inserisci un importo delivery valido, ad esempio 2.50');
      setDeliveryFeeInput(deliveryFee.toFixed(2));
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    setDeliveryFee(rounded);
    setDeliveryFeeInput(rounded.toFixed(2));
    setDeliveryFeeSavedFlash(true);
    setTimeout(() => setDeliveryFeeSavedFlash(false), 1800);
  };

  const nudgeDeliveryFee = (delta: number) => {
    const current = Number(deliveryFeeInput.replace(',', '.'));
    const base = Number.isFinite(current) ? current : deliveryFee;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setDeliveryFeeInput(next.toFixed(2));
    setDeliveryFee(next);
    setDeliveryFeeSavedFlash(true);
    setTimeout(() => setDeliveryFeeSavedFlash(false), 1800);
  };

  const handlePauseOrders = () => {
    const parsed = Number(pauseMinutesInput.replaceAll(/\D/g, ''));
    if (!parsed || parsed < 1) {
      Alert.alert('Valore non valido', 'Inserisci un numero di minuti valido.');
      return;
    }
    pauseOrdersForMinutes(parsed);
    Alert.alert('Ordini in pausa', `Nuovi ordini bloccati per ${parsed} minuti.`);
  };

  const getDurationParts = (minutes: number): { hour: number; minute: number } => ({
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
  });

  const handleAddDisabledSlot = () => {
    const normalized = slotInput.trim();
    if (!/^\d{2}:\d{2}$/.test(normalized)) {
      Alert.alert('Formato non valido', 'Usa il formato HH:mm, ad esempio 19:30.');
      return;
    }
    addDisabledTimeSlot(normalized);
    setSlotInput('');
  };

  const sanitizeNumericInput = (value: string): string => value.replaceAll(/\D/g, '');

  const WINDOW_MINUTE_PRESETS = [5, 10, 15, 20] as const;

  const flashCapacitySaved = () => {
    setCapacitySavedFlash(true);
    setTimeout(() => setCapacitySavedFlash(false), 1800);
  };

  const flashShiftDoughSaved = () => {
    setShiftDoughSavedFlash(true);
    setTimeout(() => setShiftDoughSavedFlash(false), 1800);
  };

  const commitPickupCapacity = (raw?: string) => {
    const parsed = Number(raw ?? orderCapacityInput);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setOrderCapacityInput(String(maxOrdersPerWindow));
      return;
    }
    const next = Math.max(1, Math.floor(parsed));
    setOrderCapacityInput(String(next));
    setMaxOrdersPerWindow(next);
    flashCapacitySaved();
  };

  const commitDeliveryCapacity = (raw?: string) => {
    const parsed = Number(raw ?? deliveryCapacityInput);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDeliveryCapacityInput(String(deliveryMaxOrdersPerWindow));
      return;
    }
    const next = Math.max(1, Math.floor(parsed));
    setDeliveryCapacityInput(String(next));
    setDeliveryMaxOrdersPerWindow(next);
    flashCapacitySaved();
  };

  const nudgePickupCapacity = (delta: number) => {
    const current = Number(orderCapacityInput);
    const base = Number.isFinite(current) && current >= 1 ? current : maxOrdersPerWindow;
    commitPickupCapacity(String(Math.max(1, Math.floor(base + delta))));
  };

  const nudgeDeliveryCapacity = (delta: number) => {
    const current = Number(deliveryCapacityInput);
    const base = Number.isFinite(current) && current >= 1 ? current : deliveryMaxOrdersPerWindow;
    commitDeliveryCapacity(String(Math.max(1, Math.floor(base + delta))));
  };

  const commitShiftDoughTotal = (raw?: string) => {
    const value = (raw ?? shiftDoughInput).trim();
    if (value === '') {
      clearShiftDoughTracking();
      setShiftDoughInput('');
      flashShiftDoughSaved();
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setShiftDoughInput(shiftDoughBallsTotal !== null ? String(shiftDoughBallsTotal) : '');
      return;
    }
    const next = Math.floor(parsed);
    setShiftDoughInput(String(next));
    setShiftDoughBallsTotal(next);
    flashShiftDoughSaved();
  };

  const nudgeShiftDoughTotal = (delta: number) => {
    const current = Number(shiftDoughInput);
    const base =
      Number.isFinite(current) && current >= 1
        ? current
        : shiftDoughBallsTotal !== null && shiftDoughBallsTotal > 0
          ? shiftDoughBallsTotal
          : 100;
    commitShiftDoughTotal(String(Math.max(1, Math.floor(base + delta))));
  };

  const capacitySummaryText = `Ogni ${orderWindowMinutes} min: fino a ${maxOrdersPerWindow} unità in sala/asporto, ${deliveryMaxOrdersPerWindow} in delivery.`;
  const capacityExampleUnits = maxOrdersPerWindow;
  const capacityExampleText =
    capacityExampleUnits >= 6
      ? `${capacityExampleUnits} unità ≈ ${capacityExampleUnits} Margherite, oppure 1 metro + ${Math.max(0, capacityExampleUnits - 6)} normali.`
      : `${capacityExampleUnits} unità ≈ ${capacityExampleUnits} Margherite (o mix di taglie equivalenti).`;

  const shiftUsageRatio =
    isShiftTrackingEnabled && shiftDoughBallsTotal && shiftDoughBallsTotal > 0
      ? Math.min(1, Math.max(0, shiftUsedUnits / shiftDoughBallsTotal))
      : 0;

  const formatTime = (hour: number, minute: number): string =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const openBusinessIntervalPicker = (dayIndex: number) => {
    setBusinessPickerDayIndex(dayIndex);
    const existingIntervals = businessHours[dayIndex]?.intervals ?? [];
    const latestInterval = existingIntervals[existingIntervals.length - 1];

    if (latestInterval) {
      const [latestEndHour, latestEndMinute] = latestInterval.end.split(':').map((value) => Number(value));
      const safeHour = Number.isNaN(latestEndHour) ? 12 : latestEndHour;
      const safeMinute = Number.isNaN(latestEndMinute) ? 0 : latestEndMinute;
      setBusinessPickerStart({ hour: safeHour, minute: safeMinute });
      setBusinessPickerEnd({ hour: safeHour, minute: (safeMinute + 5) % 60 });
    } else {
      setBusinessPickerStart({ hour: 12, minute: 0 });
      setBusinessPickerEnd({ hour: 14, minute: 0 });
    }

    setBusinessPickerPhase('start');
    setShowBusinessIntervalPicker(true);
  };

  const applyPresetToDay = (dayIndex: number, intervals: BusinessHoursInterval[]) => {
    setBusinessDayEnabled(dayIndex, true);
    setBusinessDayIntervals(dayIndex, intervals);
  };

  const appendIntervalToDay = (dayIndex: number, interval: BusinessHoursInterval) => {
    const existing = businessHours[dayIndex]?.intervals ?? [];
    setBusinessDayEnabled(dayIndex, true);
    setBusinessDayIntervals(dayIndex, [...existing, interval]);
  };

  const removeDayInterval = (dayIndex: number, intervalToRemove: BusinessHoursInterval) => {
    const existing = businessHours[dayIndex]?.intervals ?? [];
    const updated = existing.filter((interval) => !(interval.start === intervalToRemove.start && interval.end === intervalToRemove.end));
    if (updated.length === 0) {
      setBusinessDayEnabled(dayIndex, false);
      setBusinessDayIntervals(dayIndex, []);
      return;
    }
    setBusinessDayIntervals(dayIndex, updated);
  };

  const PRESETS: Array<{ label: string; intervals: BusinessHoursInterval[] }> = [
    { label: 'Pranzo + Cena', intervals: [{ start: '12:00', end: '14:00' }, { start: '18:00', end: '01:00' }] },
    { label: 'Continuato', intervals: [{ start: '11:00', end: '23:00' }] },
    { label: 'Solo Sera', intervals: [{ start: '18:00', end: '01:00' }] },
  ];
  const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  const validateAudioFile = (name: string): boolean => {
    const lowered = name.toLowerCase();
    return lowered.endsWith('.mp3') || lowered.endsWith('.wav') || lowered.endsWith('.m4a') || lowered.endsWith('.ogg');
  };

  const uploadSoundForType = async (type: 'newOrder' | 'readyOrder') => {
    try {
      setIsUploadingSound(true);
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || picked.assets.length === 0) {
        return;
      }

      const asset = picked.assets[0];
      if (!validateAudioFile(asset.name)) {
        Alert.alert('Formato non supportato', 'Usa MP3, WAV, M4A oppure OGG.');
        return;
      }
      if (!asset.uri) {
        Alert.alert('Errore', 'File audio non valido.');
        return;
      }

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const extension = asset.name.split('.').pop() || 'mp3';
      const fileName = `${type}-${Date.now()}.${extension}`;
      const bucket = 'alert-sounds';

      const { error } = await supabase.storage.from(bucket).upload(fileName, blob, {
        contentType: asset.mimeType || 'audio/mpeg',
        upsert: true,
      });
      if (error) {
        throw error;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      if (type === 'newOrder') {
        setNewOrderSoundUrl(data.publicUrl);
      } else {
        setOrderReadySoundUrl(data.publicUrl);
      }
      Alert.alert('Successo', 'Suono caricato correttamente.');
    } catch (error: any) {
      Alert.alert(
        'Upload fallito',
        error?.message || 'Impossibile caricare il suono. Verifica bucket "alert-sounds" e permessi storage.'
      );
    } finally {
      setIsUploadingSound(false);
    }
  };

  const testSound = async (url: string | null) => {
    if (!url) {
      Alert.alert('Nessun suono', 'Carica prima un file audio.');
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true, volume: 1 });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !status.didJustFinish) return;
        void sound.unloadAsync().catch(() => undefined);
      });
    } catch (error) {
      console.warn('[AdminOptions] test sound failed:', url, error);
      Alert.alert('Suono non valido', 'Il file audio non può essere riprodotto. Caricane un altro (MP3/WAV/M4A/OGG).');
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-8 pb-16">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-8">
        <Pressable
          onPress={() => router.back()}
          className="bg-secondary rounded-full p-3 w-10 h-10 items-center justify-center active:opacity-80"
        >
          <FontAwesome name="arrow-left" size={18} color="black" />
        </Pressable>
        <Text className="text-foreground font-extrabold text-2xl">Opzioni Admin</Text>
        <View className="w-10" />
      </View>

      {/* Kiosk Mode Card */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Modalità Kiosk
        </Text>
        <Text className="text-muted-foreground mb-4">
          Attiva questa opzione solo da un account admin per trasformare il dispositivo in un kiosk
          (ordine da totem senza login).
        </Text>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">
            Stato attuale:{' '}
            <Text className="font-semibold text-foreground">
              {isKioskMode ? 'ATTIVA' : 'DISATTIVA'}
            </Text>
          </Text>
          <Button
            title={isKioskMode ? 'Disattiva Kiosk' : 'Attiva Kiosk'}
            onPress={handleToggleKiosk}
            size="lg"
          />
        </View>
      </View>

      {/* Language */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Lingua / Language
        </Text>
        <Text className="text-muted-foreground mb-4">
          Scegli la lingua del checkout cliente.
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${language === 'it' ? 'bg-primary' : 'bg-secondary'}`}
            onPress={() => handleLanguageChange('it')}
          >
            <Text className={`${language === 'it' ? 'text-primary-foreground' : 'text-foreground'} font-bold`}>
              Italiano
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${language === 'en' ? 'bg-primary' : 'bg-secondary'}`}
            onPress={() => handleLanguageChange('en')}
          >
            <Text className={`${language === 'en' ? 'text-primary-foreground' : 'text-foreground'} font-bold`}>
              English
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Delivery fee */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Costo delivery
        </Text>
        <Text className="text-muted-foreground mb-4">
          Digita l&apos;importo (es. 2,50 oppure 2.50), poi premi Salva. Oppure usa + / − per cambiare di 0,50€.
        </Text>

        <View className="flex-row items-center gap-2 mb-3">
          <Pressable
            accessibilityLabel="Diminuisci delivery di 50 centesimi"
            onPress={() => nudgeDeliveryFee(-0.5)}
            className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
          >
            <Text className="text-foreground font-black text-xl">−</Text>
          </Pressable>

          <View className="flex-1 h-12 rounded-xl border border-border bg-background px-3 flex-row items-center gap-2">
            <Text className="text-muted-foreground font-bold text-base">€</Text>
            <TextInput
              className="flex-1 text-foreground font-extrabold text-xl"
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={deliveryFeeInput}
              onChangeText={(value) => setDeliveryFeeInput(sanitizeDeliveryFeeInput(value))}
              onBlur={() => commitDeliveryFee()}
              onSubmitEditing={() => commitDeliveryFee()}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              selectTextOnFocus
              returnKeyType="done"
            />
          </View>

          <Pressable
            accessibilityLabel="Aumenta delivery di 50 centesimi"
            onPress={() => nudgeDeliveryFee(0.5)}
            className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
          >
            <Text className="text-foreground font-black text-xl">+</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => commitDeliveryFee()}
            className="flex-1 h-11 rounded-xl bg-[#8d171e] items-center justify-center active:opacity-90"
          >
            <Text className="text-white font-bold">Salva costo delivery</Text>
          </Pressable>
          <View className="rounded-xl bg-secondary px-3 py-2 border border-border">
            <Text className="text-[10px] font-bold uppercase text-muted-foreground">Attuale</Text>
            <Text className="text-foreground font-extrabold">€{deliveryFee.toFixed(2)}</Text>
          </View>
        </View>

        {deliveryFeeSavedFlash ? (
          <Text className="text-emerald-700 text-xs font-bold mt-2">Costo delivery aggiornato.</Text>
        ) : null}
      </View>

      {/* Order availability controls */}
      <View
        className={`rounded-2xl p-6 border shadow-lg mb-6 ${
          isKitchenClosed
            ? 'bg-red-50 border-red-300'
            : 'bg-emerald-50 border-emerald-300'
        }`}
      >
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Disponibilità ordini
        </Text>
        <View className={`rounded-xl p-3 mb-4 border ${isKitchenClosed ? 'bg-red-100 border-red-300' : 'bg-emerald-100 border-emerald-300'}`}>
          <View className="flex-row items-center gap-2">
            <FontAwesome
              name={isKitchenClosed ? 'pause-circle' : 'check-circle'}
              size={18}
              color={isKitchenClosed ? '#b91c1c' : '#047857'}
            />
            <Text className={`font-extrabold ${isKitchenClosed ? 'text-red-700' : 'text-emerald-700'}`}>
              {isKitchenClosed ? 'CUCINA CHIUSA A NUOVI ORDINI' : 'CUCINA APERTA A NUOVI ORDINI'}
            </Text>
          </View>
          <Text className={`mt-1 text-xs ${isKitchenClosed ? 'text-red-700' : 'text-emerald-700'}`}>
            {isKitchenClosed
              ? 'I clienti vedranno che il ristorante non accetta ordini in questo momento.'
              : 'I clienti possono ordinare normalmente.'}
          </Text>
        </View>

        <View className="flex-row gap-2 mb-3">
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${acceptingOrders ? 'bg-emerald-600' : 'bg-secondary'}`}
            onPress={() => setAcceptingOrders(true)}
          >
            <Text className={`${acceptingOrders ? 'text-white' : 'text-foreground'} font-bold`}>
              Accetta ordini
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${!acceptingOrders ? 'bg-red-600' : 'bg-secondary'}`}
            onPress={() => setAcceptingOrders(false)}
          >
            <Text className={`${!acceptingOrders ? 'text-white' : 'text-foreground'} font-bold`}>
              Stop ordini
            </Text>
          </Pressable>
        </View>

        {!acceptingOrders && (
          <>
            <View className="flex-row items-center gap-2 mb-3">
              <TextInput
                className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground font-semibold"
                keyboardType="number-pad"
                value={pauseMinutesInput}
                onChangeText={setPauseMinutesInput}
                placeholder="Minuti pausa"
              />
              <Button title="Applica" onPress={handlePauseOrders} />
            </View>
            <Button
              title="Scegli durata con picker"
              variant="outline"
              onPress={() => setShowPausePicker(true)}
              className="mb-3"
            />
            <View className="flex-row gap-2 mb-3">
              {[15, 30, 60].map((minutes) => (
                <Pressable
                  key={minutes}
                  className="px-3 py-2 rounded-lg bg-secondary"
                  onPress={() => {
                    setPauseMinutesInput(String(minutes));
                    pauseOrdersForMinutes(minutes);
                  }}
                >
                  <Text className="text-foreground font-semibold">{minutes} min</Text>
                </Pressable>
              ))}
            </View>
            {pauseDescription && (
              <Text className="text-sm text-amber-700 mb-2">
                Ordini bloccati fino alle {pauseDescription}
              </Text>
            )}
            <Button title="Riattiva ora" variant="outline" onPress={resumeOrders} />
          </>
        )}
      </View>

      {/* Capacità forno — ritmo fascia + palline serata */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
        <Text className="text-card-foreground font-semibold text-xl mb-2">Capacità forno</Text>
        <Text className="text-muted-foreground mb-3">
          Controlla quanta pasta il forno può accettare per fascia oraria e quante palline hai per la serata.
          I limiti usano unità pallina, non pezzi grezzi.
        </Text>

        <View className="flex-row flex-wrap gap-2 mb-5">
          {[
            { label: 'Normale / piccola', weight: '1' },
            { label: 'Tirata', weight: '1,5' },
            { label: 'Mezzo metro', weight: '3' },
            { label: 'Metro', weight: '6' },
          ].map((item) => (
            <View
              key={item.label}
              className="rounded-full border border-border bg-muted/40 px-3 py-1.5 flex-row items-center gap-1.5"
            >
              <Text className="text-xs font-semibold text-card-foreground">{item.label}</Text>
              <Text className="text-xs font-black text-[#8d171e]">= {item.weight}</Text>
            </View>
          ))}
        </View>

        {/* Ritmo forno */}
        <View className="rounded-xl border border-border bg-muted/20 p-4 mb-5">
          <Text className="text-sm font-bold text-card-foreground mb-1">Ritmo forno</Text>
          <Text className="text-xs text-muted-foreground mb-3">
            Una sola durata fascia per tutti i canali; due tetti separati (asporto/sala vs delivery).
          </Text>

          <Text className="text-xs text-muted-foreground mb-2">Durata fascia</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {WINDOW_MINUTE_PRESETS.map((minutes) => {
              const selected = orderWindowMinutes === minutes;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => {
                    setOrderWindowMinutes(minutes);
                    flashCapacitySaved();
                  }}
                  className={`px-3 py-2 rounded-xl border ${
                    selected ? 'bg-[#8d171e] border-[#8d171e]' : 'bg-background border-border'
                  }`}
                >
                  <Text className={`font-bold ${selected ? 'text-white' : 'text-foreground'}`}>
                    {minutes} min
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-xs text-muted-foreground mb-2">Max unità asporto / sala</Text>
          <View className="flex-row items-center gap-2 mb-4">
            <Pressable
              accessibilityLabel="Diminuisci capacità asporto"
              onPress={() => nudgePickupCapacity(-1)}
              className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
            >
              <Text className="text-foreground font-black text-xl">−</Text>
            </Pressable>
            <TextInput
              className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground font-extrabold text-xl text-center"
              keyboardType="number-pad"
              value={orderCapacityInput}
              onChangeText={(value) => setOrderCapacityInput(sanitizeNumericInput(value))}
              onBlur={() => commitPickupCapacity()}
              onSubmitEditing={() => commitPickupCapacity()}
              selectTextOnFocus
              returnKeyType="done"
            />
            <Pressable
              accessibilityLabel="Aumenta capacità asporto"
              onPress={() => nudgePickupCapacity(1)}
              className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
            >
              <Text className="text-foreground font-black text-xl">+</Text>
            </Pressable>
            <Pressable
              onPress={() => commitPickupCapacity()}
              className="h-12 px-4 rounded-xl bg-[#8d171e] items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-bold">Salva</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-muted-foreground mb-2">Max unità delivery</Text>
          <View className="flex-row items-center gap-2 mb-4">
            <Pressable
              accessibilityLabel="Diminuisci capacità delivery"
              onPress={() => nudgeDeliveryCapacity(-1)}
              className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
            >
              <Text className="text-foreground font-black text-xl">−</Text>
            </Pressable>
            <TextInput
              className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground font-extrabold text-xl text-center"
              keyboardType="number-pad"
              value={deliveryCapacityInput}
              onChangeText={(value) => setDeliveryCapacityInput(sanitizeNumericInput(value))}
              onBlur={() => commitDeliveryCapacity()}
              onSubmitEditing={() => commitDeliveryCapacity()}
              selectTextOnFocus
              returnKeyType="done"
            />
            <Pressable
              accessibilityLabel="Aumenta capacità delivery"
              onPress={() => nudgeDeliveryCapacity(1)}
              className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
            >
              <Text className="text-foreground font-black text-xl">+</Text>
            </Pressable>
            <Pressable
              onPress={() => commitDeliveryCapacity()}
              className="h-12 px-4 rounded-xl bg-[#8d171e] items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-bold">Salva</Text>
            </Pressable>
          </View>

          <View className="rounded-lg border border-border bg-background px-3 py-3 mb-2">
            <Text className="text-sm font-semibold text-card-foreground">{capacitySummaryText}</Text>
            <Text className="text-xs text-muted-foreground mt-1">{capacityExampleText}</Text>
          </View>
          {capacitySavedFlash ? (
            <Text className="text-emerald-700 text-xs font-bold">Capacità fascia aggiornata.</Text>
          ) : null}
        </View>

        {/* Palline serata */}
        <View className="rounded-xl border border-border bg-muted/20 p-4">
          <Text className="text-sm font-bold text-card-foreground mb-1">Palline disponibili per serata</Text>
          <Text className="text-xs text-muted-foreground mb-3">
            Inserisci quante palline hai a disposizione. Il sistema scala il residuo a ogni ordine confermato.
            Lascia vuoto e salva per disattivare il limite serata.
          </Text>

          <Text className="text-xs text-muted-foreground mb-2">Palline totali serata</Text>
          <View className="flex-row items-center gap-2 mb-3">
            <Pressable
              accessibilityLabel="Diminuisci palline serata"
              onPress={() => nudgeShiftDoughTotal(-5)}
              className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
            >
              <Text className="text-foreground font-black text-xl">−</Text>
            </Pressable>
            <TextInput
              className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground font-extrabold text-xl text-center"
              keyboardType="number-pad"
              placeholder="es. 120"
              placeholderTextColor="#9ca3af"
              value={shiftDoughInput}
              onChangeText={(value) => setShiftDoughInput(sanitizeNumericInput(value))}
              onBlur={() => commitShiftDoughTotal()}
              onSubmitEditing={() => commitShiftDoughTotal()}
              selectTextOnFocus
              returnKeyType="done"
            />
            <Pressable
              accessibilityLabel="Aumenta palline serata"
              onPress={() => nudgeShiftDoughTotal(5)}
              className="h-12 w-12 rounded-xl bg-secondary border border-border items-center justify-center active:opacity-80"
            >
              <Text className="text-foreground font-black text-xl">+</Text>
            </Pressable>
            <Pressable
              onPress={() => commitShiftDoughTotal()}
              className="h-12 px-4 rounded-xl bg-[#8d171e] items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-bold">Salva</Text>
            </Pressable>
          </View>

          {shiftDoughSavedFlash ? (
            <Text className="text-emerald-700 text-xs font-bold mb-3">Palline serata aggiornate.</Text>
          ) : null}

          {isShiftTrackingEnabled && (
            <View className="rounded-xl border border-border bg-background p-4 mb-3">
              <Text className="text-sm text-card-foreground font-semibold mb-2">Stato serata</Text>
              {shiftStartedLabel && (
                <Text className="text-xs text-muted-foreground mb-2">
                  Conteggio attivo dalle {shiftStartedLabel}
                </Text>
              )}
              {isShiftUsageLoading ? (
                <SkeletonShiftDoughStats />
              ) : (
                <>
                  <View className="h-2.5 rounded-full bg-muted overflow-hidden mb-3">
                    <View
                      className={`h-full rounded-full ${
                        shiftRemainingUnits !== null && shiftRemainingUnits <= 10
                          ? 'bg-destructive'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.round(shiftUsageRatio * 100)}%` }}
                    />
                  </View>
                  <View className="flex-row flex-wrap gap-4">
                    <View>
                      <Text className="text-xs text-muted-foreground">Usate</Text>
                      <Text className="text-lg font-bold text-foreground">{shiftUsedUnits}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-muted-foreground">Rimanenti</Text>
                      <Text
                        className={`text-lg font-bold ${
                          shiftRemainingUnits !== null && shiftRemainingUnits <= 10
                            ? 'text-destructive'
                            : 'text-emerald-700'
                        }`}
                      >
                        {shiftRemainingUnits ?? '-'}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-muted-foreground">Totali</Text>
                      <Text className="text-lg font-bold text-foreground">{shiftDoughBallsTotal}</Text>
                    </View>
                  </View>
                  {shiftRemainingUnits !== null && shiftRemainingUnits <= 10 ? (
                    <Text className="text-xs text-amber-800 mt-2 font-semibold">
                      Attenzione: restano poche palline per la serata.
                    </Text>
                  ) : null}
                </>
              )}
              {(isShiftUsageRpcMissing || hasShiftUsageError) && (
                <View className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <Text className="text-xs text-amber-800">
                    {isShiftUsageRpcMissing
                      ? 'Tracking palline non disponibile: manca la funzione RPC get_shift_dough_usage su Supabase. Il limite serata viene bloccato in checkout finché non viene deployata la migration.'
                      : 'Errore nel calcolo palline serata. Verifica Supabase e riprova.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View className="flex-row flex-wrap gap-2">
            {isShiftTrackingEnabled ? (
              <>
                <Button
                  title="Nuova serata"
                  variant="outline"
                  onPress={() => {
                    resetShiftDoughTracking();
                    void refetchShiftUsage();
                    Alert.alert('Serata resettata', 'Il conteggio palline riparte da adesso.');
                  }}
                />
                <Button
                  title="Aggiorna conteggio"
                  variant="outline"
                  onPress={() => {
                    void refetchShiftUsage();
                  }}
                />
                <Button
                  title="Disattiva limite"
                  variant="ghost"
                  onPress={() => {
                    clearShiftDoughTracking();
                    setShiftDoughInput('');
                    Alert.alert('Tracking disattivato', 'Il limite palline serata non è più attivo.');
                  }}
                />
              </>
            ) : (
              <Text className="text-xs text-muted-foreground">
                Limite serata disattivo. Salva un totale maggiore di 0 per attivarlo.
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Disabled specific time slots */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Fasce orarie non disponibili (opzionale)
        </Text>
        <Text className="text-muted-foreground mb-4">
          Serve per bloccare orari specifici (es: 19:30) anche se il ristorante e aperto.
        </Text>
        <View className="flex-row items-center gap-2 mb-3">
          <TextInput
            className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground font-semibold"
            value={slotInput}
            onChangeText={setSlotInput}
            placeholder="HH:mm"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button title="Aggiungi" onPress={handleAddDisabledSlot} />
        </View>
        <Button
          title="Scegli orario con picker"
          variant="outline"
          onPress={() => setShowSlotPicker(true)}
          className="mb-3"
        />
        <View className="flex-row flex-wrap gap-2 mb-3">
          {disabledTimeSlots.length === 0 && (
            <Text className="text-sm text-muted-foreground">Nessuna fascia bloccata.</Text>
          )}
          {disabledTimeSlots.map((slot) => (
            <Pressable
              key={slot}
              className="px-3 py-2 rounded-lg bg-secondary flex-row items-center gap-2"
              onPress={() => removeDisabledTimeSlot(slot)}
            >
              <Text className="text-foreground font-semibold">{slot}</Text>
              <FontAwesome name="close" size={12} color="#6b7280" />
            </Pressable>
          ))}
        </View>
        {disabledTimeSlots.length > 0 && (
          <Button title="Pulisci fasce" variant="outline" onPress={clearDisabledTimeSlots} />
        )}
      </View>

      {/* Store business hours */}
      <View className="bg-card rounded-2xl border border-border shadow-lg mt-6">
        <Pressable
          className="px-6 py-4 flex-row items-center justify-between"
          onPress={() => setIsBusinessHoursCollapsed((prev) => !prev)}
        >
          <Text className="text-card-foreground font-semibold text-xl">
            Orari negozio
          </Text>
          <FontAwesome
            name={isBusinessHoursCollapsed ? 'chevron-down' : 'chevron-up'}
            size={14}
            color="#6b7280"
          />
        </Pressable>

        {!isBusinessHoursCollapsed && (
          <View className="px-6 pb-6">
            <Text className="text-muted-foreground mb-4">
              Imposta per ogni giorno uno o più orari di apertura. Fuori da queste fasce il ristorante risulta chiuso.
            </Text>

            <View className="gap-3">
              {DISPLAY_DAY_ORDER.map((dayIndex) => {
                const label = WEEKDAY_LABELS[dayIndex];
                const isClosed = !businessHours[dayIndex].enabled;
                return (
                <View
                  key={label}
                  className={`rounded-xl border p-3 gap-2 ${
                    isClosed ? 'border-red-300 bg-red-50' : 'border-border bg-background'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-foreground">{label}</Text>
                    <Pressable
                      className={`px-3 py-1.5 rounded-lg ${isClosed ? 'bg-red-600' : 'bg-emerald-600'}`}
                      onPress={() => setBusinessDayEnabled(dayIndex, isClosed)}
                    >
                      <Text className="text-white text-xs font-bold">
                        {isClosed ? 'Chiuso' : 'Aperto'}
                      </Text>
                    </Pressable>
                  </View>

                  {isClosed ? (
                    <Text className="text-xs text-red-700">
                      Giorno chiuso: nessun ordine disponibile.
                    </Text>
                  ) : (
                    <>
                      <View className="flex-row flex-wrap gap-2">
                        {businessHours[dayIndex].intervals.length === 0 && (
                          <Text className="text-xs text-red-700">Nessuna fascia impostata.</Text>
                        )}
                        {businessHours[dayIndex].intervals.map((interval) => (
                          <Pressable
                            key={`${label}-${interval.start}-${interval.end}`}
                            className="px-3 py-2 rounded-lg bg-secondary flex-row items-center gap-2"
                            onPress={() => removeDayInterval(dayIndex, interval)}
                          >
                            <Text className="text-foreground font-semibold text-xs">{interval.start}-{interval.end}</Text>
                            <FontAwesome name="close" size={10} color="#6b7280" />
                          </Pressable>
                        ))}
                      </View>

                      <View className="flex-row flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                          <Pressable
                            key={`${label}-${preset.label}`}
                            className="px-3 py-2 rounded-lg bg-secondary"
                            onPress={() => applyPresetToDay(dayIndex, preset.intervals)}
                          >
                            <Text className="text-xs font-semibold text-foreground">{preset.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Button
                        title="Aggiungi orario"
                        variant="outline"
                        onPress={() => openBusinessIntervalPicker(dayIndex)}
                      />
                    </>
                  )}
                </View>
              );
              })}
            </View>
          </View>
        )}
      </View>

      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mt-6">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Notifiche audio ordini
        </Text>
        <Text className="text-muted-foreground mb-4">
          Suoni attivi di default. Carica audio personalizzati per nuovi ordini e ordini pronti.
        </Text>

        <View className="flex-row gap-2 mb-4">
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${alertSounds.enabled ? 'bg-emerald-600' : 'bg-secondary'}`}
            onPress={() => setAlertSoundsEnabled(true)}
          >
            <Text className={`${alertSounds.enabled ? 'text-white' : 'text-foreground'} font-bold`}>
              Suoni attivi
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${!alertSounds.enabled ? 'bg-red-600' : 'bg-secondary'}`}
            onPress={() => setAlertSoundsEnabled(false)}
          >
            <Text className={`${!alertSounds.enabled ? 'text-white' : 'text-foreground'} font-bold`}>
              Suoni disattivi
            </Text>
          </Pressable>
        </View>

        <View className="rounded-xl border border-border p-3 mb-3">
          <Text className="font-bold text-foreground mb-1">Nuovo ordine arrivato</Text>
          <Text className="text-xs text-muted-foreground mb-2">
            {alertSounds.newOrderSoundUrl || 'Suono predefinito Ambrosia'}
          </Text>
          <View className="flex-row gap-2">
            <Button
              title={isUploadingSound ? 'Upload...' : 'Carica audio'}
              onPress={() => void uploadSoundForType('newOrder')}
              variant="outline"
              className="flex-1"
            />
            <Button title="Test" onPress={() => void testSound(alertSounds.newOrderSoundUrl)} className="flex-1" />
          </View>
        </View>

        <View className="rounded-xl border border-border p-3">
          <Text className="font-bold text-foreground mb-1">Ordine pronto</Text>
          <Text className="text-xs text-muted-foreground mb-2">
            {alertSounds.orderReadySoundUrl || 'Suono predefinito Ambrosia'}
          </Text>
          <View className="flex-row gap-2">
            <Button
              title={isUploadingSound ? 'Upload...' : 'Carica audio'}
              onPress={() => void uploadSoundForType('readyOrder')}
              variant="outline"
              className="flex-1"
            />
            <Button title="Test" onPress={() => void testSound(alertSounds.orderReadySoundUrl)} className="flex-1" />
          </View>
        </View>
      </View>

      <View className="mt-2">
        <Text className="text-xs text-muted-foreground">
          Nota: la scelta viene ricordata sul dispositivo. Anche dopo aver chiuso l\'app, se la
          modalità kiosk è attiva il dispositivo continuerà ad avviarsi in quella modalità.
        </Text>
      </View>

      <TimeWheelModal
        visible={showPausePicker}
        title="Durata stop ordini"
        confirmLabel="Imposta"
        hourMin={0}
        hourMax={12}
        minuteStep={5}
        initialHour={getDurationParts(Number(pauseMinutesInput.replaceAll(/\D/g, '')) || 30).hour}
        initialMinute={getDurationParts(Number(pauseMinutesInput.replaceAll(/\D/g, '')) || 30).minute}
        onClose={() => setShowPausePicker(false)}
        onConfirm={(hour, minute) => {
          const totalMinutes = hour * 60 + minute;
          const safeMinutes = Math.max(1, totalMinutes);
          setPauseMinutesInput(String(safeMinutes));
          pauseOrdersForMinutes(safeMinutes);
          setShowPausePicker(false);
        }}
      />

      <TimeWheelModal
        visible={showSlotPicker}
        title="Fascia oraria non disponibile"
        confirmLabel="Aggiungi"
        hourMin={0}
        hourMax={23}
        minuteStep={5}
        initialHour={12}
        initialMinute={0}
        onClose={() => setShowSlotPicker(false)}
        onConfirm={(hour, minute) => {
          const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          addDisabledTimeSlot(formatted);
          setSlotInput(formatted);
          setShowSlotPicker(false);
        }}
      />

      <TimeWheelModal
        visible={showBusinessIntervalPicker}
        title={
          businessPickerPhase === 'start'
            ? `Orario inizio (${WEEKDAY_LABELS[businessPickerDayIndex]})`
            : `Orario fine (${WEEKDAY_LABELS[businessPickerDayIndex]})`
        }
        confirmLabel={businessPickerPhase === 'start' ? 'Continua' : 'Aggiungi fascia'}
        hourMin={0}
        hourMax={23}
        minuteStep={5}
        initialHour={businessPickerPhase === 'start' ? businessPickerStart.hour : businessPickerEnd.hour}
        initialMinute={businessPickerPhase === 'start' ? businessPickerStart.minute : businessPickerEnd.minute}
        onClose={() => {
          setShowBusinessIntervalPicker(false);
          setBusinessPickerPhase('start');
        }}
        onConfirm={(hour, minute) => {
          if (businessPickerPhase === 'start') {
            setBusinessPickerStart({ hour, minute });
            setBusinessPickerPhase('end');
            return;
          }

          const end = { hour, minute };
          setBusinessPickerEnd(end);
          const startLabel = formatTime(businessPickerStart.hour, businessPickerStart.minute);
          const endLabel = formatTime(end.hour, end.minute);
          appendIntervalToDay(businessPickerDayIndex, { start: startLabel, end: endLabel });
          setBusinessPickerPhase('start');
          setShowBusinessIntervalPicker(false);
        }}
      />
    </ScrollView>
  );
}

