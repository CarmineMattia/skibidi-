import type { OrderStatus } from '@/types/database.types';

export type OrderType = 'eat_in' | 'take_away' | 'delivery';

export type TrackingStepIcon =
  | 'check-circle'
  | 'cutlery'
  | 'bell'
  | 'shopping-bag'
  | 'motorcycle'
  | 'home'
  | 'times-circle'
  | 'fire';

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
  pending: 'In attesa di accettazione',
  preparing: 'In preparazione',
  ready: 'Pronto',
  delivered: 'Completato',
  cancelled: 'Rifiutato',
};

const STEP_SUBTEXT: Record<TrackingStepState, string> = {
  completed: 'Fatto',
  active: 'In corso ora',
  upcoming: 'In attesa',
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

/** When a step is done, show a clearer past-tense label + check icon. */
function resolveCompletedPresentation(
  key: string,
  label: string
): { label: string; icon: TrackingStepIcon } {
  switch (key) {
    case 'confirmed':
      return { label: 'Accettato', icon: 'check-circle' };
    case 'preparing':
      return { label: 'Preparato', icon: 'check-circle' };
    case 'ready':
    case 'pickup':
      return { label: key === 'pickup' ? 'Pronto per il ritiro' : 'Pronto', icon: 'check-circle' };
    case 'delivery':
      return { label: 'In consegna', icon: 'check-circle' };
    case 'served':
      return { label: 'Servito al tavolo', icon: 'check-circle' };
    case 'delivered':
      return { label: 'Consegnato', icon: 'check-circle' };
    default:
      return { label, icon: 'check-circle' };
  }
}

function buildStep(
  key: string,
  label: string,
  icon: TrackingStepIcon,
  minRank: number,
  status: OrderStatus
): TrackingStep {
  const state = getStepState(minRank, status);
  if (state === 'completed') {
    const done = resolveCompletedPresentation(key, label);
    return { key, label: done.label, icon: done.icon, state, subtext: STEP_SUBTEXT.completed };
  }
  if (state === 'active') {
    return { key, label, icon, state, subtext: STEP_SUBTEXT.active };
  }
  return { key, label, icon, state, subtext: STEP_SUBTEXT.upcoming };
}

export function normalizeOrderType(value?: string | null): OrderType {
  if (value === 'eat_in' || value === 'take_away' || value === 'delivery') return value;
  return 'delivery';
}

export function getOrderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL_IT[status];
}

export function getOrderConfirmation(status?: OrderStatus | null): { title: string; message: string; accepted: boolean } {
  if (!status) return { title: 'Verifica ordine', message: 'Lo stato non è verificabile. Riprova senza inviare un altro ordine.', accepted: false };
  if (status === 'pending') return { title: 'Ordine inviato', message: 'L’ordine è salvato nel sistema della pizzeria ed è in attesa di accettazione dalla cucina.', accepted: false };
  if (status === 'cancelled') return { title: 'Ordine non accettato', message: 'La pizzeria ha rifiutato l’ordine. Apri il dettaglio per vedere il motivo.', accepted: false };
  if (status === 'preparing') return { title: 'Ordine accettato', message: 'La cucina ha accettato l’ordine e lo sta preparando.', accepted: true };
  if (status === 'ready') return { title: 'Ordine pronto', message: 'La cucina ha completato la preparazione.', accepted: true };
  return { title: 'Ordine completato', message: 'L’ordine è stato completato dalla pizzeria.', accepted: true };
}

