import { Button } from '@/components/ui/Button';
import { TimeWheelModal } from '@/components/ui/TimeWheelModal';
import { supabase } from '@/lib/api/supabase';
import { useCreateOrder } from '@/lib/hooks/useCreateOrder';
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue';
import { useAuth } from '@/lib/stores/AuthContext';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { useCart } from '@/lib/stores/CartContext';
import { useTenant } from '@/lib/stores/TenantContext';
import { getNextOpening, isOpenAt } from '@/lib/utils/businessHours';
import type { PaymentProvider } from '@/lib/hooks/usePayment';
import { FontAwesome } from '@expo/vector-icons';
import { countries } from 'countries-list';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type OrderType = 'eat_in' | 'take_away' | 'delivery';
type CheckoutStep = 'type' | 'details' | 'payment' | 'processing' | 'success';
type FulfillmentMode = 'asap' | 'scheduled';
type PhonePrefixOption = {
  id: string;
  dialCode: string;
  countryCode: string;
  countryName: string;
  flag: string;
  minDigits: number;
  maxDigits: number;
};

const NON_GEOGRAPHIC_PHONE_PREFIX_OPTIONS: PhonePrefixOption[] = [
  { id: 'XK-+383', dialCode: '+383', countryCode: 'XK', countryName: 'Kosovo', flag: '🇽🇰', minDigits: 8, maxDigits: 9 },
  { id: 'INT-+800', dialCode: '+800', countryCode: 'INT', countryName: 'International Freephone', flag: '🌐', minDigits: 6, maxDigits: 15 },
  { id: 'INT-+808', dialCode: '+808', countryCode: 'INT', countryName: 'Shared Cost Services', flag: '🌐', minDigits: 6, maxDigits: 15 },
  { id: 'INT-+870', dialCode: '+870', countryCode: 'INT', countryName: 'Inmarsat', flag: '🌐', minDigits: 6, maxDigits: 15 },
  { id: 'INT-+878', dialCode: '+878', countryCode: 'INT', countryName: 'Universal Personal Telecommunications', flag: '🌐', minDigits: 6, maxDigits: 15 },
  { id: 'INT-+881', dialCode: '+881', countryCode: 'INT', countryName: 'Global Mobile Satellite System', flag: '🌐', minDigits: 6, maxDigits: 15 },
  { id: 'INT-+882', dialCode: '+882', countryCode: 'INT', countryName: 'International Networks', flag: '🌐', minDigits: 6, maxDigits: 15 },
  { id: 'INT-+883', dialCode: '+883', countryCode: 'INT', countryName: 'International Networks 2', flag: '🌐', minDigits: 6, maxDigits: 15 },
];

function getFlagEmoji(countryCode: string): string {
  if (!/^[A-Z]{2}$/.test(countryCode)) return '🌐';

  return String.fromCodePoint(...countryCode.split('').map((char) => 127397 + char.charCodeAt(0)));
}

function buildPhonePrefixOptions(): PhonePrefixOption[] {
  const countryEntries = Object.entries(countries) as Array<
    [string, { name: string; phone: ReadonlyArray<number> }]
  >;

  const options = countryEntries.flatMap(([countryCode, details]) =>
    details.phone.map((phoneCode) => ({
      id: `${countryCode}-+${phoneCode}`,
      dialCode: `+${phoneCode}`,
      countryCode,
      countryName: details.name,
      flag: getFlagEmoji(countryCode),
      minDigits: countryCode === 'IT' ? 9 : 6,
      maxDigits: countryCode === 'IT' ? 10 : 15,
    }))
  );

  return [...options, ...NON_GEOGRAPHIC_PHONE_PREFIX_OPTIONS]
    .sort((a, b) => a.countryName.localeCompare(b.countryName));
}

const PHONE_PREFIX_OPTIONS: PhonePrefixOption[] = buildPhonePrefixOptions();
const DEFAULT_PHONE_OPTION: PhonePrefixOption =
  PHONE_PREFIX_OPTIONS.find((option) => option.countryCode === 'IT' && option.dialCode === '+39') ?? PHONE_PREFIX_OPTIONS[0];
const FULFILLMENT_NOTE_PREFIX = '[FULFILLMENT:';

function getFlagImageUri(countryCode: string): string | null {
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;
  return `https://flagcdn.com/48x36/${countryCode.toLowerCase()}.png`;
}

function parsePhoneInput(rawPhone: string): { dialCode: string; nationalNumber: string } {
  const normalized = rawPhone.trim().replaceAll(/\s+/g, '');
  const sortedPrefixes = [...PHONE_PREFIX_OPTIONS].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const matched = sortedPrefixes.find((option) => normalized.startsWith(option.dialCode));

  if (!matched) {
    return {
      dialCode: '+39',
      nationalNumber: normalized.replaceAll(/\D/g, ''),
    };
  }

  return {
    dialCode: matched.dialCode,
    nationalNumber: normalized.slice(matched.dialCode.length).replaceAll(/\D/g, ''),
  };
}

function floorToWindowStart(target: Date, windowMinutes: number): Date {
  const normalizedWindow = Math.max(5, windowMinutes);
  const copy = new Date(target);
  copy.setSeconds(0, 0);
  const roundedMinutes = Math.floor(copy.getMinutes() / normalizedWindow) * normalizedWindow;
  copy.setMinutes(roundedMinutes);
  return copy;
}

function buildSchedulingToken(fulfillmentAtIso: string): string {
  return `${FULFILLMENT_NOTE_PREFIX}${fulfillmentAtIso}]`;
}

function parseSchedulingToken(notes: string | null): string | null {
  if (!notes) return null;
  const startIndex = notes.indexOf(FULFILLMENT_NOTE_PREFIX);
  if (startIndex < 0) return null;
  const valueStart = startIndex + FULFILLMENT_NOTE_PREFIX.length;
  const endIndex = notes.indexOf(']', valueStart);
  if (endIndex < 0) return null;
  return notes.slice(valueStart, endIndex);
}

