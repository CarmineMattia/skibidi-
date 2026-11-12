import {
  useLoyaltyCustomerLookup,
  useLoyaltyGift,
  useLoyaltyStaffLedger,
} from '@/lib/hooks/useLoyalty';
import { ledgerTypeLabel } from '@/lib/loyalty/points';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function LoyaltyStaffPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState('');
  const [amount, setAmount] = useState('100');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const lookup = useLoyaltyCustomerLookup(query, open && !customerId);
  const gift = useLoyaltyGift();
  const history = useLoyaltyStaffLedger(open);

  const submit = async () => {
    const quantity = Number(amount);
    if (!customerId) {
      setMessage('Scegli un cliente della pizzeria.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      setMessage('I punti omaggio sono un numero intero da 1 a 10000.');
      return;
    }
    if (reason.trim().length < 3) {
      setMessage('Il motivo è obbligatorio.');
      return;
    }
    setMessage(null);
    try {
      await gift.mutateAsync({ customerId, quantity, reason: reason.trim() });
      setReason('');
      setMessage(`Omaggio di ${quantity} punti registrato.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Omaggio non registrato.');
    }
  };

  return (
    <View className="mx-3 md:mx-8 mt-3 rounded-2xl border border-[#e1a255]/50 bg-white">
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
        className="px-4 py-3 flex-row items-center justify-between"
      >
        <Text className="font-black text-[#1a100c]">Regala punti</Text>
        <Text className="text-sm font-bold text-[#8d171e]">{open ? 'Chiudi' : 'Apri'}</Text>
      </Pressable>
      {open ? (
        <View className="px-4 pb-4 gap-3">
          <Text className="text-xs text-gray-600">
            Omaggio dello staff, con motivo. Non è un acquisto e non si trasferisce tra clienti.
          </Text>
          {customerId ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-bold text-gray-900 flex-1">{customerLabel}</Text>
              <Pressable onPress={() => { setCustomerId(null); setCustomerLabel(''); setQuery(''); }}>
                <Text className="text-sm font-bold text-[#8d171e]">Cambia</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-2">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Nome o email, almeno 3 lettere"
                placeholderTextColor="#999"
                className="border border-[#e1a255]/60 rounded-xl px-3 py-2 text-gray-900"
                autoCapitalize="none"
              />
              {lookup.isFetching ? <ActivityIndicator color="#8d171e" /> : null}
              {(lookup.data ?? []).map((row) => (
                <Pressable
                  key={row.customer_id}
                  onPress={() => {
                    setCustomerId(row.customer_id);
                    setCustomerLabel(`${row.full_name || row.email || 'Cliente'} · ${row.balance} punti`);
                  }}
                  className="rounded-xl border border-[#e1a255]/40 px-3 py-2"
                >
                  <Text className="font-semibold text-gray-900">{row.full_name || 'Senza nome'}</Text>
                  <Text className="text-xs text-gray-600">{row.email || 'senza email'} · saldo {row.balance}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="Punti"
            placeholderTextColor="#999"
            className="border border-[#e1a255]/60 rounded-xl px-3 py-2 text-gray-900"
          />
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Motivo, obbligatorio"
            placeholderTextColor="#999"
            className="border border-[#e1a255]/60 rounded-xl px-3 py-2 text-gray-900"
          />
          {message ? <Text className="text-sm text-gray-800">{message}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={gift.isPending}
            onPress={() => { void submit(); }}
            className="bg-[#8d171e] rounded-xl py-3 items-center"
          >
            <Text className="text-white font-bold">{gift.isPending ? 'Registro…' : 'Regala punti'}</Text>
          </Pressable>
          <View className="gap-2 pt-2">
            <Text className="font-bold text-gray-900">Storico</Text>
            {(history.data ?? []).length === 0 ? (
              <Text className="text-sm text-gray-500">Nessun movimento.</Text>
            ) : (history.data ?? []).map((row) => (
              <View key={row.id} className="flex-row justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    {ledgerTypeLabel(row.entry_type)} · {row.customer_name || 'Cliente'}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {formatWhen(row.created_at)}{row.reason ? ` · ${row.reason}` : ''}
                  </Text>
                </View>
                <Text className="font-black text-gray-900">{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
