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

export type NoShowListOrder = NoShowOrder & { id: string };

/**
 * Solo ordini pronti, legati a un account cliente e non ancora segnati.
 * `markedOrderIds`: ordini con un record in order_no_shows (dal server) o
 * appena segnati in questa sessione.
 */
export function canMarkNoShow(order: NoShowListOrder, markedOrderIds: ReadonlySet<string> = new Set()): boolean {
  return order.status === 'ready' && Boolean(order.customer_id) && !markedOrderIds.has(order.id);
}

type SelectClient = {
  from: (table: string) => {
    select: (cols: string) => { in: (col: string, values: string[]) => PromiseLike<{ data: { order_id: string }[] | null; error: { message: string } | null }> };
  };
};

/** Id degli ordini che hanno già un "non ritirato" registrato (order_no_shows, lettura staff). */
export async function fetchMarkedNoShowOrderIds(client: SelectClient, orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();
  const { data, error } = await client.from('order_no_shows').select('order_id').in('order_id', orderIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.order_id));
}

/** Unione tra record del server e segnalazioni locali. */
export function mergeMarkedOrderIds(server: ReadonlySet<string> | undefined, local: ReadonlySet<string>): Set<string> {
  return new Set([...(server ?? []), ...local]);
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