function formatLocalHourMinute(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatSlotKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function CheckoutScreen() {
  const { items, totalAmount, clearCart } = useCart();
  const { profile, isAuthenticated, isGuest } = useAuth();
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
  } = useAppSettings();
  const { companyId } = useTenant();
  const { addToQueue, isOnline } = useOfflineQueue();
  const router = useRouter();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<CheckoutStep>('type');
  const [orderType, setOrderType] = useState<OrderType>('eat_in');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showPhonePrefixModal, setShowPhonePrefixModal] = useState(false);
  const [phonePrefixSearch, setPhonePrefixSearch] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('asap');
  const [asapFulfillmentTimeIso, setAsapFulfillmentTimeIso] = useState<string | null>(null);
  const [selectedFulfillmentTimeIso, setSelectedFulfillmentTimeIso] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [showFulfillmentPicker, setShowFulfillmentPicker] = useState(false);
  const availabilityCheckStartedAtRef = useRef<number | null>(null);

  const i18n = useMemo(
    () =>
      language === 'en'
        ? {
            reviewTitle: 'Review your order',
            reviewSubtitle: 'Final step before payment.',
            dineInTitle: 'Dine in',
            dineInSubtitle: 'Table service',
            takeawayTitle: 'Take away',
            takeawaySubtitle: 'Pickup in store',
            deliveryTitle: 'Delivery',
            deliverySubtitle: `Home delivery (+€${deliveryFee.toFixed(2)})`,
            detailsTitle: 'Your details',
            paymentTitle: 'Payment',
            nameLabelOptional: 'Name (optional)',
            nameLabelRequired: 'Name *',
            tableLabel: 'Table number *',
            phoneLabel: 'Phone *',
            phonePrefixLabel: 'Prefix',
            phoneRequired: 'Please enter a phone number',
            addressLabel: 'Address *',
            fulfillmentTitle: 'When do you want your order?',
            asapLabel: 'As soon as possible',
            scheduleLabel: 'Choose time',
            selectTimePlaceholder: 'Select time slot',
            pickTimeWithWheel: 'Pick time with wheel',
            preferredTimeLabel: 'Preferred time (optional)',
            preferredTimeSelected: 'Preferred time selected',
            unavailableRestaurantClosed: 'This restaurant is not taking orders right now. Please try later.',
            unavailableOutsideWorkingHours: 'The restaurant is currently closed based on working hours.',
            unavailablePausedUntil: 'Orders are paused until',
            unavailableSlotDisabled: 'This time slot is disabled by the restaurant.',
            unavailableCapacity: 'This time slot is full. Please choose another time.',
            unavailableDeliveryCapacity: 'This delivery time slot is full. Please choose another time.',
            checkingAvailability: 'Checking time availability...',
            queueAtNextOpeningPrompt: 'Do you want to queue this order for the next opening time at',
            queueAtNextOpeningAction: 'Queue order',
            namePlaceholder: 'Your name',
            tablePlaceholder: 'e.g. 5',
            phonePlaceholder: 'e.g. 3331234567',
            addressPlaceholder: 'Street, number, city',
            summaryTitle: 'Order summary',
            table: 'Table',
            pickup: 'Take away',
            delivery: 'Delivery',
            subtotal: 'Subtotal',
            deliveryFee: 'Delivery fee',
            total: 'Total',
            paymentMethod: 'Payment method',
            card: 'Credit card',
            cardSubtitle: 'Visa, Mastercard, Amex',
            terminal: 'POS at counter',
            terminalSubtitle: 'Physical terminal',
            cash: 'Cash',
            cashSubtitle: 'Pay at counter',
            cashDeliverySubtitle: 'Pay on delivery',
            confirmOrder: 'Confirm order',
            saveOrder: 'Save order',
            back: 'Back',
            continue: 'Continue',
            orderConfirmed: 'Order confirmed',
            openSummary: 'Open order summary',
            orderSaved: 'Order saved',
            orderSavedSubtitle: 'Your order will sync when connection is back.',
            missingFields: 'Missing fields',
            missingFieldsSubtitle: 'Please complete all required fields highlighted in red.',
            invalidPhone: 'Please enter a valid phone number',
            cannotCreateOrder: 'Unable to create order now. Please try again.',
            offline: 'Offline',
            offlineOrderSaved: 'Order saved locally',
          }
        : {
            reviewTitle: 'Riepilogo ordine',
            reviewSubtitle: 'Ultimo passaggio prima del pagamento.',
            dineInTitle: 'Mangio qui',
            dineInSubtitle: 'Servizio al tavolo',
            takeawayTitle: 'Da asporto',
            takeawaySubtitle: 'Ritiro in negozio',
            deliveryTitle: 'Delivery',
            deliverySubtitle: `A domicilio (+€${deliveryFee.toFixed(2)})`,
            detailsTitle: 'I tuoi dati',
            paymentTitle: 'Pagamento',
            nameLabelOptional: 'Nome (opzionale)',
            nameLabelRequired: 'Nome *',
            tableLabel: 'Numero tavolo *',
            phoneLabel: 'Telefono *',
            phonePrefixLabel: 'Prefisso',
            phoneRequired: 'Inserisci un numero di telefono',
            addressLabel: 'Indirizzo *',
            fulfillmentTitle: 'Quando vuoi ricevere l ordine?',
            asapLabel: 'Il prima possibile',
            scheduleLabel: 'Scegli orario',
            selectTimePlaceholder: 'Seleziona fascia oraria',
            pickTimeWithWheel: 'Scegli orario con ruota',
            preferredTimeLabel: 'Orario preferito (opzionale)',
            preferredTimeSelected: 'Orario preferito selezionato',
            unavailableRestaurantClosed: 'Questo ristorante non sta accettando ordini al momento. Riprova più tardi.',
            unavailableOutsideWorkingHours: 'Il ristorante è chiuso in base agli orari di apertura.',
            unavailablePausedUntil: 'Ordini in pausa fino alle',
            unavailableSlotDisabled: 'Questa fascia oraria è disattivata dal ristorante.',
            unavailableCapacity: 'Questa fascia è piena. Scegli un altro orario.',
            unavailableDeliveryCapacity: 'Questa fascia delivery è piena. Scegli un altro orario.',
            checkingAvailability: 'Controllo disponibilità orario...',
            queueAtNextOpeningPrompt: 'Vuoi mettere questo ordine in coda per la prossima apertura alle',
            queueAtNextOpeningAction: 'Metti in coda',
            namePlaceholder: 'Il tuo nome',
            tablePlaceholder: 'Es: 5',
            phonePlaceholder: 'Es: 3331234567',
            addressPlaceholder: 'Via, civico, citta',
            summaryTitle: 'Riepilogo ordine',
            table: 'Tavolo',
            pickup: 'Asporto',
            delivery: 'Consegna',
            subtotal: 'Subtotale',
            deliveryFee: 'Costo consegna',
            total: 'Totale',
            paymentMethod: 'Metodo di pagamento',
            card: 'Carta di credito',
            cardSubtitle: 'Visa, Mastercard, Amex',
            terminal: 'POS in cassa',
            terminalSubtitle: 'Terminale fisico',
            cash: 'Contanti',
            cashSubtitle: 'Paga alla cassa',
            cashDeliverySubtitle: 'Paga alla consegna',
            confirmOrder: 'Conferma ordine',
            saveOrder: 'Salva ordine',
            back: 'Indietro',
            continue: 'Continua',
            orderConfirmed: 'Ordine confermato',
            openSummary: 'Vai al riepilogo ordine',
            orderSaved: 'Ordine salvato',
            orderSavedSubtitle: 'Il tuo ordine verra inviato quando la connessione sara ripristinata.',
            missingFields: 'Campi mancanti',
            missingFieldsSubtitle: 'Compila tutti i campi obbligatori evidenziati in rosso.',
            invalidPhone: 'Inserisci un numero di telefono valido',
            cannotCreateOrder: "Impossibile creare l'ordine. Riprova tra poco.",
            offline: 'Offline',
            offlineOrderSaved: 'Ordine salvato in locale',
          },
    [language, deliveryFee]
  );

  const appliedDeliveryFee = orderType === 'delivery' ? deliveryFee : 0;
  const checkoutTotal = totalAmount + appliedDeliveryFee;
  const isDelivery = orderType === 'delivery';

  useEffect(() => {
    if (isDelivery && paymentProvider === 'terminal') {
      setPaymentProvider('stripe');
    }
  }, [isDelivery, paymentProvider]);

  // Customer Details
  const [name, setName] = useState('');
  const [selectedPhoneOptionId, setSelectedPhoneOptionId] = useState(DEFAULT_PHONE_OPTION.id);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [errors, setErrors] = useState<{name?: string; phone?: string; address?: string; tableNumber?: string}>({});
  const selectedPhonePrefix = PHONE_PREFIX_OPTIONS.find((option) => option.id === selectedPhoneOptionId) ?? DEFAULT_PHONE_OPTION;
  const fullPhoneNumber = `${selectedPhonePrefix.dialCode}${phoneNumber}`;
  const filteredPhonePrefixOptions = useMemo(() => {
    const query = phonePrefixSearch.trim().toLowerCase();
    if (!query) return PHONE_PREFIX_OPTIONS;

    return PHONE_PREFIX_OPTIONS.filter(
      (option) =>
        option.countryName.toLowerCase().includes(query) ||
        option.countryCode.toLowerCase().includes(query) ||
        option.dialCode.includes(query)
    );
  }, [phonePrefixSearch]);
  const pausedUntilDate =
    ordersPausedUntil && !Number.isNaN(new Date(ordersPausedUntil).getTime())
      ? new Date(ordersPausedUntil)
      : null;
  const pausedUntilTimestamp = pausedUntilDate?.getTime() ?? null;
  const isRestaurantTemporarilyClosed =
    !acceptingOrders || (pausedUntilDate ? pausedUntilDate.getTime() > Date.now() : false);
  const isClosedByBusinessHours = !isOpenAt(new Date(), businessHours);
  const nextBusinessOpening = isClosedByBusinessHours ? getNextOpening(new Date(), businessHours) : null;
  const nextBusinessOpeningTimestamp = nextBusinessOpening?.getTime() ?? null;
  const activeOrderWindowMinutes = orderType === 'delivery' ? deliveryOrderWindowMinutes : orderWindowMinutes;
  const activeMaxOrdersPerWindow = orderType === 'delivery' ? deliveryMaxOrdersPerWindow : maxOrdersPerWindow;
  const schedulingBaseIso = useMemo(
    () =>
      floorToWindowStart(
        new Date(Date.now() + activeOrderWindowMinutes * 60_000),
        activeOrderWindowMinutes
      ).toISOString(),
    [activeOrderWindowMinutes]
  );
  const availableTimeSlots = useMemo(() => {
    const schedulingBase = new Date(schedulingBaseIso);
    const slots: Array<{ iso: string; label: string; key: string }> = [];
    for (let index = 0; index < 18; index += 1) {
      const slot = new Date(schedulingBase.getTime() + index * activeOrderWindowMinutes * 60_000);
      slots.push({
        iso: slot.toISOString(),
        label: formatLocalHourMinute(slot),
        key: formatSlotKey(slot),
      });
    }
    return slots;
  }, [activeOrderWindowMinutes, schedulingBaseIso]);

  useEffect(() => {
    if (availableTimeSlots.length === 0) return;
    setAsapFulfillmentTimeIso((prev) => {
      if (!prev) return availableTimeSlots[0].iso;
      const stillAvailable = availableTimeSlots.some((slot) => slot.iso === prev);
      return stillAvailable ? prev : availableTimeSlots[0].iso;
    });
  }, [availableTimeSlots]);

  const selectedFulfillmentIso = useMemo(() => {
    if (fulfillmentMode === 'scheduled' && selectedFulfillmentTimeIso) {
      return selectedFulfillmentTimeIso;
    }
    if (asapFulfillmentTimeIso) {
      return asapFulfillmentTimeIso;
    }
    const fallbackSlot = availableTimeSlots[0]?.iso;
    if (fallbackSlot) return fallbackSlot;
    const asapTarget = new Date(Date.now() + activeOrderWindowMinutes * 60_000);
    return floorToWindowStart(asapTarget, activeOrderWindowMinutes).toISOString();
  }, [fulfillmentMode, selectedFulfillmentTimeIso, asapFulfillmentTimeIso, availableTimeSlots, activeOrderWindowMinutes]);

  useEffect(() => {
    if (fulfillmentMode === 'scheduled' && !selectedFulfillmentTimeIso && availableTimeSlots.length > 0) {
      setSelectedFulfillmentTimeIso(availableTimeSlots[0].iso);
    }
  }, [fulfillmentMode, selectedFulfillmentTimeIso, availableTimeSlots]);

  useEffect(() => {
    let isCancelled = false;

    const verifyAvailability = async () => {
      if (!companyId || !selectedFulfillmentIso) {
        if (!isCancelled) {
          setIsCheckingAvailability(false);
        }
        return;
      }

      const selectedDate = new Date(selectedFulfillmentIso);
      const selectedKey = formatSlotKey(selectedDate);
      const selectedSlotStart = floorToWindowStart(selectedDate, activeOrderWindowMinutes).getTime();

      if (disabledTimeSlots.includes(selectedKey)) {
        if (fulfillmentMode === 'asap') {
          const fallbackSlot = availableTimeSlots.find((slot) => !disabledTimeSlots.includes(slot.key));
          if (fallbackSlot && fallbackSlot.iso !== selectedFulfillmentIso) {
            setAsapFulfillmentTimeIso(fallbackSlot.iso);
            if (!isCancelled) {
              setIsCheckingAvailability(false);
              setAvailabilityError(null);
            }
            return;
          }
        }
        if (!isCancelled) {
          setIsCheckingAvailability(false);
          setAvailabilityError(i18n.unavailableSlotDisabled);
        }
        return;
      }
      if (isClosedByBusinessHours) {
        if (nextBusinessOpening && selectedDate.getTime() >= nextBusinessOpening.getTime()) {
          if (!isCancelled) {
            setIsCheckingAvailability(false);
            setAvailabilityError(null);
          }
        } else if (nextBusinessOpening) {
          if (fulfillmentMode === 'asap') {
            const fallbackSlot = availableTimeSlots.find(
              (slot) => new Date(slot.iso).getTime() >= nextBusinessOpening.getTime()
            );
            if (fallbackSlot && fallbackSlot.iso !== selectedFulfillmentIso) {
              setAsapFulfillmentTimeIso(fallbackSlot.iso);
              if (!isCancelled) {
                setIsCheckingAvailability(false);
                setAvailabilityError(null);
              }
              return;
            }
          }
          if (!isCancelled) {
            setIsCheckingAvailability(false);
            setAvailabilityError(
              `${i18n.unavailableOutsideWorkingHours} ${i18n.queueAtNextOpeningPrompt} ${formatLocalHourMinute(nextBusinessOpening)}.`
            );
          }
          return;
        } else {
          if (!isCancelled) {
            setIsCheckingAvailability(false);
            setAvailabilityError(i18n.unavailableOutsideWorkingHours);
          }
          return;
        }
      }
      if (isRestaurantTemporarilyClosed) {
        if (!isCancelled) {
          setIsCheckingAvailability(false);
          if (pausedUntilDate) {
            setAvailabilityError(`${i18n.unavailablePausedUntil} ${formatLocalHourMinute(pausedUntilDate)}.`);
          } else {
            setAvailabilityError(i18n.unavailableRestaurantClosed);
          }
        }
        return;
      }
      if (!isOnline) {
        if (!isCancelled) {
          setIsCheckingAvailability(false);
          setAvailabilityError(null);
        }
        return;
      }

      if (!isCancelled) {
        setIsCheckingAvailability(true);
        availabilityCheckStartedAtRef.current = Date.now();
        setAvailabilityError(null);
      }

      let watchdog: ReturnType<typeof setTimeout> | null = null;
      try {
        watchdog = setTimeout(() => {
          if (!isCancelled) {
            setIsCheckingAvailability(false);
            availabilityCheckStartedAtRef.current = null;
          }
        }, 6000);

        const rangeStart = new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const rangeEnd = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from('orders')
          .select('notes, created_at, status, order_type')
          .eq('company_id', companyId)
          .in('status', ['pending', 'preparing', 'ready'])
          .gte('created_at', rangeStart)
          .lte('created_at', rangeEnd)
          .limit(500);

        if (isCancelled) return;

        if (error) {
          setAvailabilityError(null);
          return;
        }

        const matchingOrders = (data ?? []).filter((order) => {
          const orderTypeValue = order.order_type;
          const isDeliveryOrder = orderTypeValue === 'delivery';
          const shouldCountOrder = orderType === 'delivery' ? isDeliveryOrder : !isDeliveryOrder;
          if (!shouldCountOrder) return false;

          const tokenIso = parseSchedulingToken(order.notes);
          const baseDate = tokenIso ? new Date(tokenIso) : new Date(order.created_at);
          if (Number.isNaN(baseDate.getTime())) return false;
          const slotStart = floorToWindowStart(baseDate, activeOrderWindowMinutes).getTime();
          return slotStart === selectedSlotStart;
        });

        if (matchingOrders.length >= activeMaxOrdersPerWindow) {
          if (fulfillmentMode === 'asap') {
            const slotCounts = new Map<number, number>();
            (data ?? []).forEach((order) => {
              const orderTypeValue = order.order_type;
              const isDeliveryOrder = orderTypeValue === 'delivery';
              const shouldCountOrder = orderType === 'delivery' ? isDeliveryOrder : !isDeliveryOrder;
              if (!shouldCountOrder) return;
              const tokenIso = parseSchedulingToken(order.notes);
              const baseDate = tokenIso ? new Date(tokenIso) : new Date(order.created_at);
              if (Number.isNaN(baseDate.getTime())) return;
              const slotStart = floorToWindowStart(baseDate, activeOrderWindowMinutes).getTime();
              slotCounts.set(slotStart, (slotCounts.get(slotStart) ?? 0) + 1);
            });

            const fallbackSlot = availableTimeSlots.find((slot) => {
              if (disabledTimeSlots.includes(slot.key)) return false;
              const slotStart = floorToWindowStart(new Date(slot.iso), activeOrderWindowMinutes).getTime();
              const usedCapacity = slotCounts.get(slotStart) ?? 0;
              return usedCapacity < activeMaxOrdersPerWindow;
            });

            if (fallbackSlot && fallbackSlot.iso !== selectedFulfillmentIso) {
              setAsapFulfillmentTimeIso(fallbackSlot.iso);
              setAvailabilityError(null);
              return;
            }
          }

          setAvailabilityError(orderType === 'delivery' ? i18n.unavailableDeliveryCapacity : i18n.unavailableCapacity);
        } else {
          setAvailabilityError(null);
        }
      } catch {
        if (!isCancelled) {
          setAvailabilityError(null);
        }
      } finally {
        if (watchdog) {
          clearTimeout(watchdog);
        }
        if (!isCancelled) {
          setIsCheckingAvailability(false);
          availabilityCheckStartedAtRef.current = null;
        }
      }
    };

    void verifyAvailability();
    return () => {
      isCancelled = true;
    };
  }, [
    companyId,
    selectedFulfillmentIso,
    activeOrderWindowMinutes,
    activeMaxOrdersPerWindow,
    orderType,
    fulfillmentMode,
    availableTimeSlots,
    disabledTimeSlots,
    isClosedByBusinessHours,
    nextBusinessOpeningTimestamp,
    isRestaurantTemporarilyClosed,
    pausedUntilTimestamp,
    isOnline,
    i18n.queueAtNextOpeningPrompt,
    i18n.unavailableOutsideWorkingHours,
    i18n.unavailableCapacity,
    i18n.unavailableDeliveryCapacity,
    i18n.unavailablePausedUntil,
    i18n.unavailableRestaurantClosed,
    i18n.unavailableSlotDisabled,
  ]);

  // Pre-fill data if logged in
  useEffect(() => {
    if (isAuthenticated && profile) {
      setName(profile.full_name || '');
      const parsed = parsePhoneInput(profile.phone || '');
      const matchedOption = PHONE_PREFIX_OPTIONS.find((option) => option.dialCode === parsed.dialCode);
      setSelectedPhoneOptionId(matchedOption?.id ?? DEFAULT_PHONE_OPTION.id);
      setPhoneNumber(parsed.nationalNumber);
      setAddress(profile.address || '');
    } else if (isGuest) {
      setName('ospite123');
    }
  }, [isAuthenticated, profile, isGuest]);

  const handleNextStep = () => {
    if (step === 'type') {
      setStep('details');
    } else if (step === 'details') {
      // Clear previous errors
      setErrors({});
      
      const newErrors: {name?: string; phone?: string; address?: string; tableNumber?: string} = {};
      let hasError = false;

      // Validate Name
      if (orderType !== 'eat_in' && !name.trim()) {
        newErrors.name = 'Inserisci il tuo nome';
        hasError = true;
      }

      // Validate Table Number
      if (orderType === 'eat_in' && !tableNumber.trim()) {
        newErrors.tableNumber = 'Inserisci il numero del tavolo';
        hasError = true;
      }

      // Validate Phone
      if (orderType === 'take_away' || orderType === 'delivery') {
        const numericPhone = phoneNumber.replaceAll(/\D/g, '');
        const isItalianFormatValid =
          selectedPhonePrefix.dialCode !== '+39' || numericPhone.length === 0 || /^[03]/.test(numericPhone);
        const isLengthValid =
          numericPhone.length >= selectedPhonePrefix.minDigits &&
          numericPhone.length <= selectedPhonePrefix.maxDigits;

        if (!numericPhone) {
          newErrors.phone = i18n.phoneRequired;
          hasError = true;
        } else if (!isLengthValid || !isItalianFormatValid) {
          newErrors.phone = i18n.invalidPhone;
          hasError = true;
        }
      }

      // Validate Address
      if (orderType === 'delivery' && !address.trim()) {
        newErrors.address = 'Inserisci l\'indirizzo di consegna';
        hasError = true;
      }

      if (hasError) {
        setErrors(newErrors);
        Alert.alert(
          i18n.missingFields,
          i18n.missingFieldsSubtitle,
          [{ text: 'OK' }]
        );
        return;
      }

      const isLongAvailabilityCheck =
        isCheckingAvailability &&
        availabilityCheckStartedAtRef.current !== null &&
        Date.now() - availabilityCheckStartedAtRef.current > 6000;
      if (isCheckingAvailability && !isLongAvailabilityCheck) {
        Alert.alert(i18n.missingFields, i18n.checkingAvailability, [{ text: 'OK' }]);
        return;
      }

      if (
        availabilityError &&
        isClosedByBusinessHours &&
        nextBusinessOpening &&
        new Date(selectedFulfillmentIso).getTime() < nextBusinessOpening.getTime()
      ) {
        Alert.alert(
          i18n.unavailableRestaurantClosed,
          `${i18n.queueAtNextOpeningPrompt} ${formatLocalHourMinute(nextBusinessOpening)}?`,
          [
            { text: i18n.back, style: 'cancel' },
            {
              text: i18n.queueAtNextOpeningAction,
              onPress: () => {
                setFulfillmentMode('scheduled');
                setSelectedFulfillmentTimeIso(nextBusinessOpening.toISOString());
              },
            },
          ]
        );
        return;
      }

      if (availabilityError) {
        Alert.alert(i18n.missingFields, availabilityError, [{ text: 'OK' }]);
        return;
      }

      setStep('payment');
    }
  };

  const handleBackStep = () => {
    if (step === 'payment') setStep('details');
    else if (step === 'details') setStep('type');
    else router.back();
  };

  const handlePayment = async () => {
    if (items.length === 0) return;
    if (
      isClosedByBusinessHours &&
      nextBusinessOpening &&
      new Date(selectedFulfillmentIso).getTime() < nextBusinessOpening.getTime()
    ) {
      Alert.alert(
        i18n.unavailableRestaurantClosed,
        `${i18n.queueAtNextOpeningPrompt} ${formatLocalHourMinute(nextBusinessOpening)}?`,
        [
          { text: i18n.back, style: 'cancel' },
          {
            text: i18n.queueAtNextOpeningAction,
            onPress: () => {
              setFulfillmentMode('scheduled');
              setSelectedFulfillmentTimeIso(nextBusinessOpening.toISOString());
            },
          },
        ]
      );
      return;
    }
    if (availabilityError) {
      Alert.alert(i18n.missingFields, availabilityError, [{ text: 'OK' }]);
      return;
    }
    const isLongAvailabilityCheck =
      isCheckingAvailability &&
      availabilityCheckStartedAtRef.current !== null &&
      Date.now() - availabilityCheckStartedAtRef.current > 6000;
    if (isCheckingAvailability && !isLongAvailabilityCheck) {
      Alert.alert(i18n.missingFields, i18n.checkingAvailability, [{ text: 'OK' }]);
      return;
    }

    setIsProcessing(true);
    const fulfillmentToken = buildSchedulingToken(selectedFulfillmentIso);
    const fulfillmentLabel =
      fulfillmentMode === 'asap'
        ? `ASAP (${formatLocalHourMinute(new Date(selectedFulfillmentIso))})`
        : formatLocalHourMinute(new Date(selectedFulfillmentIso));
    const baseNotes = `Metodo di pagamento: ${paymentProvider}${appliedDeliveryFee > 0 ? ` | Delivery fee: €${appliedDeliveryFee.toFixed(2)}` : ''}`;
    const notesWithFulfillment = `${baseNotes} | Fulfillment: ${fulfillmentLabel} | ${fulfillmentToken}`;

    try {
      // If offline, queue the order instead of trying to create it
      if (!isOnline) {
        await addToQueue({
          items,
          notes: notesWithFulfillment,
          orderType,
          customerName: name,
          customerPhone: fullPhoneNumber,
          deliveryAddress: address,
          tableNumber: tableNumber,
          paymentMethod: paymentProvider === 'cash' ? 'cash' : 'card',
        });

        clearCart();
        Alert.alert(
          i18n.orderSaved,
          i18n.orderSavedSubtitle,
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
        return;
      }

      const result = await createOrder.mutateAsync({
        items,
        notes: notesWithFulfillment,
        orderType,
        customerName: name,
        customerPhone: fullPhoneNumber,
        deliveryAddress: address,
        tableNumber: tableNumber,
        fulfillmentMode,
        fulfillmentAt: selectedFulfillmentIso,
      });

      console.log('✅ Order created successfully:', result.orderId);

      clearCart();
      setConfirmedOrderId(result.orderId);
      setShowConfirmationModal(true);
      setIsProcessing(false);
    } catch (error) {
      console.error('❌ Order creation failed:', error);
      Alert.alert(
        'Errore',
        i18n.cannotCreateOrder,
        [{ text: 'OK' }]
      );
      setIsProcessing(false);
    }
  };

  const renderOrderTypeSelection = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-6">
      <View className="flex-1 justify-center">
        <Text className="text-2xl font-black text-center mb-2">{i18n.reviewTitle}</Text>
        <Text className="text-sm text-gray-600 text-center mb-8">
          {i18n.reviewSubtitle}
        </Text>

        <View className="gap-4 mb-6">
          {/* Mangio Qui */}
          <Pressable
            className={`p-6 rounded-2xl border-2 items-center gap-3 shadow-sm active:scale-98 transition-transform ${
              orderType === 'eat_in' ? 'border-[#8d171e] bg-[#f9ecdd]' : 'border-border'
            }`}
            onPress={() => setOrderType('eat_in')}
          >
            <FontAwesome name="cutlery" size={28} color={orderType === 'eat_in' ? '#8d171e' : '#6b7280'} />
            <Text className="text-lg font-bold text-center">{i18n.dineInTitle}</Text>
            <Text className="text-muted-foreground text-sm text-center">{i18n.dineInSubtitle}</Text>
          </Pressable>

          {/* Da Asporto */}
          <Pressable
            className={`p-6 rounded-2xl border-2 items-center gap-3 shadow-sm active:scale-98 transition-transform ${
              orderType === 'take_away' ? 'border-[#8d171e] bg-[#f9ecdd]' : 'border-border'
            }`}
            onPress={() => setOrderType('take_away')}
          >
            <FontAwesome name="shopping-bag" size={28} color={orderType === 'take_away' ? '#8d171e' : '#6b7280'} />
            <Text className="text-lg font-bold text-center">{i18n.takeawayTitle}</Text>
            <Text className="text-muted-foreground text-sm text-center">{i18n.takeawaySubtitle}</Text>
          </Pressable>

          {/* Delivery */}
          <Pressable
            className={`p-6 rounded-2xl border-2 items-center gap-3 shadow-sm active:scale-98 transition-transform ${
              orderType === 'delivery' ? 'border-[#8d171e] bg-[#f9ecdd]' : 'border-border'
            }`}
            onPress={() => setOrderType('delivery')}
          >
            <FontAwesome name="motorcycle" size={28} color={orderType === 'delivery' ? '#8d171e' : '#6b7280'} />
            <Text className="text-lg font-bold text-center">{i18n.deliveryTitle}</Text>
            <Text className="text-muted-foreground text-sm text-center">{i18n.deliverySubtitle}</Text>
          </Pressable>
        </View>

        {isRestaurantTemporarilyClosed && (
          <View className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-sm text-red-700">
              {availabilityError || i18n.unavailableRestaurantClosed}
            </Text>
          </View>
        )}

        <Button
          title={i18n.continue}
          onPress={handleNextStep}
          disabled={isRestaurantTemporarilyClosed}
          size="lg"
        />
      </View>
    </ScrollView>
  );

  const renderDetailsForm = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-6">
      <View className="flex-1 justify-center gap-4">
        <Text className="text-2xl font-bold text-center mb-2">{i18n.detailsTitle}</Text>

        {/* Nome */}
        <View>
          <Text className="text-sm font-medium mb-2">
            {orderType === 'eat_in' ? i18n.nameLabelOptional : i18n.nameLabelRequired}
          </Text>
          <TextInput
            className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[56px] ${
              errors.name ? 'border-red-500 bg-red-50' : 'border-border'
            }`}
            placeholder={i18n.namePlaceholder}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          {errors.name && (
            <Text className="text-red-500 text-xs mt-1">
              {errors.name}
            </Text>
          )}
        </View>

        {/* Tavolo */}
        {orderType === 'eat_in' && (
          <View>
            <Text className="text-sm font-medium mb-2">{i18n.tableLabel}</Text>
            <TextInput
              className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[56px] ${
                errors.tableNumber ? 'border-red-500 bg-red-50' : 'border-border'
              }`}
              placeholder={i18n.tablePlaceholder}
              keyboardType="number-pad"
              value={tableNumber}
              onChangeText={(text) => setTableNumber(text.replaceAll(/\D/g, ''))}
              maxLength={3}
            />
            {errors.tableNumber && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.tableNumber}
              </Text>
            )}
          </View>
        )}

        {/* Telefono */}
        {(orderType === 'take_away' || orderType === 'delivery') && (
          <View>
            <Text className="text-sm font-medium mb-2">{i18n.phoneLabel}</Text>
            <View className="flex-row gap-2">
              <Pressable
                className={`min-h-[56px] min-w-[108px] rounded-xl border px-3 flex-row items-center justify-between ${
                  errors.phone ? 'border-red-500 bg-red-50' : 'border-border bg-background'
                }`}
                onPress={() => setShowPhonePrefixModal(true)}
              >
                <View className="flex-row items-center gap-1">
                  {getFlagImageUri(selectedPhonePrefix.countryCode) ? (
                    <Image
                      source={{ uri: getFlagImageUri(selectedPhonePrefix.countryCode)! }}
                      className="w-5 h-3 rounded-sm"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-sm">{selectedPhonePrefix.flag}</Text>
                  )}
                  <Text className="text-sm font-semibold">{selectedPhonePrefix.dialCode}</Text>
                </View>
                <FontAwesome name="chevron-down" size={12} color="#6b7280" />
              </Pressable>
              <TextInput
                className={`flex-1 bg-background border rounded-xl px-4 py-3 text-base min-h-[56px] ${
                  errors.phone ? 'border-red-500 bg-red-50' : 'border-border'
                }`}
                placeholder={i18n.phonePlaceholder}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(text) => setPhoneNumber(text.replaceAll(/\D/g, ''))}
                maxLength={selectedPhonePrefix.maxDigits}
              />
            </View>
            {errors.phone && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.phone}
              </Text>
            )}
          </View>
        )}

        {/* Indirizzo */}
        {orderType === 'delivery' && (
          <View>
            <Text className="text-sm font-medium mb-2">{i18n.addressLabel}</Text>
            <TextInput
              className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[80px] ${
                errors.address ? 'border-red-500 bg-red-50' : 'border-border'
              }`}
              placeholder={i18n.addressPlaceholder}
              multiline
              value={address}
              onChangeText={setAddress}
            />
            {errors.address && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.address}
              </Text>
            )}
          </View>
        )}

        <View className="bg-card border border-border rounded-xl p-4 gap-3">
          <Text className="text-sm font-semibold">{i18n.fulfillmentTitle}</Text>
          <View className="h-11 rounded-lg items-center justify-center border bg-[#f9ecdd] border-[#8d171e]">
            <Text className="font-semibold">{i18n.asapLabel}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
            {availableTimeSlots.map((slot) => {
              const isSelectedAsap = fulfillmentMode === 'asap' && asapFulfillmentTimeIso === slot.iso;
              const isSelectedScheduled = fulfillmentMode === 'scheduled' && selectedFulfillmentTimeIso === slot.iso;
              return (
                <Pressable
                  key={slot.iso}
                  className={`h-10 px-3 rounded-lg border items-center justify-center ${
                    isSelectedAsap || isSelectedScheduled ? 'bg-[#f9ecdd] border-[#8d171e]' : 'bg-background border-border'
                  }`}
                  onPress={() => {
                    setFulfillmentMode('asap');
                    setAsapFulfillmentTimeIso(slot.iso);
                  }}
                >
                  <Text className="text-sm font-medium">{slot.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="gap-2">
            <Text className="text-xs text-muted-foreground">{i18n.preferredTimeLabel}</Text>
            <Button
              title={i18n.pickTimeWithWheel}
              variant="outline"
              onPress={() => setShowFulfillmentPicker(true)}
            />
            {fulfillmentMode === 'scheduled' && selectedFulfillmentTimeIso && (
              <Text className="text-xs text-emerald-700">
                {i18n.preferredTimeSelected}: {formatLocalHourMinute(new Date(selectedFulfillmentTimeIso))}
              </Text>
            )}
          </View>
          {(isRestaurantTemporarilyClosed || availabilityError) && (
            <View className="bg-red-50 border border-red-200 rounded-lg p-3">
              <Text className="text-xs text-red-700">
                {availabilityError || i18n.unavailableRestaurantClosed}
              </Text>
            </View>
          )}
          {isCheckingAvailability && (
            <Text className="text-xs text-amber-700">{i18n.checkingAvailability}</Text>
          )}
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3 mt-4">
          <Button
            title={i18n.back}
            variant="outline"
            onPress={handleBackStep}
            className="flex-1"
            size="lg"
          />
          <Button
            title={i18n.continue}
            onPress={handleNextStep}
            className="flex-1"
            size="lg"
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderPayment = () => (
    <ScrollView className="flex-1" contentContainerClassName="p-4">
      {/* Order Summary - MOBILE OPTIMIZED (no sidebar) */}
      <View className="bg-card rounded-xl p-4 mb-4 border border-[#e1a255]/40">
        <Text className="text-base font-extrabold mb-3">
          {i18n.summaryTitle} ({orderType === 'eat_in' ? i18n.table : orderType === 'take_away' ? i18n.pickup : i18n.delivery})
        </Text>

        {/* Offline indicator - Compact */}
        {!isOnline && (
          <View className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-3 flex-row items-center gap-2">
            <FontAwesome name="wifi" size={18} color="#92400e" />
            <View>
              <Text className="font-bold text-amber-800 text-sm">{i18n.offline}</Text>
              <Text className="text-amber-700 text-xs">{i18n.offlineOrderSaved}</Text>
            </View>
          </View>
        )}

        {/* Items List - Compact */}
        <View className="gap-2 mb-3">
          {items.map((item, idx) => (
            <View key={idx} className="flex-row justify-between items-center py-2 border-b border-border last:border-0">
              <View className="flex-1">
                <Text className="text-sm font-medium" numberOfLines={1}>{item.product.name}</Text>
                <Text className="text-xs text-muted-foreground">x{item.quantity}</Text>
              </View>
              <Text className="text-sm font-bold">€{(item.product.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View className="pt-3 border-t border-border gap-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-gray-600">{i18n.subtotal}</Text>
            <Text className="text-sm font-bold text-gray-900">€{totalAmount.toFixed(2)}</Text>
          </View>
          {appliedDeliveryFee > 0 && (
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-600">{i18n.deliveryFee}</Text>
              <Text className="text-sm font-bold text-gray-900">€{appliedDeliveryFee.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Total */}
        <View className="flex-row justify-between items-center pt-3 border-t border-border">
          <Text className="text-base font-bold">{i18n.total}</Text>
          <Text className="text-2xl font-bold text-primary">€{checkoutTotal.toFixed(2)}</Text>
        </View>
      </View>

      {orderType === 'delivery' && (
        <View className="bg-card rounded-xl p-4 mb-4 border border-[#e1a255]/40">
          <Text className="text-base font-extrabold mb-2">{language === 'en' ? 'Delivery destination' : 'Indirizzo di consegna'}</Text>
          <View className="bg-[#f9ecdd] border border-[#e1a255]/60 rounded-xl p-3">
            <Text className="text-sm font-bold text-gray-900">
              {name || 'The Greenwich Loft'}
            </Text>
            <Text className="text-xs text-gray-600 mt-1">
              {address || '152 Mercer St, New York, NY 10012'}
            </Text>
          </View>
        </View>
      )}

      {/* Payment Methods */}
      <View className="mb-4">
        <Text className="text-lg font-bold mb-3">{i18n.paymentMethod}</Text>
        
        <View className="gap-3">
          <Pressable
            className={`p-4 rounded-xl border-2 flex-row items-center gap-3 ${
              paymentProvider === 'stripe' ? 'bg-[#f9ecdd] border-[#8d171e]' : 'bg-card border-border'
            }`}
            onPress={() => setPaymentProvider('stripe')}
            disabled={isProcessing}
          >
            <FontAwesome name="credit-card" size={22} color="#374151" />
            <View className="flex-1">
              <Text className="font-bold text-base">{i18n.card}</Text>
              <Text className="text-muted-foreground text-xs">{i18n.cardSubtitle}</Text>
            </View>
          </Pressable>

          {!isDelivery && (
            <Pressable
              className={`p-4 rounded-xl border-2 flex-row items-center gap-3 ${
                paymentProvider === 'terminal' ? 'bg-[#f9ecdd] border-[#8d171e]' : 'bg-card border-border'
              }`}
              onPress={() => setPaymentProvider('terminal')}
              disabled={isProcessing}
            >
              <FontAwesome name="building-o" size={22} color="#374151" />
              <View className="flex-1">
                <Text className="font-bold text-base">{i18n.terminal}</Text>
                <Text className="text-muted-foreground text-xs">{i18n.terminalSubtitle}</Text>
              </View>
            </Pressable>
          )}

          <Pressable
            className={`p-4 rounded-xl border-2 flex-row items-center gap-3 ${
              paymentProvider === 'cash' ? 'bg-[#f9ecdd] border-[#8d171e]' : 'bg-card border-border'
            }`}
            onPress={() => setPaymentProvider('cash')}
            disabled={isProcessing}
          >
            <FontAwesome name="money" size={22} color="#374151" />
            <View className="flex-1">
              <Text className="font-bold text-base">{i18n.cash}</Text>
              <Text className="text-muted-foreground text-xs">
                {isDelivery ? i18n.cashDeliverySubtitle : i18n.cashSubtitle}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Footer Buttons */}
        <View className="gap-3 mt-4">
          <Button
            title={i18n.back}
            variant="outline"
            onPress={handleBackStep}
            disabled={isProcessing}
            size="lg"
          />
          <Button
            title={isProcessing ? '...' : (isOnline ? i18n.confirmOrder : i18n.saveOrder)}
            onPress={handlePayment}
            disabled={isProcessing}
            size="lg"
          />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <>
      {/* Hide Expo Router default header */}
      <Stack.Screen options={{ headerShown: false }} />
      
      <View className="flex-1 bg-[#f9ecdd]">
        {/* Custom Header with Back Button and Title */}
        <View className="pt-4 pb-3 border-b border-[#e1a255]/40 bg-white">
          <View className="flex-row items-center justify-between px-4 mb-2">
            <Pressable onPress={handleBackStep} className="p-2">
              <FontAwesome name="arrow-left" size={20} color="#000" />
            </Pressable>
            <Text className="text-xl font-bold flex-1 text-center">
              {step === 'type' ? i18n.reviewTitle : step === 'details' ? i18n.detailsTitle : i18n.paymentTitle}
            </Text>
            <View className="w-10" />
          </View>
          <View className="flex-row gap-2 justify-center">
            <View className={`h-2 w-16 rounded-full ${step === 'type' ? 'bg-primary' : 'bg-primary/30'}`} />
            <View className={`h-2 w-16 rounded-full ${step === 'details' ? 'bg-primary' : 'bg-primary/30'}`} />
            <View className={`h-2 w-16 rounded-full ${step === 'payment' ? 'bg-primary' : 'bg-primary/30'}`} />
          </View>
        </View>

        {step === 'type' && renderOrderTypeSelection()}
        {step === 'details' && renderDetailsForm()}
        {step === 'payment' && renderPayment()}

        <Modal
          transparent
          animationType="slide"
          visible={showPhonePrefixModal}
          onRequestClose={() => setShowPhonePrefixModal(false)}
        >
          <View className="flex-1 bg-black/35 justify-end">
            <View className="bg-white rounded-t-2xl p-4 border-t border-[#e1a255]/40">
              <Text className="text-base font-bold mb-3">{i18n.phonePrefixLabel}</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[52px] mb-3"
                placeholder={language === 'en' ? 'Search country or prefix' : 'Cerca paese o prefisso'}
                value={phonePrefixSearch}
                onChangeText={setPhonePrefixSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ScrollView className="max-h-[320px]">
                {filteredPhonePrefixOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    className={`h-12 px-3 rounded-lg flex-row items-center justify-between mb-2 ${
                      selectedPhoneOptionId === option.id ? 'bg-[#f9ecdd] border border-[#e1a255]/60' : 'bg-gray-50'
                    }`}
                    onPress={() => {
                      setSelectedPhoneOptionId(option.id);
                      setShowPhonePrefixModal(false);
                      setPhonePrefixSearch('');
                    }}
                  >
                    <View className="flex-row items-center gap-2 flex-1">
                      {getFlagImageUri(option.countryCode) ? (
                        <Image
                          source={{ uri: getFlagImageUri(option.countryCode)! }}
                          className="w-6 h-4 rounded-sm"
                          resizeMode="cover"
                        />
                      ) : (
                        <Text className="text-sm">{option.flag}</Text>
                      )}
                      <Text className="text-sm font-medium flex-1" numberOfLines={1}>
                        {option.countryName}
                      </Text>
                    </View>
                    <Text className="text-sm text-gray-700">{option.dialCode}</Text>
                  </Pressable>
                ))}
                {filteredPhonePrefixOptions.length === 0 && (
                  <View className="h-16 items-center justify-center">
                    <Text className="text-sm text-gray-500">
                      {language === 'en' ? 'No countries found' : 'Nessun paese trovato'}
                    </Text>
                  </View>
                )}
              </ScrollView>
              <Button
                title={language === 'en' ? 'Close' : 'Chiudi'}
                variant="outline"
                onPress={() => {
                  setShowPhonePrefixModal(false);
                  setPhonePrefixSearch('');
                }}
                className="mt-2"
              />
            </View>
          </View>
        </Modal>

        <TimeWheelModal
          visible={showFulfillmentPicker}
          title={i18n.selectTimePlaceholder}
          confirmLabel={i18n.continue}
          hourMin={0}
          hourMax={23}
          minuteStep={5}
          initialHour={
            selectedFulfillmentTimeIso
              ? new Date(selectedFulfillmentTimeIso).getHours()
              : new Date().getHours()
          }
          initialMinute={
            selectedFulfillmentTimeIso
              ? new Date(selectedFulfillmentTimeIso).getMinutes()
              : 0
          }
          onClose={() => setShowFulfillmentPicker(false)}
          onConfirm={(hour, minute) => {
            const requestedKey = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const candidate = availableTimeSlots.find((slot) => slot.key === requestedKey) ?? availableTimeSlots[0];
            if (candidate) {
              setFulfillmentMode('scheduled');
              setSelectedFulfillmentTimeIso(candidate.iso);
            }
            setShowFulfillmentPicker(false);
          }}
        />

        <Modal
          transparent
          animationType="fade"
          visible={showConfirmationModal}
          onRequestClose={() => setShowConfirmationModal(false)}
        >
          <View className="flex-1 bg-black/45 items-center justify-center p-6">
            <View className="w-full max-w-[360px] bg-white rounded-2xl border border-[#e1a255]/40 p-5">
              <View className="items-center mb-2">
                <View className="w-12 h-12 rounded-full bg-emerald-100 items-center justify-center">
                  <FontAwesome name="check" size={20} color="#047857" />
                </View>
              </View>
              <Text className="text-xl font-extrabold text-center text-gray-900">
                {i18n.orderConfirmed}
              </Text>
              <Text className="text-sm text-gray-600 text-center mt-2">
                Il tuo ordine #{(confirmedOrderId || 'N/A').slice(0, 8).toUpperCase()} e stato ricevuto.
              </Text>
              <Pressable
                className="mt-4 h-12 rounded-xl bg-[#8d171e] items-center justify-center active:opacity-90"
                onPress={() => {
                  setShowConfirmationModal(false);
                  router.replace(
                    `/order-success?orderId=${confirmedOrderId || ''}&orderType=${orderType}`
                  );
                }}
              >
                <Text className="text-white font-bold">{i18n.openSummary}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      </View>
    </>
  );
}
