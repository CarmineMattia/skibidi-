import { PageTitle } from '@/components/ui/PageTitle';
import { supabase } from '@/lib/api/supabase';
import { useIsPlatformOwner } from '@/lib/hooks/useIsPlatformOwner';
import {
  canReadCustomerInsights,
  formatConsentWhen,
  formatHour,
  insightsErrorMessage,
  parseInactiveCustomers,
  parseInactiveDays,
  parseTopProducts,
  parseWeekHourStats,
  weekdayLabel,
  type InactiveCustomer,
  type TopProductStat,
  type WeekHourStat,
} from '@/lib/privacy/consent';
import { useAuth } from '@/lib/stores/AuthContext';
import { useTenant } from '@/lib/stores/TenantContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function errorText(error: unknown): string {
  if (error && typeof error === 'object') {
    const row = error as { message?: string; code?: string };
    return insightsErrorMessage(row.message ?? '', row.code);
  }
  return insightsErrorMessage('');
}

function customerLabel(row: InactiveCustomer): string {
  return row.fullName || row.email || 'Cliente';
}

export default function CustomerInsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin, isAuthenticated, isLoading: authLoading } = useAuth();
  const { companyId } = useTenant();
  const ownerQuery = useIsPlatformOwner();
  const isPlatformOwner = ownerQuery.data === true;
  const canRead = canReadCustomerInsights({ isAdmin, isPlatformOwner });
  const [daysInput, setDaysInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const daysQuery = useQuery({
    queryKey: ['inactive-days', companyId],
    enabled: canRead && Boolean(companyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('profiling_inactive_days', { p_company: companyId! });
      if (error) throw error;
      return typeof data === 'number' ? data : Number(data);
    },
  });

  const parsedDays = typeof daysQuery.data === 'number' ? daysQuery.data : Number(daysQuery.data);
  const savedDays = Number.isFinite(parsedDays) ? parsedDays : null;
  const shownDays = daysInput.trim() === '' && savedDays != null ? String(savedDays) : daysInput;

  const inactiveQuery = useQuery({
    queryKey: ['inactive-customers', companyId, savedDays],
    enabled: canRead && Boolean(companyId) && savedDays != null,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_inactive_customers', {
        p_company: companyId!,
        p_inactive_days: savedDays ?? undefined,
      });
      if (error) throw error;
      return parseInactiveCustomers(data);
    },
  });

  const hoursQuery = useQuery({
    queryKey: ['venue-hours', companyId],
    enabled: canRead && Boolean(companyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('venue_orders_by_weekday_hour', { p_company: companyId! });
      if (error) throw error;
      return parseWeekHourStats(data);
    },
  });

  const productsQuery = useQuery({
    queryKey: ['venue-top-products', companyId],
    enabled: canRead && Boolean(companyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('venue_top_products', { p_company: companyId!, p_limit: 8 });
      if (error) throw error;
      return parseTopProducts(data);
    },
  });

  const saveDays = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase.rpc('set_inactive_customer_days', {
        p_company: companyId!,
        p_days: days,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFormError(null);
      setDaysInput('');
      void queryClient.invalidateQueries({ queryKey: ['inactive-days', companyId] });
      void queryClient.invalidateQueries({ queryKey: ['inactive-customers', companyId] });
    },
    onError: (error) => setFormError(errorText(error)),
  });

  const waitingForOwner = isAuthenticated && !isAdmin && ownerQuery.isLoading;
  const showGate = authLoading || waitingForOwner || !canRead;
  const hours = hoursQuery.data ?? [];
  const byDay = new Map<number, WeekHourStat[]>();
  for (const row of hours) {
    const list = byDay.get(row.weekday) ?? [];
    list.push(row);
    byDay.set(row.weekday, list);
  }

  const onSave = () => {
    const days = parseInactiveDays(shownDays);
    if (days == null) {
      setFormError('I giorni devono essere un numero intero tra 7 e 730.');
      return;
    }
    saveDays.mutate(days);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Andamento e clienti inattivi' }} />
      <PageTitle page="insights" />
      <ScrollView
        className="flex-1 bg-[#f9ecdd]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={canRead && (inactiveQuery.isRefetching || hoursQuery.isRefetching || productsQuery.isRefetching)}
            onRefresh={() => {
              if (!canRead) return;
              void daysQuery.refetch();
              void inactiveQuery.refetch();
              void hoursQuery.refetch();
              void productsQuery.refetch();
            }}
          />
        }
      >
        <View className="px-4 gap-4">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="self-start">
            <Text className="text-sm font-bold text-[#8d171e]">Indietro</Text>
          </Pressable>

          <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5 gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-[#8d171e]">Solo titolare</Text>
            <Text className="text-2xl font-black text-gray-900">Andamento e clienti inattivi</Text>
            <Text className="text-sm leading-5 text-gray-600">
              I numeri di insieme contano tutti gli ordini e non riportano nomi. L’elenco inattivi mostra solo chi ha
              accettato sia la profilazione sia le offerte personalizzate.
            </Text>
          </View>

          {showGate ? (
            <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5">
              <Text className="text-base font-bold text-gray-900">
                {authLoading || waitingForOwner ? 'Verifico l’accesso…' : 'Non hai accesso a questi dati.'}
              </Text>
            </View>
          ) : (
            <>
              <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5 gap-3">
                <Text className="text-lg font-black text-gray-900">Clienti inattivi</Text>
                <Text className="text-sm leading-5 text-gray-600">
                  Clienti con consenso attivo e senza ordini da almeno {savedDays ?? '…'} giorni. Un ordine annullato o
                  rifiutato non conta come ritorno.
                </Text>
                <Text className="text-sm font-bold text-gray-800">Giorni senza ordini</Text>
                <TextInput
                  value={shownDays}
                  onChangeText={setDaysInput}
                  keyboardType="number-pad"
                  accessibilityLabel="Giorni senza ordini"
                  className="rounded-xl border border-[#e1a255]/60 bg-[#fff8ef] px-3 py-3 text-base text-gray-900"
                />
                {formError ? <Text className="text-sm font-bold text-[#8d171e]">{formError}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={onSave}
                  className="rounded-xl bg-[#8d171e] px-4 py-3 active:opacity-80"
                >
                  <Text className="text-center font-bold text-white">
                    {saveDays.isPending ? 'Salvo…' : 'Salva soglia'}
                  </Text>
                </Pressable>
                {inactiveQuery.isLoading ? <Text className="text-sm text-gray-600">Carico l’elenco…</Text> : null}
                {inactiveQuery.isError ? <Text className="text-sm font-bold text-[#8d171e]">{errorText(inactiveQuery.error)}</Text> : null}
                {inactiveQuery.data && inactiveQuery.data.length === 0 ? (
                  <Text className="text-sm text-gray-600">Nessun cliente in questa lista.</Text>
                ) : null}
                {inactiveQuery.data?.map((row) => (
                  <View key={row.customerId} className="border-t border-[#e1a255]/30 pt-3">
                    <Text className="text-base font-bold text-gray-900">{customerLabel(row)}</Text>
                    {row.email ? <Text className="text-sm text-gray-600">{row.email}</Text> : null}
                    <Text className="text-sm text-gray-600">
                      Ultimo ordine {formatConsentWhen(row.lastOrderAt)} · {row.daysSinceOrder} giorni fa
                    </Text>
                  </View>
                ))}
              </View>

              <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5 gap-3">
                <Text className="text-lg font-black text-gray-900">Andamento del locale</Text>
                <Text className="text-sm leading-5 text-gray-600">
                  Ordini non annullati e non rifiutati, in ora di Roma. Nessun nome di cliente.
                </Text>
                {hoursQuery.isLoading ? <Text className="text-sm text-gray-600">Carico gli orari…</Text> : null}
                {hoursQuery.isError ? <Text className="text-sm font-bold text-[#8d171e]">{errorText(hoursQuery.error)}</Text> : null}
                {hoursQuery.data && hours.length === 0 ? (
                  <Text className="text-sm text-gray-600">Non ci sono ancora ordini da riassumere.</Text>
                ) : null}
                {[1, 2, 3, 4, 5, 6, 7].filter((day) => byDay.has(day)).map((day) => {
                  const rows = byDay.get(day) ?? [];
                  const total = rows.reduce((sum, row) => sum + row.orderCount, 0);
                  return (
                    <View key={day} className="gap-1">
                      <Text className="text-base font-bold text-gray-900">
                        {weekdayLabel(day)} · {total} {total === 1 ? 'ordine' : 'ordini'}
                      </Text>
                      {rows.map((row) => (
                        <Text key={`${day}-${row.hour}`} className="text-sm text-gray-600">
                          {formatHour(row.hour)} · {row.orderCount}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>

              <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5 gap-3">
                <Text className="text-lg font-black text-gray-900">Prodotti più richiesti</Text>
                {productsQuery.isLoading ? <Text className="text-sm text-gray-600">Carico i prodotti…</Text> : null}
                {productsQuery.isError ? (
                  <Text className="text-sm font-bold text-[#8d171e]">{errorText(productsQuery.error)}</Text>
                ) : null}
                {productsQuery.data && productsQuery.data.length === 0 ? (
                  <Text className="text-sm text-gray-600">Nessun prodotto da mostrare.</Text>
                ) : null}
                {productsQuery.data?.map((product: TopProductStat, index) => (
                  <Text key={product.productName} className="text-base text-gray-900">
                    {index + 1}. {product.productName} — {product.quantityTotal}{' '}
                    {product.quantityTotal === 1 ? 'pezzo' : 'pezzi'}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
