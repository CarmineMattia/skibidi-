export interface BusinessHoursInterval {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface BusinessHoursDay {
  enabled: boolean;
  intervals: BusinessHoursInterval[];
}

export type WeeklyBusinessHours = BusinessHoursDay[];

function parseTimeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hoursString, minutesString] = value.split(':');
  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isWithinInterval(minuteOfDay: number, interval: BusinessHoursInterval): boolean {
  const start = parseTimeToMinutes(interval.start);
  const end = parseTimeToMinutes(interval.end);
  if (start === null || end === null) return false;

  // Same start/end means full day open.
  if (start === end) return true;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  // Overnight span, e.g. 18:00 -> 01:00
  return minuteOfDay >= start || minuteOfDay < end;
}

export function isOpenAt(date: Date, weeklyHours: WeeklyBusinessHours): boolean {
  if (!Array.isArray(weeklyHours) || weeklyHours.length !== 7) return true;

  const dayIndex = date.getDay();
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();

  const today = weeklyHours[dayIndex];
  if (today?.enabled && today.intervals.some((interval) => isWithinInterval(minuteOfDay, interval))) {
    return true;
  }

  const previousDay = weeklyHours[(dayIndex + 6) % 7];
  if (!previousDay?.enabled) return false;

  return previousDay.intervals.some((interval) => {
    const start = parseTimeToMinutes(interval.start);
    const end = parseTimeToMinutes(interval.end);
    if (start === null || end === null) return false;
    return start > end && minuteOfDay < end;
  });
}

export function getNextOpening(date: Date, weeklyHours: WeeklyBusinessHours): Date | null {
  if (!Array.isArray(weeklyHours) || weeklyHours.length !== 7) return null;

  if (isOpenAt(date, weeklyHours)) return new Date(date);

  const nowMs = date.getTime();
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const current = new Date(date);
    current.setDate(current.getDate() + dayOffset);
    current.setHours(0, 0, 0, 0);
    const daySchedule = weeklyHours[current.getDay()];
    if (!daySchedule?.enabled) continue;

    for (const interval of daySchedule.intervals) {
      const start = parseTimeToMinutes(interval.start);
      if (start === null) continue;
      const candidate = new Date(current.getTime() + start * 60_000);
      if (candidate.getTime() <= nowMs) continue;
      return candidate;
    }
  }

  return null;
}
