import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type TimelineStepStatus = 'Done' | 'Current' | 'Upcoming' | 'Skipped';

export type AdmissionTimelineStep = {
  stepNumber: number;
  name: string;
  status: TimelineStepStatus;
  date?: string | null;
  approvedBy?: string | null;
  note?: string | null;
};

export type AdmissionTimelineProps = {
  steps: AdmissionTimelineStep[];
  renderStepAction?: (step: AdmissionTimelineStep) => ReactNode;
};

const STEP_META: Record<
  TimelineStepStatus,
  {
    label: string;
    nodeClass: string;
    lineClass: string;
    textClass: string;
  }
> = {
  Done: {
    label: 'Done',
    nodeClass: 'border-status-verified bg-status-verified text-white',
    lineClass: 'bg-status-verified',
    textClass: 'text-navy',
  },
  Current: {
    label: 'Current',
    nodeClass:
      'border-gold bg-gold text-navy shadow-[0_0_0_4px_rgba(196,163,90,0.25)]',
    lineClass: 'bg-gold',
    textClass: 'text-navy',
  },
  Upcoming: {
    label: 'Upcoming',
    nodeClass: 'border-dashed border-muted bg-ivory text-muted',
    lineClass:
      'bg-[repeating-linear-gradient(to_bottom,#c5ced6_0_4px,transparent_4px_8px)]',
    textClass: 'text-muted',
  },
  Skipped: {
    label: 'Skipped',
    nodeClass: 'border-muted/40 bg-ivory text-muted',
    lineClass: 'bg-muted/30',
    textClass: 'text-muted line-through',
  },
};

export function AdmissionTimeline({
  steps,
  renderStepAction,
}: AdmissionTimelineProps) {
  const ordered = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);

  return (
    <ol className="relative m-0 list-none p-0">
      {ordered.map((step, index) => {
        const meta = STEP_META[step.status];
        const isLast = index === ordered.length - 1;

        return (
          <li
            key={`${step.stepNumber}-${step.name}`}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  'absolute bottom-0 left-[23px] top-12 w-0.5',
                  meta.lineClass,
                )}
              />
            ) : null}

            <div
              className={cn(
                'relative z-10 flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full border-2 font-body text-sm font-bold',
                meta.nodeClass,
              )}
              aria-label={`Step ${step.stepNumber}: ${meta.label}`}
            >
              {step.stepNumber}
            </div>

            <div
              className={cn(
                'min-h-[48px] min-w-0 flex-1 rounded-2xl border px-3 py-3',
                step.status === 'Current'
                  ? 'border-gold bg-gold/10'
                  : 'border-cream-border bg-cream',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h4
                  className={cn(
                    'font-display text-base leading-snug',
                    meta.textClass,
                  )}
                >
                  {step.name}
                </h4>
                <span className="inline-flex min-h-[32px] items-center rounded-full bg-navy/5 px-2.5 font-body text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                  {meta.label}
                </span>
              </div>

              {step.date || step.approvedBy ? (
                <p className="mt-2 font-body text-xs text-muted">
                  {step.date}
                  {step.date && step.approvedBy ? ' · ' : null}
                  {step.approvedBy}
                </p>
              ) : null}

              {step.note ? (
                <blockquote className="mt-2 rounded-lg border border-cream-border bg-ivory px-3 py-2 font-body text-xs italic text-navy">
                  {step.note}
                </blockquote>
              ) : null}

              {renderStepAction ? (
                <div className="mt-3">{renderStepAction(step)}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
