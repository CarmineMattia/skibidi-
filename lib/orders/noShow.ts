/**
 * "Non ritirato" (no-show): l'admin segna che il cliente non è passato a
 * ritirare. Chiama mark_order_no_show di #20, che registra il mancato ritiro e
 * blocca il cliente alla soglia della pizzeria (default 3).
 */
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type NoShowOrder = { status: string; customer_id: string | null };
export type NoShowResult = { customer_id: string; no_show_count: number; blocked: boolean };

/** Solo ordini pronti e non ritirati, legati a un account cliente. */
export function canMarkNoShow(order: NoShowOrder): boolean {
  return order.status === 'ready' && Boolean(order.customer_id);
}

export async function markOrderNoShow(client: RpcClient, orderId: string, note?: string): Promise<NoShowResult> {
  const { data, error } = await client.rpc('mark_order_no_show', { p_order_id: orderId, p_note: note ?? null });
  if (error) throw new Error(`Non ritirato non salvato: ${error.message}`);
  const result = data as Partial<NoShowResult> | null;
  if (!result || typeof result.no_show_count !== 'number') {
    throw new Error('Non ritirato non salvato: risposta inattesa dal server.');
  }
  return { customer_id: String(result.customer_id), no_show_count: result.no_show_count, blocked: Boolean(result.blocked) };
}

export function noShowResultMessage(result: NoShowResult): string {
  const times = result.no_show_count === 1 ? '1 mancato ritiro' : `${result.no_show_count} mancati ritiri`;
  return result.blocked ? `Segnato. Cliente bloccato (${times}).` : `Segnato. Il cliente ha ${times}.`;
}
