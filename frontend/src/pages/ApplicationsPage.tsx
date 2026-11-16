import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '../components/ivy/EmptyState';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { formatDisplayDate } from '../lib/statusMaps';
import {
  fetchApplication,
  fetchApplications,
  updateApplicationStep,
} from '../services/scholaraApi';
import type { ApplicationItem, ApplicationStep } from '../types/domain';

function stepState(status: string): 'done' | 'current' | 'future' {
  if (status === 'COMPLETED' || status === 'SKIPPED') return 'done';
  if (status === 'IN_PROGRESS') return 'current';
  return 'future';
}

function stepCaption(
  status: string,
  completedAt: string | null | undefined,
): string {
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'SKIPPED') return 'Skipped';
  if (completedAt) return formatDisplayDate(completedAt);
  if (status === 'COMPLETED') return 'Completed';
  return 'Upcoming';
}

function StepNotesPanel({
  applicationId,
  step,
  canEdit,
}: {
  applicationId: string;
  step: ApplicationStep;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(step.notes ?? '');

  useEffect(() => {
    setDraft(step.notes ?? '');
  }, [step.id, step.notes]);

  const mutation = useMutation({
    mutationFn: (notes: string) =>
      updateApplicationStep(applicationId, step.stepNumber, { notes }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['application', applicationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      toast.success('Notes saved');
    },
    onError: () => toast.error('Could not save notes'),
  });

  const dirty = draft !== (step.notes ?? '');

  if (!canEdit) {
    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {step.notes?.trim() ? step.notes : 'No notes for this step yet.'}
        {step.completedAt ? (
          <span className="mt-2 block text-xs font-medium text-muted-foreground">
            Completed {formatDisplayDate(step.completedAt)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ivy-card mb-5 space-y-3">
      <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Step notes
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Add notes for this step…"
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none ring-gold/40 placeholder:font-medium placeholder:text-muted-foreground focus:ring-2"
      />
      {step.completedAt ? (
        <span className="block text-xs font-medium text-muted-foreground">
          Completed {formatDisplayDate(step.completedAt)}
        </span>
      ) : null}
      <TapButton
        disabled={!dirty || mutation.isPending}
        onClick={() => mutation.mutate(draft.trim())}
        className="btn-primary flex w-full items-center justify-center rounded-xl text-sm font-semibold"
      >
        {mutation.isPending ? 'Saving…' : 'Save notes'}
      </TapButton>
    </div>
  );
}

function JourneyTimeline({
  application,
  canEditNotes,
  onOpenDetail,
}: {
  application: ApplicationItem;
  canEditNotes: boolean;
  onOpenDetail: () => void;
}) {
  const steps = [...(application.steps ?? [])].sort(
    (a, b) => a.stepNumber - b.stepNumber,
  );
  const currentIndex = steps.findIndex((s) => s.status === 'IN_PROGRESS');
  const doneCount = steps.filter(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED',
  ).length;
  const displayStep =
    currentIndex >= 0
      ? (steps[currentIndex]?.stepNumber ?? doneCount + 1)
      : doneCount >= steps.length
        ? steps.length
        : Math.min(doneCount + 1, Math.max(steps.length, 1));
  const pct = steps.length
    ? Math.round((doneCount / steps.length) * 100)
    : 0;
  const [open, setOpen] = useState<number | null>(
    currentIndex >= 0 ? currentIndex : null,
  );

  return (
    <div className="space-y-6">
      <div>
        <ScreenTitle
          eyebrow={application.program.name}
          title={application.university.name}
        />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {steps.length > 0 && doneCount === steps.length
              ? `All ${steps.length} steps complete`
              : `Step ${displayStep} of ${Math.max(steps.length, 1)}`}
          </span>
          <span className="font-semibold text-foreground">{pct}% complete</span>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EAE2D3]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#E6C365] via-[#CFA03A] to-[#B58420]"
            style={{ width: `${pct}%` }}
          />
        </div>
        {steps.length > 0 && doneCount === steps.length ? (
          <p className="status-success mt-3 rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold">
            Journey complete — no outstanding application steps
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[#DFD3BC] bg-[#FFFDF9] p-4 shadow-xs">
        <ol className="relative">
          {steps.map((s, i) => {
            const state = stepState(s.status);
            const isOpen = open === i;
            const isActiveCallout = state === 'current';
            return (
              <li key={s.id} className="relative pl-14">
                {i < steps.length - 1 ? (
                  <span
                    className={cn(
                      'absolute left-[19px] top-10 h-[calc(100%-1.5rem)] w-px',
                      state === 'done' ? 'bg-primary' : 'bg-[#E2D7C1]',
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
                        'border-[#D5C8B0] bg-[#FFFDF9] text-muted-foreground',
                    )}
                  >
                    {state === 'done' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      s.stepNumber
                    )}
                  </span>
                </span>
                <div
                  className={cn(
                    isActiveCallout &&
                      'mb-2 rounded-xl border border-[#DEC484] bg-[#FBF5E6] p-3',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-14 w-full items-center justify-between py-2.5 text-left"
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
                          'text-sm',
                          state === 'current'
                            ? 'font-medium text-gold-ink'
                            : 'text-muted-foreground',
                        )}
                      >
                        {stepCaption(s.status, s.completedAt)}
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
                        <StepNotesPanel
                          applicationId={application.id}
                          step={s}
                          canEdit={canEditNotes}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <TapButton
        onClick={onOpenDetail}
        className="btn-primary flex w-full items-center justify-center rounded-xl text-sm font-semibold"
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
  const canEditNotes = user?.role === 'CONSULTANT';

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
      <div className="space-y-8">
        {showPicker ? (
          <div className="-mx-5 flex items-center gap-2 overflow-x-auto no-scrollbar px-5 py-1">
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedId(app.id)}
                className={cn(
                  'min-h-12 shrink-0 rounded-full px-4 text-xs font-medium uppercase tracking-[0.08em] transition-all duration-200 ease-out active:scale-[0.97]',
                  (selectedId ?? apps[0]?.id) === app.id
                    ? 'btn-chip-active shadow-sm'
                    : 'btn-chip',
                )}
              >
                {app.university.name}
              </button>
            ))}
          </div>
        ) : null}

        {headerNote ? (
          <div className="ivy-card !p-0">
            <EmptyState
              icon={GraduationCap}
              title="No applications yet"
              description={`${headerNote} Check back once a university journey is seeded for this student.`}
            />
          </div>
        ) : null}

        {detailQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading steps…</p>
        ) : detailQuery.isError ? (
          <p className="text-sm text-destructive">
            Could not load application steps. Try refreshing.
          </p>
        ) : detailQuery.data ? (
          <JourneyTimeline
            application={detailQuery.data}
            canEditNotes={canEditNotes}
            onOpenDetail={() =>
              navigate(
                studentId
                  ? `/app/students/${studentId}/applications/${detailQuery.data!.id}`
                  : `/app/applications/${detailQuery.data!.id}`,
              )
            }
          />
        ) : null}
      </div>
    </PageMotion>
  );
}
