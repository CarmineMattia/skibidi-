import { PageTitle } from '@/components/ui/PageTitle';
import { supabase } from '@/lib/api/supabase';
import { useIsPlatformOwner } from '@/lib/hooks/useIsPlatformOwner';
import { useAuth } from '@/lib/stores/AuthContext';
import { useTenant } from '@/lib/stores/TenantContext';
import {
  canEditCommissionRate,
  canReadCommissionSummary,
  commissionErrorMessage,
  formatCommissionMonth,
  formatEuro,
  formatRateBreakdown,
  formatRatePercent,
  formatRomeDateTime,
  parseCommissionMonths,
  parseDateInput,
  parseRateInput,
  parseRateSchedule,
  type CommissionMonth,
} from '@/lib/utils/commissionSummary';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function errorText(error: unknown): string {
  if (error && typeof error === 'object') {
    const row = error as { message?: string; code?: string };
    return commissionErrorMessage(row.message ?? '', row.code);
  }
  return commissionErrorMessage('');
}

export default function CommissionSummaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin, isAuthenticated, isLoading: authLoading } = useAuth();
  const { companyId } = useTenant();
  const ownerQuery = useIsPlatformOwner();
  const isPlatformOwner = ownerQuery.data === true;
  const canRead = canReadCommissionSummary({ isAdmin, isPlatformOwner });
  const canEdit = canEditCommissionRate(isPlatformOwner);
  const [rateInput, setRateInput] = useState('5');
  const [dateInput, setDateInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['commission-summary', companyId],
    enabled: canRead && Boolean(companyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('commission_monthly_summary', {
        p_company: companyId!,
        p_months: 18,
      });
      if (error) throw error;
      return parseCommissionMonths(data);
    },
  });

  const scheduleQuery = useQuery({
    queryKey: ['commission-rates', companyId],
    enabled: canRead && Boolean(companyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('commission_rate_schedule', {
        p_company: companyId!,
      });
      if (error) throw error;
      return parseRateSchedule(data);
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['commission-summary', companyId] });
    void queryClient.invalidateQueries({ queryKey: ['commission-rates', companyId] });
  };

  const saveRate = useMutation({
    mutationFn: async (input: { rate: number; effectiveOn: string | null }) => {
      const { error } = await supabase.rpc('set_commission_rate', {
        p_company: companyId!,
        p_rate: input.rate,
        p_effective_from: null,
        p_effective_on: input.effectiveOn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFormError(null);
      setDateInput('');
      invalidate();
    },
    onError: (error) => setFormError(errorText(error)),
  });

  const cancelRate = useMutation({
    mutationFn: async (effectiveFrom: string) => {
      const { error } = await supabase.rpc('cancel_scheduled_commission_rate', {
        p_company: companyId!,
        p_effective_from: effectiveFrom,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFormError(null);
      invalidate();
    },
    onError: (error) => setFormError(errorText(error)),
  });

  const waitingForOwner = isAuthenticated && !isAdmin && ownerQuery.isLoading;
  const showGate = authLoading || waitingForOwner || !canRead;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Resoconto commissioni' }} />
      <PageTitle page="commission" />
      <ScrollView
        className="flex-1 bg-[#f9ecdd]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={canRead && (summaryQuery.isRefetching || scheduleQuery.isRefetching)}
            onRefresh={() => {
              if (!canRead) return;
              void summaryQuery.refetch();
              void scheduleQuery.refetch();
            }}
          />
        }
      >
        <View className="px-4 gap-4">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="self-start">
            <Text className="text-sm font-bold text-[#8d171e]">Indietro</Text>
          </Pressable>

          <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5 gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-[#8d171e]">Skibidi</Text>
            <Text className="text-2xl font-black text-gray-900">Resoconto commissioni</Text>
            <Text className="text-sm text-gray-600">
              È un resoconto di lavoro, non una fattura. Il cliente paga alla cassa e non vede queste cifre.
              Entrano solo gli ordini fatti dal cliente sull’app e segnati come ritirati e pagati.
            </Text>
          </View>

          {showGate ? (
            <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5">
              <Text className="text-base text-gray-800">
                {authLoading || waitingForOwner
                  ? 'Caricamento…'
                  : 'Questo resoconto è visibile solo al titolare della pizzeria.'}
              </Text>
            </View>
          ) : !companyId ? (
            <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5">
              <Text className="text-base text-gray-800">Pizzeria non configurata.</Text>
            </View>
          ) : (
            <>
              {summaryQuery.isLoading ? (
                <Text className="text-sm text-gray-600">Caricamento del resoconto…</Text>
              ) : null}
              {summaryQuery.error ? (
                <View className="bg-white rounded-2xl border border-red-200 p-4">
                  <Text className="text-sm text-red-800">{errorText(summaryQuery.error)}</Text>
                </View>
              ) : null}
              {(summaryQuery.data ?? []).map((month) => (
                <MonthCard key={month.month_start} month={month} />
              ))}

              <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5 gap-3">
                <Text className="text-lg font-black text-gray-900">Aliquote</Text>
                <Text className="text-sm text-gray-600">
                  Ogni ordine usa la percentuale in vigore nel momento in cui è stato fatto. Un cambio non riscrive i mesi già chiusi.
                </Text>
                {(scheduleQuery.data ?? []).map((rate) => (
                  <View key={rate.effective_from} className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-gray-900">{formatRatePercent(rate.rate_percent)}</Text>
                      <Text className="text-xs text-gray-600">
                        {rate.is_current ? 'In vigore' : rate.is_scheduled ? 'Programmata' : 'Precedente'}
                        {rate.effective_from ? ` · ${formatRomeDateTime(rate.effective_from)}` : ''}
                      </Text>
                    </View>
                    {canEdit && rate.is_scheduled ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Annulla aliquota ${formatRatePercent(rate.rate_percent)}`}
                        disabled={cancelRate.isPending}
                        onPress={() => cancelRate.mutate(rate.effective_from)}
                        className="px-3 py-2 rounded-lg border border-[#e1a255]/60"
                      >
                        <Text className="text-xs font-bold text-[#8d171e]">Annulla</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}

                {canEdit ? (
                  <View className="gap-2 pt-2">
                    <Text className="text-sm font-bold text-gray-800">Nuova percentuale</Text>
                    <TextInput
                      accessibilityLabel="Nuova percentuale di commissione"
                      value={rateInput}
                      onChangeText={setRateInput}
                      keyboardType="decimal-pad"
                      placeholder="5"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-900"
                    />
                    <TextInput
                      accessibilityLabel="Giorno di decorrenza, formato anno mese giorno"
                      value={dateInput}
                      onChangeText={setDateInput}
                      placeholder="AAAA-MM-GG"
                      autoCapitalize="none"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-900"
                    />
                    {formError ? <Text className="text-sm text-red-700">{formError}</Text> : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={saveRate.isPending}
                      onPress={() => {
                        const rate = parseRateInput(rateInput);
                        if (rate === null) {
                          setFormError('Percentuale non valida. Usa un numero tra 0 e 100, con al massimo due decimali.');
                          return;
                        }
                        saveRate.mutate({ rate, effectiveOn: null });
                      }}
                      className="bg-[#8d171e] rounded-xl px-4 py-3"
                    >
                      <Text className="text-white text-center font-bold">Da questo momento</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saveRate.isPending}
                      onPress={() => {
                        const rate = parseRateInput(rateInput);
                        const effectiveOn = parseDateInput(dateInput);
                        if (rate === null) {
                          setFormError('Percentuale non valida. Usa un numero tra 0 e 100, con al massimo due decimali.');
                          return;
                        }
                        if (!effectiveOn) {
                          setFormError('Indica il giorno di decorrenza nel formato AAAA-MM-GG.');
                          return;
                        }
                        saveRate.mutate({ rate, effectiveOn });
                      }}
                      className="bg-white border border-[#8d171e] rounded-xl px-4 py-3"
                    >
                      <Text className="text-[#8d171e] text-center font-bold">Programma dal giorno indicato</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text className="text-xs text-gray-500">
                    L’aliquota la imposta Skibidi. Qui puoi solo consultarla.
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function MonthCard({ month }: { month: CommissionMonth }) {
  return (
    <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-5 gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-lg font-black text-gray-900 capitalize">{formatCommissionMonth(month.month_start)}</Text>
        <Text className={`text-xs font-bold ${month.is_preview ? 'text-amber-800' : 'text-emerald-800'}`}>
          {month.is_preview ? 'Anteprima' : 'Mese chiuso'}
        </Text>
      </View>
      <Text className="text-sm text-gray-700">Ordini considerati: {month.order_count}</Text>
      <Text className="text-sm text-gray-700">Totale lordo: {formatEuro(month.gross_total)}</Text>
      <Text className="text-sm text-gray-700">Aliquota: {formatRateBreakdown(month.rates)}</Text>
      <Text className="text-base font-black text-[#8d171e]">Commissione: {formatEuro(month.commission_total)}</Text>
      {month.unrated_order_count > 0 ? (
        <Text className="text-sm text-amber-800">
          {month.unrated_order_count} {month.unrated_order_count === 1 ? 'ordine' : 'ordini'} senza aliquota
          {' '}({formatEuro(month.unrated_gross)}) non {month.unrated_order_count === 1 ? 'è contato' : 'sono contati'}.
        </Text>
      ) : null}
      <Text className="text-xs text-gray-500">
        Calcolato il {formatRomeDateTime(month.generated_at) || '—'} (ora di Roma)
      </Text>
    </View>
  );
}
