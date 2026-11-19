import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import {
  AdmissionTimeline,
  type AdmissionTimelineStep,
} from '../components/AdmissionTimeline';
import { BackLink } from '../components/ivy/BackLink';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { fireScholaraConfetti } from '../lib/confetti';
import { formatDisplayDate, toTimelineStatus } from '../lib/statusMaps';
import {
  fetchApplication,
  updateApplicationStep,
} from '../services/scholaraApi';

function DetailStepNotes({
  applicationId,
  stepNumber,
  notes,
}: {
  applicationId: string;
  stepNumber: number;
  notes: string | null;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(notes ?? '');

  useEffect(() => {
    setDraft(notes ?? '');
  }, [notes, stepNumber]);

  const mutation = useMutation({
    mutationFn: (value: string) =>
      updateApplicationStep(applicationId, stepNumber, { notes: value }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['application', applicationId], updated);
      void queryClient.invalidateQueries({
        queryKey: ['applications'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['dashboard'],
      });
      toast.success('Notes saved');
    },
    onError: () => toast.error('Could not save notes'),
  });

  const dirty = draft !== (notes ?? '');

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Add notes for this step…"
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none ring-gold/40 placeholder:font-medium placeholder:text-muted-foreground focus:ring-2"
      />
      <TapButton
        disabled={!dirty || mutation.isPending}
        onClick={() => mutation.mutate(draft.trim())}
        className="flex w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
      >
        {mutation.isPending ? 'Saving…' : 'Save notes'}
      </TapButton>
    </div>
  );
}

export function ApplicationDetailPage() {
  const { id = '', studentId } = useParams();
  const { user } = useAuth();
  const canEditNotes = user?.role === 'CONSULTANT';
  const celebratedRef = useRef(false);
  const [showFullTimeline, setShowFullTimeline] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['application', id],
    queryFn: () => fetchApplication(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (data?.status === 'ACCEPTED' && !celebratedRef.current) {
      celebratedRef.current = true;
      fireScholaraConfetti();
    }
  }, [data?.status]);

  const consultantName =
    data?.student?.consultant?.user?.fullName ?? 'Assigned consultant';
  const timelineSteps = useMemo(
    () =>
      (data?.steps ?? []).map((step) => ({
        stepNumber: step.stepNumber,
        name: step.label,
        status: toTimelineStatus(step.status),
        date: step.completedAt ? formatDisplayDate(step.completedAt) : null,
        approvedBy:
          step.status === 'COMPLETED' || step.status === 'IN_PROGRESS'
            ? consultantName
            : null,
        note: canEditNotes ? null : step.notes,
      })),
    [canEditNotes, consultantName, data?.steps],
  );

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading application">
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="ivy-card text-sm text-destructive">
        Could not load application. Try going back and opening it again.
      </div>
    );
  }

  const backTo = studentId
    ? `/app/students/${studentId}/applications`
    : '/app/applications';
  const emailsTo = studentId
    ? `/app/students/${studentId}/emails`
    : '/app/emails';
  const notesByStep = new Map(
    (data.steps ?? []).map((s) => [s.stepNumber, s.notes] as const),
  );
  const emailPreview = (data.emails ?? []).slice(0, 2);
  const currentTimelineStep = timelineSteps.find((s) => s.status === 'Current');
  const compactSteps = currentTimelineStep
    ? timelineSteps.filter(
        (s) =>
          s.status === 'Current' ||
          s.stepNumber === currentTimelineStep.stepNumber,
      )
    : timelineSteps.slice(0, 3);

  return (
    <PageMotion>
      <div className="mb-4 flex items-start gap-2">
        <BackLink
          to={backTo}
          label="Back to applications"
          className="mb-0"
        />
        <ScreenTitle eyebrow={data.program.name} title={data.university.name} />
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {data.decisionNotes ??
          'Track application progress and related university updates.'}
      </p>

      {currentTimelineStep ? (
        <div className="mb-5 rounded-[1.125rem] border border-gold/35 bg-gold-soft/40 p-4">
          <p className="label-caps">Current stage</p>
          <p className="mt-1 font-sans text-lg font-semibold text-foreground">
            {currentTimelineStep.name}
          </p>
          {currentTimelineStep.note ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {currentTimelineStep.note}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              This is the active step in the admission process.
            </p>
          )}
        </div>
      ) : null}

      <details className="mb-5 rounded-[1.125rem] border border-border bg-card open:pb-1">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground">
          Scores, fees & merit details
        </summary>
        <div className="grid gap-2 border-t border-border px-4 py-3">
          {data.entryScore ? (
            <div className="rounded-xl bg-secondary/60 px-4 py-3">
              <p className="label-meta">Entry score</p>
              <p className="editorial-title text-xl">{data.entryScore}/100</p>
            </div>
          ) : null}
          {data.meritListDate ? (
            <div className="rounded-xl bg-secondary/60 px-4 py-3">
              <p className="label-meta">Merit list</p>
              <p className="editorial-title text-xl">{data.meritListDate}</p>
            </div>
          ) : null}
          {data.feeDueDate ? (
            <div className="rounded-xl bg-secondary/60 px-4 py-3">
              <p className="label-meta">Fee due</p>
              <p className="editorial-title text-xl">
                {data.feeCurrency} {data.feeAmount}
              </p>
              <p className="text-xs text-muted-foreground">by {data.feeDueDate}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No score or fee details recorded for this application yet.
            </p>
          )}
        </div>
      </details>

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Application progress</h2>
        <button
          type="button"
          className="text-xs font-semibold text-gold-ink"
          onClick={() => setShowFullTimeline((v) => !v)}
        >
          {showFullTimeline ? 'Show current only' : 'Show full timeline'}
        </button>
      </div>
      <AdmissionTimeline
        steps={showFullTimeline ? timelineSteps : compactSteps}
        renderStepAction={
          canEditNotes
            ? (step: AdmissionTimelineStep) =>
                step.status === 'Upcoming' || step.status === 'Skipped' ? null : (
                  <DetailStepNotes
                    applicationId={id}
                    stepNumber={step.stepNumber}
                    notes={notesByStep.get(step.stepNumber) ?? null}
                  />
                )
            : undefined
        }
      />

      <div className="mt-8 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gold-ink" />
          <h2 className="text-lg font-semibold">Consultant emails</h2>
        </div>
        {emailPreview.map((email) => (
          <article
            key={email.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <p className="editorial-title text-base">{email.subject}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              From consultant · {email.sender} ·{' '}
              {formatDisplayDate(email.sentAt)}
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {email.body}
            </p>
          </article>
        ))}
        {emailPreview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No consultant emails for this application yet.
          </p>
        ) : (
          <Link
            to={emailsTo}
            className="inline-flex min-h-12 items-center text-sm font-semibold text-gold-ink underline-offset-2 hover:underline"
          >
            View consultant emails
          </Link>
        )}
      </div>
    </PageMotion>
  );
}
