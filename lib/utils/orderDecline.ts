const RESCHEDULE_PREFIX = '[RESCHEDULE:';
const RESCHEDULE_SUFFIX = ']';

export function buildRescheduleNote(isoTime: string, extraNote?: string): string {
  const token = `${RESCHEDULE_PREFIX}${isoTime}${RESCHEDULE_SUFFIX}`;
  const trimmed = extraNote?.trim();
  return trimmed ? `${token} ${trimmed}` : token;
}

export function parseRescheduleFromNote(note?: string | null): {
  rescheduleAt: string | null;
  message: string | null;
} {
  if (!note) return { rescheduleAt: null, message: null };

  const match = note.match(/\[RESCHEDULE:([^\]]+)\]/);
  if (!match) {
    return { rescheduleAt: null, message: note.trim() || null };
  }

  const rescheduleAt = match[1]?.trim() || null;
  const message = note.replace(match[0], '').trim() || null;
  return { rescheduleAt, message };
}

export function formatRescheduleLabel(isoTime: string | null): string | null {
  if (!isoTime) return null;
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
