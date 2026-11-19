import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TapButton } from '../ivy/TapButton';
import { cn } from '../../lib/cn';
import type { ScheduleSessionMode } from '../../lib/chatFormat';
import {
  sameTimeConflictMessage,
  type OccupiedScheduleSlot,
} from '../../lib/scheduleConflicts';
import { callRequestsKey } from '../../lib/queryKeys';
import { createCallRequest, fetchCallRequests } from '../../services/scholaraApi';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const BOOKING_WINDOW_DAYS = 10;

type SessionKind = 'CALL';
type WizardStep =
  | 'date'
  | 'dateConfirm'
  | 'time'
  | 'timeConfirm'
  | 'confirm'
  | 'done';
type AmPm = 'AM' | 'PM';

type ParsedClock = {
  hour12: number;
  minute: number;
  period: AmPm;
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function addDays(d: Date, days: number) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Prefer the latest today/tomorrow mention in chat hints. */
function parseRelativeScheduleDate(
  text: string,
  today: Date,
  maxDate: Date,
): Date | null {
  const lower = text.toLowerCase();
  const matches = [
    ...lower.matchAll(/\b(today|tomorrow|tommorrow|tommorow|tmrw|tmr)\b/g),
  ];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1]?.[1];
  if (!last) return null;
  const candidate =
    last === 'today' ? startOfDay(today) : addDays(today, 1);
  if (
    candidate.getTime() < today.getTime() ||
    candidate.getTime() > maxDate.getTime()
  ) {
    return null;
  }
  return candidate;
}

