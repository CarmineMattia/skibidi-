import type { OrderStatus } from '@/types/database.types';

/**
 * Order lifecycle with mandatory manual approval.
 * Mirrors public.is_valid_order_transition (supabase/migrations/20261013_order_manual_approval_guard.sql).
 */
export const ORDER_STATUS_LABEL_IT: Record<OrderStatus, string> = {
  pending: 'In attesa di conferma',
  accepted: 'Accettato',
  preparing: 'In preparazione',
  ready: 'Pronto',
  delivered: 'Ritirato e pagato',
  rejected: 'Rifiutato',
  cancelled: 'Annullato',
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  rejected: [],
  cancelled: [],
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready'];
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['delivered', 'rejected', 'cancelled'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Forward step for the main kitchen/admin button. Pending has none: it needs Accetta/Rifiuta. */
export function getNextForwardStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case 'accepted': return 'preparing';
    case 'preparing': return 'ready';
    case 'ready': return 'delivered';
    default: return null;
  }
}

export function getForwardActionLabel(status: OrderStatus): string | null {
  switch (status) {
    case 'accepted': return 'Inizia preparazione';
    case 'preparing': return 'Segna come Pronto';
    case 'ready': return 'Ritirato e pagato';
    default: return null;
  }
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}
