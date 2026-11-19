import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { BackLink } from '../components/ivy/BackLink';
import { EmptyState } from '../components/ivy/EmptyState';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { getBackPath, hasNavFrom, withFrom } from '../lib/navigation';
import { formatDisplayDate } from '../lib/statusMaps';
import {
  fetchApplication,
  fetchApplications,
  updateApplicationStep,
} from '../services/scholaraApi';
import type { ApplicationItem, ApplicationStep } from '../types/domain';

function UniversityChipPicker({
  apps,
  selectedId,
  onSelect,
}: {
  apps: ApplicationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const updateHints = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    };

    updateHints();
    el.addEventListener('scroll', updateHints, { passive: true });
    const ro = new ResizeObserver(updateHints);
    ro.observe(el);
    window.addEventListener('resize', updateHints);

    return () => {
      el.removeEventListener('scroll', updateHints);
      ro.disconnect();
      window.removeEventListener('resize', updateHints);
    };
  }, [apps]);

  const scrollByChips = (direction: 1 | -1) => {
    scrollerRef.current?.scrollBy({
      left: direction * 180,
      behavior: 'smooth',
    });
  };

  const activeId = selectedId ?? apps[0]?.id;

  return (
    <div className="relative -mx-5">
      {canScrollLeft ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent"
          />
          <button
            type="button"
            aria-label="Show previous universities"
            onClick={() => scrollByChips(-1)}
            className="absolute left-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-transform active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      ) : null}

      {canScrollRight ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent"
          />
          <button
            type="button"
            aria-label="Show more universities"
            onClick={() => scrollByChips(1)}
            className="absolute right-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-transform active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      <div
        ref={scrollerRef}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar px-5 py-1"
      >
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => onSelect(app.id)}
            className={cn(
              'min-h-12 shrink-0 rounded-full px-4 text-xs font-medium uppercase tracking-[0.08em] transition-all duration-200 ease-out active:scale-[0.97]',
              activeId === app.id ? 'btn-chip-active shadow-sm' : 'btn-chip',
            )}
          >
            {app.university.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function stepState(status: string): 'done' | 'current' | 'future' {
  if (status === 'COMPLETED' || status === 'SKIPPED') return 'done';
  if (status === 'IN_PROGRESS') return 'current';
  return 'future';
}

function stepCaption(
  status: string,
  completedAt: string | null | undefined,
): string {
  if (status === 'IN_PROGRESS') return '🔄 In progress';
  if (status === 'SKIPPED') return '⏭️ Skipped';
  if (completedAt) return `✅ ${formatDisplayDate(completedAt)}`;
  if (status === 'COMPLETED') return '✅ Completed';
  return '⏳ Upcoming';
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
  const [showAllSteps, setShowAllSteps] = useState(false);
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;
  const visibleSteps = showAllSteps
    ? steps
    : steps.filter(
        (s, i) =>
          s.status === 'IN_PROGRESS' ||
          i === currentIndex ||
          (currentIndex < 0 && i === doneCount),
      );

  return (
    <div className="space-y-6">
      <div>
        <ScreenTitle
          eyebrow={application.program.name}
          title={application.university.name}
        />
        <p className="mb-3 text-sm text-muted-foreground">
          Status:{' '}
          <span className="font-semibold text-foreground">
            {application.status === 'IN_PROGRESS'
              ? 'In progress'
              : application.status === 'PENDING'
                ? 'Pending decision'
                : application.status === 'ACCEPTED'
                  ? 'Accepted'
                  : application.status === 'WAITLISTED'
                    ? 'Waitlisted'
                    : application.status === 'REJECTED'
                      ? 'Rejected'
                      : application.status}
          </span>
        </p>
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
        {currentStep ? (
          <div className="mt-4 rounded-[1rem] border border-gold/35 bg-gold-soft/50 p-4">
            <p className="label-caps">Current step</p>
            <p className="mt-1 font-sans text-base font-semibold text-foreground">
              {currentStep.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentStep.notes?.trim() ||
                (canEditNotes
                  ? 'Update notes or mark progress from the timeline below.'
                  : 'Your consultant is guiding this stage of the application.')}
            </p>
          </div>
        ) : null}
        {steps.length > 0 && doneCount === steps.length ? (
          <p className="status-success mt-3 rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold">
            Application progress complete — no outstanding steps
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[#DFD3BC] bg-[#FFFDF9] p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Application progress
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-gold-ink"
            onClick={() => setShowAllSteps((v) => !v)}
          >
            {showAllSteps ? 'Show current only' : 'Show all 12 steps'}
          </button>
        </div>
        <ol className="relative">
          {(showAllSteps ? steps : visibleSteps).map((s) => {
            const i = steps.findIndex((step) => step.id === s.id);
            const state = stepState(s.status);
            const isOpen = open === i;
            const isActiveCallout = state === 'current';
            return (
              <li key={s.id} className="relative pl-14">
                {showAllSteps && i < steps.length - 1 ? (
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
                  {state === 'future' ? (
                    <div className="flex min-h-14 w-full items-center py-2.5 text-left">
                      <span>
                        <span className="block font-semibold text-muted-foreground">
                          {s.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {stepCaption(s.status, s.completedAt)}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex min-h-14 w-full items-center justify-between py-2.5 text-left"
                    >
                    <span>
                      <span
                        className="block font-semibold"
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
                  )}
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
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canEditNotes = user?.role === 'CONSULTANT';
  const backFallback = studentId ? `/app/students/${studentId}` : '/app';
  const showBack = hasNavFrom(location);
  const backTo = getBackPath(location, backFallback);

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
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading applications">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-56 w-full" />
      </div>
    );
  }
  if (listQuery.error || !listQuery.data) {
    return (
      <div className="ivy-card text-sm text-destructive">
        Could not load applications. Check that the API is running, then refresh.
      </div>
    );
  }

  return (
    <PageMotion>
      <div className="space-y-8">
        {showBack ? (
          <BackLink to={backTo} className="-mb-4" />
        ) : null}
        {showPicker ? (
          <UniversityChipPicker
            apps={apps}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
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
                withFrom(location.pathname),
              )
            }
          />
        ) : null}
      </div>
    </PageMotion>
  );
}
