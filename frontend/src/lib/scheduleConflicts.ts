/** Treat bookings within 15 minutes as the same slot (FE + BE aligned). */
const SAME_TIME_WINDOW_MS = 15 * 60_000;

export type OccupiedScheduleSlot = {
  kind: 'CALL' | 'CHAT';
  scheduledFor: string;
};

export function timesConflict(a: Date | string, b: Date | string) {
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return Math.abs(left - right) <= SAME_TIME_WINDOW_MS;
}

/** Returns a user-facing error if `when` clashes with an open call/chat. */
export function sameTimeConflictMessage(
  when: Date | string,
  occupied: OccupiedScheduleSlot[],
): string | null {
  for (const slot of occupied) {
    if (!timesConflict(when, slot.scheduledFor)) continue;
    if (slot.kind === 'CALL') {
      return 'You already have a call scheduled at this time. Pick another time.';
    }
    return 'You already have a chat scheduled at this time. Pick another time.';
  }
  return null;
}
