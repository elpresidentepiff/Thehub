/**
 * Booking periods: half-open [start, end), the same semantics as tstzrange '[)' in the
 * database, so a booking ending at 12:00 and one starting at 12:00 never collide.
 *
 * Opening hours are London wall-clock times; everything stored is an instant. London's
 * UTC offset is taken from Intl, so BST/GMT changes need no hand-maintained table.
 */
export interface Period {
  start: Date;
  end: Date;
}

export interface BookingRules {
  /** ISO weekdays the floor opens (1 = Monday … 7 = Sunday). */
  openDays: readonly number[];
  opens: string; // 'HH:MM' London
  closes: string; // 'HH:MM' London
  slotMinutes: number;
  maxAdvanceDays: number;
}

export type PeriodProblem =
  | 'invalid_period'
  | 'in_past'
  | 'too_far_ahead'
  | 'not_on_slot'
  | 'spans_days'
  | 'closed_day'
  | 'outside_hours'
  | 'too_short'
  | 'too_long';

export const overlaps = (a: Period, b: Period): boolean => a.start < b.end && b.start < a.end;
export const durationMinutes = (p: Period): number => (p.end.getTime() - p.start.getTime()) / 60_000;

const TZ = 'Europe/London';
const wallFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function wallParts(at: Date) {
  const parts = Object.fromEntries(wallFormat.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY[parts.weekday ?? ''] ?? 0,
  };
}

/** London's offset from UTC, in minutes, at an instant (0 in GMT, 60 in BST). */
function londonOffsetMinutes(at: Date): number {
  const w = wallParts(at);
  return Math.round((Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - at.getTime()) / 60_000);
}

const hhmm = (t: string): number => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) throw new Error(`expected HH:MM, got "${t}"`);
  return Number(m[1]) * 60 + Number(m[2]);
};

/** The instant at which a London wall clock reads `time` on `date` (YYYY-MM-DD). */
export function londonTime(date: string, time: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!d) throw new Error(`expected YYYY-MM-DD, got "${date}"`);
  const mins = hhmm(time);
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Math.floor(mins / 60), mins % 60);
  let t = guess - londonOffsetMinutes(new Date(guess)) * 60_000;
  t = guess - londonOffsetMinutes(new Date(t)) * 60_000; // second pass settles the DST edge
  return new Date(t);
}

/** London calendar date, minutes past midnight and ISO weekday of an instant. */
export function londonWallClock(at: Date): { date: string; minutes: number; weekday: number } {
  const w = wallParts(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${w.year}-${pad(w.month)}-${pad(w.day)}`, minutes: w.hour * 60 + w.minute, weekday: w.weekday };
}

/** A whole opening day, [opens, closes) London time. */
export function dayPeriod(date: string, rules: BookingRules): Period {
  return { start: londonTime(date, rules.opens), end: londonTime(date, rules.closes) };
}

export function validatePeriod(
  period: Period,
  opts: { rules: BookingRules; minMinutes?: number; maxMinutes?: number; now: Date },
): { ok: true } | { ok: false; problem: PeriodProblem } {
  const { rules, now } = opts;
  const bad = (problem: PeriodProblem) => ({ ok: false as const, problem });
  const s = period.start.getTime();
  const e = period.end.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return bad('invalid_period');
  // The slot in progress may still be booked; anything that started earlier may not.
  if (e <= now.getTime() || s < now.getTime() - rules.slotMinutes * 60_000) return bad('in_past');
  if (s > now.getTime() + rules.maxAdvanceDays * 86_400_000) return bad('too_far_ahead');

  const a = londonWallClock(period.start);
  const b = londonWallClock(period.end);
  if (a.minutes % rules.slotMinutes || b.minutes % rules.slotMinutes || s % 60_000 || e % 60_000) {
    return bad('not_on_slot');
  }
  if (a.date !== b.date) return bad('spans_days');
  if (!rules.openDays.includes(a.weekday)) return bad('closed_day');
  if (a.minutes < hhmm(rules.opens) || b.minutes > hhmm(rules.closes)) return bad('outside_hours');

  const mins = durationMinutes(period);
  if (opts.minMinutes !== undefined && mins < opts.minMinutes) return bad('too_short');
  if (opts.maxMinutes !== undefined && mins > opts.maxMinutes) return bad('too_long');
  return { ok: true };
}
