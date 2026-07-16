import { describe, expect, it } from 'vitest';
import {
  buildRescheduleNote,
  formatRescheduleLabel,
  parseRescheduleFromNote,
} from '../../lib/utils/orderDecline';

describe('orderDecline', () => {
  it('builds and parses reschedule token', () => {
    const note = buildRescheduleNote('2026-07-15T19:30:00.000Z', 'Cliente concordato');
    const parsed = parseRescheduleFromNote(note);

    expect(parsed.rescheduleAt).toBe('2026-07-15T19:30:00.000Z');
    expect(parsed.message).toBe('Cliente concordato');
    expect(formatRescheduleLabel(parsed.rescheduleAt)).toBeTruthy();
  });
});
