import type { OrderStatus } from '@/types/database.types';

export type OrderType = 'eat_in' | 'take_away' | 'delivery';

export type TrackingStepIcon =
  | 'check-circle'
  | 'cutlery'
  | 'bell'
  | 'shopping-bag'
  | 'motorcycle'
  | 'home'
  | 'times-circle';

export type TrackingStepState = 'completed' | 'active' | 'upcoming';

export interface TrackingStep {
  key: string;
  label: string;
  icon: TrackingStepIcon;
  state: TrackingStepState;
  subtext: string;
}

const STATUS_RANK: Record<OrderStatus, number> = {
  pending: 0,
  preparing: 1,
  ready: 2,
  delivered: 3,
  cancelled: -1,
};

const STATUS_LABEL_IT: Record<OrderStatus, string> = {
  pending: 'In attesa',
  preparing: 'In preparazione',
  ready: 'Pronto',
  delivered: 'Completato',
  cancelled: 'Rifiutato',
};

const STEP_SUBTEXT: Record<TrackingStepState, string> = {
  completed: 'Completato',
  active: 'In corso',
  upcoming: 'In attesa del prossimo step',
};

function getStepState(
  stepMinRank: number,
  status: OrderStatus
): TrackingStepState {
  if (status === 'delivered') return 'completed';
  if (status === 'cancelled') return 'upcoming';

  const currentRank = STATUS_RANK[status];
  if (currentRank > stepMinRank) return 'completed';
  if (currentRank === stepMinRank) return 'active';
  return 'upcoming';
}

function buildStep(
  key: string,
  label: string,
  icon: TrackingStepIcon,
  minRank: number,
  status: OrderStatus
): TrackingStep {
  const state = getStepState(minRank, status);
  return { key, label, icon, state, subtext: STEP_SUBTEXT[state] };
}

export function normalizeOrderType(value?: string | null): OrderType {
  if (value === 'eat_in' || value === 'take_away' || value === 'delivery') return value;
  return 'delivery';
}

export function getOrderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL_IT[status];
}

export function getTrackingSteps(
  orderType: OrderType,
  status: OrderStatus | null | undefined
): TrackingStep[] {
  const resolvedStatus = status ?? 'pending';

  if (resolvedStatus === 'cancelled') {
    return [
      buildStep('confirmed', 'Confermato', 'check-circle', 0, 'pending'),
      {
        key: 'cancelled',
        label: 'Rifiutato',
        icon: 'times-circle',
        state: 'active',
        subtext: 'Ordine rifiutato',
      },
    ];
  }

  if (orderType === 'eat_in') {
    return [
      buildStep('confirmed', 'Confermato', 'check-circle', 0, resolvedStatus),
      buildStep('preparing', 'In preparazione', 'cutlery', 1, resolvedStatus),
      buildStep('served', 'Servito al tavolo', 'bell', 3, resolvedStatus),
    ];
  }

  if (orderType === 'take_away') {
    return [
      buildStep('confirmed', 'Confermato', 'check-circle', 0, resolvedStatus),
      buildStep('preparing', 'In preparazione', 'cutlery', 1, resolvedStatus),
      buildStep('pickup', 'Pronto per il ritiro', 'shopping-bag', 2, resolvedStatus),
    ];
  }

  return [
    buildStep('confirmed', 'Confermato', 'check-circle', 0, resolvedStatus),
    buildStep('preparing', 'In preparazione', 'cutlery', 1, resolvedStatus),
    buildStep('delivery', 'In consegna', 'motorcycle', 2, resolvedStatus),
    buildStep('delivered', 'Consegnato', 'home', 3, resolvedStatus),
  ];
}

export function getTrackingBadge(
  orderType: OrderType,
  status: OrderStatus | null | undefined
): { label: string; icon: 'fire' | 'check' | 'motorcycle' | 'bell' | 'shopping-bag' | 'times' } {
  const resolvedStatus = status ?? 'pending';

  if (resolvedStatus === 'cancelled') {
    return { label: 'Ordine rifiutato', icon: 'times' };
  }
  if (resolvedStatus === 'delivered') {
    return { label: 'Completato', icon: 'check' };
  }
  if (resolvedStatus === 'ready') {
    if (orderType === 'take_away') return { label: 'Pronto per il ritiro', icon: 'shopping-bag' };
    if (orderType === 'eat_in') return { label: 'In arrivo al tavolo', icon: 'bell' };
    return { label: 'In consegna', icon: 'motorcycle' };
  }
  if (resolvedStatus === 'preparing') {
    return { label: 'In preparazione', icon: 'fire' };
  }
  return { label: 'Ordine ricevuto', icon: 'check' };
}

export function getTrackingSummary(
  orderRef: string,
  orderType: OrderType,
  status: OrderStatus | null | undefined
): string {
  const resolvedStatus = status ?? 'pending';

  if (resolvedStatus === 'cancelled') {
    return `L'ordine #${orderRef} è stato rifiutato dal ristorante.`;
  }
  if (resolvedStatus === 'delivered') {
    if (orderType === 'eat_in') return `L'ordine #${orderRef} è stato servito al tavolo.`;
    if (orderType === 'take_away') return `L'ordine #${orderRef} è stato ritirato.`;
    return `L'ordine #${orderRef} è stato consegnato.`;
  }
  if (resolvedStatus === 'ready') {
    if (orderType === 'take_away') return `L'ordine #${orderRef} è pronto per il ritiro.`;
    if (orderType === 'eat_in') return `L'ordine #${orderRef} sta arrivando al tuo tavolo.`;
    return `L'ordine #${orderRef} è in consegna verso di te.`;
  }
  if (resolvedStatus === 'preparing') {
    if (orderType === 'eat_in') return `L'ordine #${orderRef} è in preparazione per il tavolo.`;
    if (orderType === 'take_away') return `L'ordine #${orderRef} è in preparazione per il ritiro.`;
    return `L'ordine #${orderRef} è in preparazione con cura.`;
  }
  if (orderType === 'eat_in') return `L'ordine #${orderRef} è stato confermato per il tavolo.`;
  if (orderType === 'take_away') return `L'ordine #${orderRef} è stato confermato per il ritiro.`;
  return `L'ordine #${orderRef} è stato confermato e verrà preparato a breve.`;
}

export function getEstimatedReadyTime(createdAt?: string | null): string {
  if (!createdAt) return '--:--';

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '--:--';

  const estimate = new Date(created.getTime() + 45 * 60 * 1000);
  return estimate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function getStatusBadgeColors(status: OrderStatus): {
  container: string;
  text: string;
} {
  switch (status) {
    case 'pending':
      return { container: 'bg-amber-100', text: 'text-amber-700' };
    case 'preparing':
      return { container: 'bg-sky-100', text: 'text-sky-700' };
    case 'ready':
      return { container: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'delivered':
      return { container: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'cancelled':
      return { container: 'bg-red-100', text: 'text-red-700' };
    default:
      return { container: 'bg-gray-100', text: 'text-gray-700' };
  }
}