export function getTrackingSteps(
  orderType: OrderType,
  status: OrderStatus | null | undefined
): TrackingStep[] {
  if (!status) return [];
  const resolvedStatus = status;

  if (resolvedStatus === 'cancelled') {
    return [
      { key: 'received', label: 'Ordine inviato', icon: 'check-circle', state: 'completed', subtext: 'Salvato nel sistema' },
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
      { key: 'received', label: 'Ordine inviato', icon: 'check-circle', state: 'completed', subtext: 'Salvato nel sistema' },
      buildStep('confirmed', resolvedStatus === 'pending' ? 'In attesa di accettazione' : 'Accettato', 'check-circle', 0, resolvedStatus),
      buildStep('preparing', 'In preparazione', 'fire', 1, resolvedStatus),
      // Rank 2 = ready → active "Pronto" while waiting to be served
      buildStep('ready', 'Pronto', 'bell', 2, resolvedStatus),
    ];
  }

  if (orderType === 'take_away') {
    return [
      { key: 'received', label: 'Ordine inviato', icon: 'check-circle', state: 'completed', subtext: 'Salvato nel sistema' },
      buildStep('confirmed', resolvedStatus === 'pending' ? 'In attesa di accettazione' : 'Accettato', 'check-circle', 0, resolvedStatus),
      buildStep('preparing', 'In preparazione', 'fire', 1, resolvedStatus),
      buildStep('pickup', 'Pronto per il ritiro', 'shopping-bag', 2, resolvedStatus),
    ];
  }

  return [
    { key: 'received', label: 'Ordine inviato', icon: 'check-circle', state: 'completed', subtext: 'Salvato nel sistema' },
      buildStep('confirmed', resolvedStatus === 'pending' ? 'In attesa di accettazione' : 'Accettato', 'check-circle', 0, resolvedStatus),
    buildStep('preparing', 'In preparazione', 'fire', 1, resolvedStatus),
    buildStep('delivery', 'Pronto per la consegna', 'motorcycle', 2, resolvedStatus),
    buildStep('delivered', 'Consegnato', 'home', 3, resolvedStatus),
  ];
}

export function getTrackingBadge(
  orderType: OrderType,
  status: OrderStatus | null | undefined
): { label: string; icon: 'fire' | 'check' | 'motorcycle' | 'bell' | 'shopping-bag' | 'times' } {
  if (!status) return { label: 'Stato non verificato', icon: 'bell' };
  const resolvedStatus = status;

  if (resolvedStatus === 'cancelled') {
    return { label: 'Ordine rifiutato', icon: 'times' };
  }
  if (resolvedStatus === 'delivered') {
    return { label: 'Completato', icon: 'check' };
  }
  if (resolvedStatus === 'ready') {
    if (orderType === 'take_away') return { label: 'Pronto per il ritiro', icon: 'shopping-bag' };
    if (orderType === 'eat_in') return { label: 'Pronto — in arrivo al tavolo', icon: 'bell' };
    return { label: 'Pronto per la consegna', icon: 'motorcycle' };
  }
  if (resolvedStatus === 'preparing') {
    return { label: 'In preparazione', icon: 'fire' };
  }
  return { label: 'In attesa di accettazione', icon: 'bell' };
}

export function getTrackingSummary(
  orderRef: string,
  orderType: OrderType,
  status: OrderStatus | null | undefined
): string {
  if (!status) return 'Non è possibile verificare lo stato dell’ordine. Riprova prima di inviare un altro ordine.';
  const resolvedStatus = status;

  if (resolvedStatus === 'pending') {
    return 'Il tuo ordine è stato inviato al sistema della pizzeria. La cucina deve ancora accettarlo.';
  }

  if (resolvedStatus === 'cancelled') {
    return `L'ordine ${orderRef} è stato rifiutato dal ristorante.`;
  }
  if (resolvedStatus === 'delivered') {
    if (orderType === 'eat_in') return `L'ordine ${orderRef} è stato servito al tavolo.`;
    if (orderType === 'take_away') return `L'ordine ${orderRef} è stato ritirato.`;
    return `L'ordine ${orderRef} è stato consegnato.`;
  }
  if (resolvedStatus === 'ready') {
    if (orderType === 'take_away') return `L'ordine ${orderRef} è pronto per il ritiro.`;
    if (orderType === 'eat_in') return `L'ordine ${orderRef} è pronto e sta arrivando al tuo tavolo.`;
    return `L'ordine ${orderRef} è pronto e in attesa della consegna.`;
  }
  if (resolvedStatus === 'preparing') {
    if (orderType === 'eat_in') return `L'ordine ${orderRef} è in preparazione per il tavolo.`;
    if (orderType === 'take_away') return `L'ordine ${orderRef} è in preparazione per il ritiro.`;
    return `L'ordine ${orderRef} è in preparazione con cura.`;
  }
  if (orderType === 'eat_in') return `L'ordine ${orderRef} è stato confermato per il tavolo.`;
  if (orderType === 'take_away') return `L'ordine ${orderRef} è stato confermato per il ritiro.`;
  return `L'ordine ${orderRef} è stato confermato e verrà preparato a breve.`;
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
