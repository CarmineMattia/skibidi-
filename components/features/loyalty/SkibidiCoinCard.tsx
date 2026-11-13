import { useLoyaltyLedger, useLoyaltySummary } from '@/lib/hooks/useLoyalty';
import { isExpiringSoon, ledgerTypeLabel } from '@/lib/loyalty/points';
import { ActivityIndicator, Text, View } from 'react-native';

function formatWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SkibidiCoinCard() {
  const summary = useLoyaltySummary();
  const ledger = useLoyaltyLedger(summary.isSuccess);

  return (
    <View className="bg-white rounded-2xl p-5 border border-[#e1a255]/40 mb-6 gap-3">
      <Text className="text-xs font-bold uppercase tracking-wider text-[#8d171e]">Skibidi Coin</Text>
      <Text className="text-lg font-black text-gray-900">Punti della pizzeria</Text>
      {summary.isLoading ? <ActivityIndicator color="#8d171e" /> : null}
      {summary.isError ? (
        <Text className="text-sm text-red-700">Il saldo non è disponibile in questo momento.</Text>
      ) : null}
      {summary.data && !summary.data.enabled ? (
        <Text className="text-sm text-gray-600">Skibidi Coin non è attivo per questo account.</Text>
      ) : null}
      {summary.data?.enabled ? (
        <View className="gap-1">
          <Text className="text-3xl font-black text-gray-900">{summary.data.balance}</Text>
          <Text className="text-sm text-gray-600">
            {summary.data.pointsPerRedeemUnit} punti = €{summary.data.redeemValueEur.toFixed(2)} di sconto in cassa.
            Scadono dopo {summary.data.expiryMonths} mesi.
          </Text>
          {summary.data.expiringSoon > 0 ? (
            <Text className="text-sm font-bold text-[#8d171e]">
              {summary.data.expiringSoon} punti in scadenza
              {summary.data.nextExpiresAt ? ` dal ${formatWhen(summary.data.nextExpiresAt)}` : ''}.
            </Text>
          ) : (
            <Text className="text-sm text-gray-600">Nessun punto in scadenza nei prossimi 30 giorni.</Text>
          )}
        </View>
      ) : null}
      {ledger.data && ledger.data.length > 0 ? (
        <View className="gap-2 pt-2 border-t border-[#e1a255]/30">
          <Text className="font-bold text-gray-900">Storico</Text>
          {ledger.data.map((row) => (
            <View key={row.id} className="flex-row justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">{ledgerTypeLabel(row.entry_type)}</Text>
                <Text className="text-xs text-gray-500">
                  {formatWhen(row.created_at)}
                  {row.expires_at && isExpiringSoon(row.expires_at) ? ' · in scadenza' : ''}
                  {row.reason ? ` · ${row.reason}` : ''}
                </Text>
              </View>
              <Text className={`font-black ${row.quantity < 0 ? 'text-[#8d171e]' : 'text-emerald-700'}`}>
                {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text className="text-xs text-gray-500">
        I punti sono un vantaggio del contratto con la pizzeria: non sono una valuta, non si comprano e non si passano ad altri clienti. Non li usiamo per profilarti.
      </Text>
    </View>
  );
}
