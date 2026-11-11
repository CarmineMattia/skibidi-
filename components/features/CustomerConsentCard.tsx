import { ConsentChoiceList } from '@/components/features/ConsentChoiceList';
import { supabase } from '@/lib/api/supabase';
import {
  consentAllowsPersonalisation,
  consentErrorMessage,
  consentTextIsDraft,
  emptyConsentChoices,
  formatConsentHistoryLine,
  isMissingConsentRegistry,
  parseConsentDocument,
  parseConsentHistory,
  parseMyConsent,
  parsePersonalisedOffer,
  personalisedOfferLine,
  type ConsentPurpose,
} from '@/lib/privacy/consent';
import { CONSENT_DRAFT_BODY, CONSENT_DRAFT_TITLE } from '@/lib/privacy/consentDraft';
import { useAuth } from '@/lib/stores/AuthContext';
import { useTenant } from '@/lib/stores/TenantContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export function CustomerConsentCard({ variant }: { readonly variant: 'account' | 'prompt' }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isCustomer, user } = useAuth();
  const { companyId } = useTenant();
  const [showNotice, setShowNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  const documentQuery = useQuery({
    queryKey: ['consent-document', userId],
    enabled: isCustomer,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_consent_document');
      if (error) throw error;
      return parseConsentDocument(data);
    },
  });

  const consentQuery = useQuery({
    queryKey: ['my-consent', userId],
    enabled: isCustomer,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_consent');
      if (error) throw error;
      return parseMyConsent(data);
    },
  });

  const historyQuery = useQuery({
    queryKey: ['my-consent-history', userId],
    enabled: isCustomer && variant === 'account',
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_consent_history');
      if (error) throw error;
      return parseConsentHistory(data);
    },
  });

  const choices = consentQuery.data ?? emptyConsentChoices();
  const allowed = consentAllowsPersonalisation(consentQuery.data ?? []);
  const offerQuery = useQuery({
    queryKey: ['personalised-offer', userId, companyId],
    enabled: isCustomer && variant === 'prompt' && allowed && Boolean(companyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_personalised_offer', { p_company: companyId! });
      if (error) throw error;
      return parsePersonalisedOffer(data);
    },
  });

  const save = useMutation({
    mutationFn: async (input: { purpose: ConsentPurpose; granted: boolean; version: string }) => {
      const { error } = await supabase.rpc('set_my_consent', {
        p_purpose: input.purpose,
        p_granted: input.granted,
        p_document_version: input.version,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['my-consent', userId] });
      void queryClient.invalidateQueries({ queryKey: ['my-consent-history', userId] });
      void queryClient.invalidateQueries({ queryKey: ['personalised-offer', userId, companyId] });
    },
    onError: (error) => {
      const row = error as { message?: string; code?: string };
      setFormError(consentErrorMessage(row.message ?? '', row.code));
    },
  });

  if (!isCustomer) return null;

  const registryMissing =
    isMissingConsentRegistry(documentQuery.error) || isMissingConsentRegistry(consentQuery.error);
  const document = documentQuery.data;
  const version = document?.version ?? null;
  const title = document?.title ?? CONSENT_DRAFT_TITLE;
  const body = document?.body ?? CONSENT_DRAFT_BODY;
  const loading = documentQuery.isLoading || consentQuery.isLoading;
  const canToggle = Boolean(version) && !registryMissing && !loading && !save.isPending;
  const draft = consentTextIsDraft(version ?? 'draft', body);
  const offerLine =
    variant === 'prompt' && allowed ? personalisedOfferLine(offerQuery.data ?? { hasConsent: false, productName: null, quantity: 0 }) : null;

  const onToggle = (purpose: ConsentPurpose, granted: boolean) => {
    if (!version) {
      setFormError('Registro consensi non ancora attivo. La scelta non è stata salvata.');
      return;
    }
    save.mutate({ purpose, granted, version });
  };

  return (
    <View className="bg-white rounded-2xl p-5 border border-[#e1a255]/40 mb-4 gap-3">
      <Text className="text-xs font-bold uppercase tracking-wider text-[#8d171e]">
        {variant === 'prompt' ? 'Prima delle offerte su misura' : 'Privacy'}
      </Text>
      <Text className="text-xl font-black text-[#271d19]">
        {variant === 'prompt' ? 'Vuoi proposte basate sui tuoi ordini?' : 'Consensi'}
      </Text>
      {draft ? (
        <Text className="text-sm font-bold leading-5 text-[#8d171e]">
          Bozza da far rileggere. Non è un parere legale.
        </Text>
      ) : null}
      <Text className="text-sm leading-5 text-[#65554c]">
        {variant === 'prompt'
          ? 'Due scelte separate, tutte e due vuote finché non le segni tu. Se non accetti, o se non rispondi, l’ordine non cambia: le combo qui sotto restano uguali per tutti.'
          : 'Due scelte separate, tutte e due vuote finché non le segni tu. Puoi toglierle da qui, con lo stesso gesto.'}
      </Text>

      {registryMissing ? (
        <Text className="text-sm leading-5 text-[#8d171e]">
          Il registro non è ancora attivo: puoi leggere la bozza, ma la scelta non viene salvata. L’ordine funziona lo stesso.
        </Text>
      ) : null}

      {loading ? (
        <Text className="text-sm text-[#65554c]">Caricamento consensi…</Text>
      ) : (
        <View className="gap-3">
          <Text className="text-xs font-bold text-[#8d171e]">Versione {version ?? '2026-11-draft-1'}</Text>
          <ConsentChoiceList choices={choices} disabled={!canToggle} onToggle={onToggle} />
        </View>
      )}

      {formError ? <Text className="text-sm font-bold text-[#8d171e]">{formError}</Text> : null}

      {variant === 'prompt' && allowed ? (
        <Text className="text-sm leading-5 text-[#271d19]">
          {offerQuery.isLoading
            ? 'Cerco una proposta sui tuoi ordini…'
            : offerLine ?? 'Con i consensi attivi non c’è ancora una proposta: servono ordini da questa pizzeria.'}
        </Text>
      ) : null}
      {variant === 'prompt' && !allowed && !loading ? (
        <Text className="text-sm leading-5 text-[#65554c]">
          Senza entrambe le scelte non c’è un’offerta su misura. Il menu e l’ordine restano aperti.
        </Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setShowNotice((open) => !open)} className="self-start">
        <Text className="text-sm font-bold text-[#8d171e]">
          {showNotice ? 'Nascondi l’informativa' : 'Leggi l’informativa'}
        </Text>
      </Pressable>
      {showNotice ? (
        <View className="gap-2 rounded-xl bg-[#fff8ef] p-3">
          <Text className="text-base font-black text-[#271d19]">{title}</Text>
          <Text className="text-xs font-bold text-[#8d171e]">Versione {version ?? '2026-11-draft-1'}</Text>
          <Text className="text-sm leading-5 text-[#271d19]">{body}</Text>
        </View>
      ) : null}

      {variant === 'account' && (historyQuery.data?.length ?? 0) > 0 ? (
        <View className="gap-1">
          <Text className="text-sm font-bold text-[#271d19]">Storico delle tue scelte</Text>
          {historyQuery.data?.map((event) => (
            <Text key={`${event.purpose}-${event.createdAt}-${event.granted}`} className="text-sm leading-5 text-[#65554c]">
              {formatConsentHistoryLine(event)}
            </Text>
          ))}
        </View>
      ) : null}

      {variant === 'prompt' ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/account')} className="self-start">
          <Text className="text-sm font-bold text-[#8d171e]">Le rivedi anche dal tuo account</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
