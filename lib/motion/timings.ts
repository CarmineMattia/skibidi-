/** Durate UI: sempre sotto il tetto di 300ms, azzerate se il movimento è ridotto. */

export const MOTION_CAP_MS = 300;
export const UI_MOTION_MS = 220;
export const MICRO_MOTION_MS = 90;
export const ANTICIPATION_MS = 50;

export function motionDuration(reduced: boolean, ms: number): number {
  if (reduced) return 0;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(Math.round(ms), MOTION_CAP_MS);
}