/** Parse free-form times like 3pm, 3:05 PM, 15:30. Ignores "1:1" style phrases. */
function parseScheduleTime(text: string): ParsedClock | null {
  const lower = text.toLowerCase();
  // Prefer meridiem matches so "3:30 pm" is never overwritten by a bare 24h "3:30".
  const withMeridiem = [
    ...lower.matchAll(
      /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/g,
    ),
  ];
  if (withMeridiem.length > 0) {
    const last = withMeridiem[withMeridiem.length - 1];
    if (!last) return null;
    const hourRaw = Number(last[1]);
    const minuteRaw = last[2] !== undefined ? Number(last[2]) : 0;
    const meridiem = (last[3] ?? '').replace(/\./g, '');
    if (
      !Number.isInteger(hourRaw) ||
      !Number.isInteger(minuteRaw) ||
      hourRaw < 1 ||
      hourRaw > 12 ||
      minuteRaw < 0 ||
      minuteRaw > 59
    ) {
      return null;
    }
    return {
      hour12: hourRaw,
      minute: minuteRaw,
      period: meridiem.startsWith('p') ? 'PM' : 'AM',
    };
  }

  const twentyFour = [
    ...lower.matchAll(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/g),
  ];
  if (twentyFour.length > 0) {
    const last = twentyFour[twentyFour.length - 1];
    if (!last) return null;
    const hourRaw = Number(last[1]);
    const minuteRaw = Number(last[2]);
    if (
      !Number.isInteger(hourRaw) ||
      !Number.isInteger(minuteRaw) ||
      hourRaw < 0 ||
      hourRaw > 23 ||
      minuteRaw < 0 ||
      minuteRaw > 59
    ) {
      return null;
    }
    const period: AmPm = hourRaw >= 12 ? 'PM' : 'AM';
    const hour12 = hourRaw % 12 === 0 ? 12 : hourRaw % 12;
    return { hour12, minute: minuteRaw, period };
  }

  // Bare hour: "at 3", "3 o'clock", "3 oclock" (AM/PM left to the wizard).
  const bareHour = [
    ...lower.matchAll(
      /\b(?:at\s+)?(\d{1,2})(?:\s*o(?:'|’)?\s*clock)?\b(?!\s*(?:a\.?m\.?|p\.?m\.?|:))/g,
    ),
  ];
  if (bareHour.length === 0) return null;
  const lastBare = bareHour[bareHour.length - 1];
  if (!lastBare) return null;
  const hourBare = Number(lastBare[1]);
  if (!Number.isInteger(hourBare) || hourBare < 1 || hourBare > 12) {
    return null;
  }
  return { hour12: hourBare, minute: 0, period: 'AM' };
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function formatReceipt(d: Date) {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatConfirmDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function apiError(err: unknown, fallback: string) {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'message' in err.response.data
  ) {
    const msg = (err.response.data as { message: string | string[] }).message;
    return Array.isArray(msg) ? msg[0] : String(msg);
  }
  return fallback;
}

function buildMonthCells(viewMonth: Date): (Date | null)[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function to24Hour(hour12: number, period: AmPm) {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function combineSchedule(
  date: Date,
  hour12: number,
  minute: number,
  period: AmPm,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    to24Hour(hour12, period),
    minute,
    0,
    0,
  );
}

function formatTimeLabel(hour12: number, minute: number, period: AmPm) {
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function clampHour12(value: number) {
  if (!Number.isFinite(value)) return 12;
  const n = Math.trunc(value);
  if (n < 1) return 1;
  if (n > 12) return 12;
  return n;
}

function clampMinute(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(59, Math.max(0, Math.trunc(value)));
}

function stepPrompt(step: WizardStep) {
  switch (step) {
    case 'date':
      return 'Pick a date for your 1:1 audio call.';
    case 'dateConfirm':
      return 'Confirm this date?';
    case 'time':
      return 'What time works for you?';
    case 'timeConfirm':
      return 'Confirm this time?';
    case 'confirm':
      return 'Ready to request this call?';
    default:
      return '';
  }
}

export type ScheduleWizardStatus = {
  incomplete: boolean;
  kind: 'CALL' | null;
  /** True when the user cancelled — parent should not remount this wizard. */
  dismissed?: boolean;
};

export function SessionSchedulerCard({
  mode,
  canBook,
  roleNote,
  onCancel,
  onStatusChange,
  dateHintText = '',
}: {
  mode: ScheduleSessionMode;
  canBook: boolean;
  roleNote?: string;
  onCancel?: () => void;
  onStatusChange?: (status: ScheduleWizardStatus) => void;
  /** Recent user chat text for date/time hints (never auto-skips confirm). */
  dateHintText?: string;
}) {
  // Demo scheduler is call-first; mode is retained for directive compatibility.
  void mode;
  const queryClient = useQueryClient();
  const callRequestsQuery = useQuery({
    queryKey: callRequestsKey('self'),
    queryFn: () => fetchCallRequests(),
  });
  const occupiedSlots = useMemo((): OccupiedScheduleSlot[] => {
    return (callRequestsQuery.data ?? [])
      .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
      .map(
        (r): OccupiedScheduleSlot => ({
          kind: 'CALL',
          scheduledFor: r.scheduledFor,
        }),
      );
  }, [callRequestsQuery.data]);
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    const tick = () => {
      const next = startOfDay(new Date());
      setToday((prev) => (prev.getTime() === next.getTime() ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const maxDate = useMemo(
    () => addDays(today, BOOKING_WINDOW_DAYS),
    [today],
  );

  const kind: SessionKind = 'CALL';
  const [step, setStep] = useState<WizardStep>('date');
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hour12, setHour12] = useState(10);
  const [hourInput, setHourInput] = useState('10');
  const [minute, setMinute] = useState(0);
  const [minuteInput, setMinuteInput] = useState('00');
  const [period, setPeriod] = useState<AmPm>('AM');
  const [timeTouched, setTimeTouched] = useState(false);
  const [receipt, setReceipt] = useState<{
    kind: SessionKind;
    when: Date;
  } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const appliedDateHintRef = useRef<string | null>(null);
  const appliedTimeHintRef = useRef<string | null>(null);
  const incomplete = !receipt && step !== 'done';

  useEffect(() => {
    onStatusChange?.({ incomplete, kind });
  }, [incomplete, kind, onStatusChange]);

  // Chat → select values only; never skip Confirm steps.
  useEffect(() => {
    const hint = dateHintText.trim();
    if (!hint) return;

    if (step === 'date' || step === 'dateConfirm') {
      if (appliedDateHintRef.current === hint) {
        // still allow time parse below if also present and not applied
      } else {
        const parsedDate = parseRelativeScheduleDate(hint, today, maxDate);
        if (parsedDate) {
          appliedDateHintRef.current = hint;
          setSelectedDate(parsedDate);
          setViewMonth(
            new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1),
          );
          setInlineError(null);
          setStep('dateConfirm');
        }
      }
    }

    if (
      step === 'time' ||
      step === 'timeConfirm' ||
      step === 'date' ||
      step === 'dateConfirm'
    ) {
      if (appliedTimeHintRef.current === hint) return;
      const parsedTime = parseScheduleTime(hint);
      // Only apply time from chat when message looks like a time intent,
      // or we're already on a time step.
      if (!parsedTime) return;
      // On date steps, only preload time when the message includes a clear clock.
      if (step === 'date' || step === 'dateConfirm') {
        const hasClockDetail =
          /\d{1,2}:\d{2}|\d{1,2}\s*(a\.?m\.?|p\.?m\.?)|\bat\s+\d{1,2}\b|\d{1,2}\s*o(?:'|’)?\s*clock/i.test(
            hint,
          );
        if (!hasClockDetail) return;
      }
      appliedTimeHintRef.current = hint;
      setHour12(parsedTime.hour12);
      setHourInput(String(parsedTime.hour12));
      setMinute(parsedTime.minute);
      setMinuteInput(String(parsedTime.minute).padStart(2, '0'));
      setPeriod(parsedTime.period);
      setTimeTouched(true);
      setInlineError(null);
      if (step === 'time') setStep('timeConfirm');
    }
  }, [dateHintText, step, today, maxDate]);

  function handleCancel() {
    onStatusChange?.({ incomplete: false, kind, dismissed: true });
    onCancel?.();
  }

  function applyHourFromInput(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setHourInput(digits);
    if (digits === '') return;
    const parsed = Number(digits);
    const next = clampHour12(parsed);
    setHour12(next);
    setTimeTouched(true);
    if (Number.isFinite(parsed) && parsed !== next) {
      setInlineError(`Hour adjusted to ${next} (use 1–12).`);
    } else {
      setInlineError(null);
    }
  }

  function commitHourInput() {
    const parsed = hourInput === '' ? 12 : Number(hourInput);
    const next = clampHour12(parsed);
    setHour12(next);
    setHourInput(String(next));
    setTimeTouched(true);
    if (Number.isFinite(parsed) && parsed !== next) {
      setInlineError(`Hour adjusted to ${next} (use 1–12).`);
    }
  }

  function applyMinuteFromInput(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setMinuteInput(digits);
    if (digits === '') return;
    const parsed = Number(digits);
    const next = clampMinute(parsed);
    setMinute(next);
    setTimeTouched(true);
    if (Number.isFinite(parsed) && parsed !== next) {
      setInlineError(`Minutes adjusted to ${String(next).padStart(2, '0')} (0–59).`);
    } else {
      setInlineError(null);
    }
  }

  function commitMinuteInput() {
    const parsed = minuteInput === '' ? 0 : Number(minuteInput);
    const next = clampMinute(parsed);
    setMinute(next);
    setMinuteInput(String(next).padStart(2, '0'));
    setTimeTouched(true);
    if (Number.isFinite(parsed) && parsed !== next) {
      setInlineError(`Minutes adjusted to ${String(next).padStart(2, '0')} (0–59).`);
    }
  }

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );
  const maxMonthStart = useMemo(
    () => new Date(maxDate.getFullYear(), maxDate.getMonth(), 1),
    [maxDate],
  );
  const canPrevMonth = viewMonth.getTime() > monthStart.getTime();
  const canNextMonth = viewMonth.getTime() < maxMonthStart.getTime();
  const showMonthNav = canPrevMonth || canNextMonth;

  const scheduledWhen = useMemo(() => {
    if (!selectedDate || !timeTouched) return null;
    return combineSchedule(selectedDate, hour12, minute, period);
  }, [selectedDate, hour12, minute, period, timeTouched]);

  const timeIsPast =
    scheduledWhen !== null && scheduledWhen.getTime() < Date.now();

  const sameTimeConflict = useMemo(
    () =>
      scheduledWhen
        ? sameTimeConflictMessage(scheduledWhen, occupiedSlots)
        : null,
    [scheduledWhen, occupiedSlots],
  );

  const hasOpenCall = occupiedSlots.some((s) => s.kind === 'CALL');
  const kindBlocked = hasOpenCall;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !scheduledWhen) {
        throw new Error('Pick a date and time');
      }
      if (hasOpenCall) {
        throw new Error(
          'You already have a pending or approved call request. Cancel it under Upcoming Sessions before scheduling another.',
        );
      }
      const day = startOfDay(selectedDate);
      if (
        day.getTime() < today.getTime() ||
        day.getTime() > maxDate.getTime()
      ) {
        throw new Error('Pick a date within the next 10 days');
      }
      if (scheduledWhen.getTime() < Date.now() - 60_000) {
        throw new Error('Pick a future date and time');
      }
      const conflict = sameTimeConflictMessage(scheduledWhen, occupiedSlots);
      if (conflict) throw new Error(conflict);
      const scheduledFor = scheduledWhen.toISOString();
      await createCallRequest(scheduledFor);
      return { kind, when: scheduledWhen };
    },
    onSuccess: (data) => {
      setInlineError(null);
      setReceipt(data);
      setStep('done');
      void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      setInlineError(apiError(err, 'Could not send request'));
      // Refresh open slots so a server-side conflict shows immediately.
      void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
    },
  });

  if (!canBook) {
    return (
      <div className="rounded-2xl border border-[#EBE8E0]/80 bg-white p-3.5 text-xs leading-relaxed text-[#8B92A5] shadow-elev1">
        {roleNote ??
          'Only students can book 1:1 audio calls from this assistant. Use Messages for everyday chat with your consultant.'}
      </div>
    );
  }

  if (kindBlocked) {
    const label = 'call';
    return (
      <div className="space-y-3 rounded-2xl border border-[#EBE8E0]/80 bg-white p-3.5 shadow-elev1">
        <p className="text-[13px] font-semibold leading-snug text-[#0F1E36]">
          You already have a {label} scheduled
        </p>
        <p className="text-xs leading-relaxed text-[#525B6B]">
          Cancel or finish your pending/approved {label} under Upcoming
          Sessions before booking another.
        </p>
        {onCancel ? (
          <TapButton
            type="button"
            onClick={handleCancel}
            className="btn-chip flex h-9 w-full items-center justify-center rounded-xl text-xs font-medium"
          >
            Back to menu
          </TapButton>
        ) : null}
      </div>
    );
  }

  if (receipt || step === 'done') {
    const data = receipt;
    const label = 'Call';
    return (
      <div className="space-y-1 rounded-2xl border border-[#EBE8E0]/80 bg-white p-3.5 shadow-elev1">
        <p className="text-[13px] font-semibold leading-snug text-[#0F1E36]">
          ✅ {label} Request Sent
          {data ? ` · ${formatReceipt(data.when)}` : ''} — Pending Consultant
          Approval
        </p>
        <p className="text-xs text-[#525B6B]">
          Your consultant will review this request shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 rounded-2xl border border-[#EBE8E0]/80 bg-white p-3.5 shadow-elev1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A7F6C]">
            Schedule wizard
          </p>
          <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[#0F1E36]">
            {stepPrompt(step)}
          </p>
        </div>
        {onCancel ? (
          <TapButton
            type="button"
            aria-label="Cancel booking"
            onClick={handleCancel}
            className="btn-chip flex h-7 w-7 min-h-0 shrink-0 items-center justify-center rounded-lg"
          >
            <X className="h-3.5 w-3.5" />
          </TapButton>
        ) : null}
      </div>

      {step === 'date' || step === 'dateConfirm' ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#0F1E36]">
              {monthLabel(viewMonth)}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full border border-[#E6D3A3] bg-[#FDF8EC] px-2.5 py-0.5 text-[11px] font-medium text-[#8A6514]">
                Next 10 days
              </span>
              {showMonthNav ? (
                <div className="flex items-center gap-1">
                  {canPrevMonth ? (
                    <TapButton
                      type="button"
                      aria-label="Previous month"
                      className="btn-chip flex h-7 w-7 min-h-0 items-center justify-center rounded-lg"
                      onClick={() => setViewMonth((m) => addMonths(m, -1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </TapButton>
                  ) : null}
                  {canNextMonth ? (
                    <TapButton
                      type="button"
                      aria-label="Next month"
                      className="btn-chip flex h-7 w-7 min-h-0 items-center justify-center rounded-lg"
                      onClick={() => setViewMonth((m) => addMonths(m, 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </TapButton>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="ivy-well rounded-xl p-2.5">
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((d) => (
                <span
                  key={d}
                  className="flex h-6 items-center justify-center text-[10px] font-semibold tracking-wide text-[#8A7F6C]"
                >
                  {d}
                </span>
              ))}
              {cells.map((cell, idx) => {
                if (!cell) {
                  return <span key={`e-${idx}`} className="h-9 w-full" />;
                }
                const locked =
                  cell.getTime() < today.getTime() ||
                  cell.getTime() > maxDate.getTime();
                const isToday = sameDay(cell, today);
                const selected =
                  selectedDate !== null && sameDay(cell, selectedDate);
                return (
                  <button
                    key={cell.toISOString()}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setSelectedDate(cell);
                      setInlineError(null);
                      setStep('dateConfirm');
                    }}
                    className={cn(
                      'relative flex h-9 w-full flex-col items-center justify-center rounded-lg text-xs transition',
                      locked &&
                        'pointer-events-none select-none text-[#C4B8A4] line-through',
                      !locked && !selected && 'btn-chip font-semibold',
                      selected && 'btn-chip-active font-semibold',
                    )}
                  >
                    {cell.getDate()}
                    {isToday && !locked ? (
                      <span
                        className={cn(
                          'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                          selected ? 'bg-[#FFFDF9]/80' : 'bg-[#C8963E]',
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && step === 'dateConfirm' ? (
            <div className="rounded-xl border border-[#EBE8E0] bg-[#F3F2F0] p-3 shadow-well">
              <p className="text-xs text-[#525B6B]">
                Selected:{' '}
                <span className="font-semibold text-[#0F1E36]">
                  {formatConfirmDate(selectedDate)}
                </span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <TapButton
                  type="button"
                  onClick={handleCancel}
                  className="btn-chip flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium"
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  Cancel booking
                </TapButton>
                <TapButton
                  type="button"
                  onClick={() => {
                    setStep('time');
                    setInlineError(null);
                  }}
                  className="btn-primary flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Confirm date
                </TapButton>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[#8A7F6C]">
              Tap a day, or type “today” / “tomorrow” in chat — then confirm.
            </p>
          )}

        </>
      ) : null}

      {(step === 'time' || step === 'timeConfirm') && selectedDate ? (
        <>
          <p className="text-xs text-[#525B6B]">
            Date:{' '}
            <span className="font-semibold text-[#0F1E36]">
              {formatConfirmDate(selectedDate)}
            </span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8A7F6C]">
                Hour (1–12)
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={hourInput}
                onChange={(e) => {
                  applyHourFromInput(e.target.value);
                  setStep('timeConfirm');
                }}
                onBlur={commitHourInput}
                aria-label="Hour"
                className="h-10 w-full rounded-xl border border-[#E2D7C1] bg-[#F7F2E7] px-3 text-sm font-semibold text-[#111E33] outline-none focus:border-[#C8963E] focus:bg-[#FFFDF9]"
                placeholder="10"
              />
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8A7F6C]">
                Minutes (0–59)
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minuteInput}
                onChange={(e) => {
                  applyMinuteFromInput(e.target.value);
                  setStep('timeConfirm');
                }}
                onBlur={commitMinuteInput}
                aria-label="Minutes"
                className="h-10 w-full rounded-xl border border-[#E2D7C1] bg-[#F7F2E7] px-3 text-sm font-semibold text-[#111E33] outline-none focus:border-[#C8963E] focus:bg-[#FFFDF9]"
                placeholder="00"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#8A7F6C]">
            Type any hour and minute, or send a time in chat (like 10:23 am).
          </p>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8A7F6C]">
              AM / PM
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['AM', 'PM'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPeriod(p);
                    setTimeTouched(true);
                    setInlineError(null);
                    setStep('timeConfirm');
                  }}
                  className={cn(
                    'flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition',
                    period === p ? 'btn-chip-active' : 'btn-chip',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {timeTouched ? (
            <div className="rounded-xl border border-[#EBE8E0] bg-[#F3F2F0] p-3 shadow-well">
              <p className="text-xs text-[#525B6B]">
                Selected time:{' '}
                <span className="font-semibold text-[#0F1E36]">
                  {formatTimeLabel(hour12, minute, period)}
                </span>
              </p>
              {timeIsPast ? (
                <p className="mt-2 text-[11px] font-medium text-[#8A7F6C]">
                  That time has already passed today — pick a later time.
                </p>
              ) : null}
              {sameTimeConflict ? (
                <p className="mt-2 text-[11px] font-medium text-destructive">
                  {sameTimeConflict}
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <TapButton
                  type="button"
                  onClick={() => {
                    setStep('dateConfirm');
                    setInlineError(null);
                  }}
                  className="btn-chip flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium"
                >
                  <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                  Back
                </TapButton>
                <TapButton
                  type="button"
                  disabled={timeIsPast || Boolean(sameTimeConflict)}
                  onClick={() => {
                    const nextHour = clampHour12(
                      hourInput === '' ? 12 : Number(hourInput),
                    );
                    const nextMinute = clampMinute(
                      minuteInput === '' ? 0 : Number(minuteInput),
                    );
                    setHour12(nextHour);
                    setHourInput(String(nextHour));
                    setMinute(nextMinute);
                    setMinuteInput(String(nextMinute).padStart(2, '0'));
                    setTimeTouched(true);
                    if (!selectedDate) return;
                    const when = combineSchedule(
                      selectedDate,
                      nextHour,
                      nextMinute,
                      period,
                    );
                    if (when.getTime() < Date.now()) {
                      setInlineError('Pick a future time for today.');
                      return;
                    }
                    const conflict = sameTimeConflictMessage(
                      when,
                      occupiedSlots,
                    );
                    if (conflict) {
                      setInlineError(conflict);
                      return;
                    }
                    setInlineError(null);
                    setStep('confirm');
                  }}
                  className={cn(
                    'flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition',
                    timeIsPast || sameTimeConflict
                      ? 'cursor-not-allowed border border-[#E2D8C5] bg-[#EFE9DC] text-[#9A8F7D]'
                      : 'btn-primary',
                  )}
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Confirm time
                </TapButton>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[#8A7F6C]">
              Enter hour, minutes, and AM/PM — or type a time in chat — then
              confirm.
            </p>
          )}
        </>
      ) : null}

      {step === 'confirm' && selectedDate && scheduledWhen ? (
        <>
          <div className="rounded-xl border border-[#EBE8E0] bg-[#F3F2F0] p-3 shadow-well">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A7F6C]">
              Request summary
            </p>
            <p className="mt-1.5 text-sm font-semibold text-[#0F1E36]">
              1:1 Audio Call
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#525B6B]">
              {formatConfirmDate(selectedDate)} ·{' '}
              {formatTimeLabel(hour12, minute, period)}
            </p>
            <p className="mt-2 text-xs text-[#0F1E36]">
              Send this request to your consultant?
            </p>
          </div>

          {sameTimeConflict ? (
            <p className="text-xs font-medium leading-snug text-destructive">
              {sameTimeConflict}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <TapButton
              type="button"
              disabled={createMutation.isPending}
              onClick={handleCancel}
              className="btn-chip flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-medium"
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              Cancel booking
            </TapButton>
            <TapButton
              type="button"
              disabled={
                createMutation.isPending ||
                timeIsPast ||
                Boolean(sameTimeConflict)
              }
              onClick={() => {
                if (createMutation.isPending) return;
                createMutation.mutate();
              }}
              className={cn(
                'flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold',
                timeIsPast || sameTimeConflict
                  ? 'cursor-not-allowed border border-[#E2D8C5] bg-[#EFE9DC] text-[#9A8F7D]'
                  : 'btn-primary',
              )}
            >
              {createMutation.isPending ? (
                'Sending…'
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Yes, request
                </>
              )}
            </TapButton>
          </div>

          <TapButton
            type="button"
            disabled={createMutation.isPending}
            onClick={() => {
              setStep('time');
              setInlineError(null);
            }}
            className="btn-chip flex h-9 w-full items-center justify-center rounded-xl text-xs font-medium"
          >
            Edit time
          </TapButton>
        </>
      ) : null}

      {inlineError ? (
        <p className="text-xs font-medium leading-snug text-destructive">
          {inlineError}
        </p>
      ) : null}
    </div>
  );
}
