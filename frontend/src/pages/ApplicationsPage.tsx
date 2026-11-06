import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { formatDisplayDate } from '../lib/statusMaps';
import { fetchApplication, fetchApplications } from '../services/scholaraApi';
import type { ApplicationItem } from '../types/domain';

function stepState(
  status: string,
): 'done' | 'current' | 'future' {
  if (status === 'COMPLETED') return 'done';
  if (status === 'IN_PROGRESS') return 'current';
  return 'future';
}

function JourneyTimeline({
  application,
  onOpenDetail,
}: {
  application: ApplicationItem;
  onOpenDetail: () => void;
}) {
  const steps = [...(application.steps ?? [])].sort(
    (a, b) => a.stepNumber - b.stepNumber,
  );
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.status === 'IN_PROGRESS'),
  );
  const doneCount = steps.filter((s) => s.status === 'COMPLETED').length;
  const [open, setOpen] = useState<number | null>(
    currentIndex >= 0 ? currentIndex : null,
  );

  return (
    <div>
      <ScreenTitle
        eyebrow={application.program.name}
        title={application.university.name}
      />
      <div className="mb-5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Step {Math.min(doneCount + 1, Math.max(steps.length, 1))} of{' '}
          {Math.max(steps.length, 12)}
        </span>
        <span className="font-semibold">
          {steps.length
            ? Math.round((doneCount / steps.length) * 100)
            : 0}
          % complete
        </span>
      </div>

      <ol className="relative">
        {steps.map((s, i) => {
          const state = stepState(s.status);
          const isOpen = open === i;
          return (
            <li key={s.id} className="relative pl-14">
              {i < steps.length - 1 ? (
                <span
                  className={cn(
                    'absolute left-[19px] top-10 h-[calc(100%-1.5rem)] w-px',
                    state === 'done' ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
              <span className="absolute left-0 top-2 flex h-10 w-10 items-center justify-center">
                {state === 'current' ? (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-gold/40"
                    animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                ) : null}
                <span
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold',
                    state === 'done' &&
                      'border-primary bg-primary text-primary-foreground',
                    state === 'current' &&
                      'border-gold bg-gold text-accent-foreground',
                    state === 'future' &&
                      'border-border bg-card text-muted-foreground',
                  )}
                >
                  {state === 'done' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    s.stepNumber
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex min-h-14 w-full items-center justify-between py-2 text-left"
              >
                <span>
                  <span
                    className={cn(
                      'block font-semibold',
                      state === 'future' && 'text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      state === 'current' ? 'text-gold-ink' : 'text-muted-foreground',
                    )}
                  >
                    {state === 'current'
                      ? 'In progress'
                      : s.completedAt
                        ? formatDisplayDate(s.completedAt)
                        : 'Upcoming'}
                  </span>
                </span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-3 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                      {s.notes ?? 'No notes for this step yet.'}
                      {s.completedAt ? (
                        <span className="mt-1 block text-xs font-semibold text-foreground">
                          {formatDisplayDate(s.completedAt)}
                        </span>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>

      <TapButton
        onClick={onOpenDetail}
        className="mt-4 flex w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold"
      >
        Open full application
      </TapButton>
    </div>
  );
}

export function ApplicationsPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['applications', studentId ?? user?.id],
    queryFn: () => fetchApplications(studentId),
  });

  const activeId = selectedId ?? listQuery.data?.[0]?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ['application', activeId],
    queryFn: () => fetchApplication(activeId!),
    enabled: Boolean(activeId),
  });

  const apps = listQuery.data ?? [];
  const showPicker = apps.length > 1;

  const headerNote = useMemo(() => {
    if (!apps.length) return 'No applications seeded yet.';
    return null;
  }, [apps.length]);

  if (listQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading journey…</p>;
  }
  if (listQuery.error || !listQuery.data) {
    return (
      <p className="text-sm text-destructive">Could not load applications.</p>
    );
  }

  return (
    <PageMotion>
      {showPicker ? (
        <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar">
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => setSelectedId(app.id)}
              className={cn(
                'min-h-12 shrink-0 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.08em]',
                (selectedId ?? apps[0]?.id) === app.id
                  ? 'border-gold bg-gold-soft text-gold-ink'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              {app.university.name}
            </button>
          ))}
        </div>
      ) : null}

      {headerNote ? (
        <p className="text-sm text-muted-foreground">{headerNote}</p>
      ) : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading steps…</p>
      ) : detailQuery.data ? (
        <JourneyTimeline
          application={detailQuery.data}
          onOpenDetail={() =>
            navigate(
              studentId
                ? `/app/students/${studentId}/applications/${detailQuery.data!.id}`
                : `/app/applications/${detailQuery.data!.id}`,
            )
          }
        />
      ) : null}
    </PageMotion>
  );
}
