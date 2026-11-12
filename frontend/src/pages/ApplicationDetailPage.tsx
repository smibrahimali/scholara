import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';
import {
  AdmissionTimeline,
  type AdmissionTimelineStep,
} from '../components/AdmissionTimeline';
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
        refetchType: 'none',
      });
      void queryClient.invalidateQueries({
        queryKey: ['dashboard'],
        refetchType: 'none',
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
        className="flex w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving…' : 'Save notes'}
      </TapButton>
    </div>
  );
}

export function ApplicationDetailPage() {
  const { id = '', studentId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canMarkComplete = user?.role === 'CONSULTANT';
  const canEditNotes = user?.role === 'CONSULTANT';
  const celebratedRef = useRef(false);

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

  const stepMutation = useMutation({
    mutationFn: ({
      stepNumber,
      status,
    }: {
      stepNumber: number;
      status: string;
    }) => updateApplicationStep(id, stepNumber, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['application', id], updated);
      void queryClient.invalidateQueries({
        queryKey: ['applications'],
        refetchType: 'none',
      });
      void queryClient.invalidateQueries({
        queryKey: ['dashboard'],
        refetchType: 'none',
      });
      toast.success('Step updated');
    },
    onError: () => toast.error('Could not update step'),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading application…</p>
    );
  }
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">Could not load application.</p>
    );
  }

  const backTo = studentId
    ? `/app/students/${studentId}/applications`
    : '/app/applications';
  const consultantName =
    data.student?.consultant?.user.fullName ?? 'Assigned consultant';
  const notesByStep = new Map(
    (data.steps ?? []).map((s) => [s.stepNumber, s.notes] as const),
  );

  return (
    <PageMotion>
      <Link
        to={backTo}
        className="mb-4 inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to journey
      </Link>

      <ScreenTitle eyebrow={data.program.name} title={data.university.name} />
      <p className="mb-5 text-sm text-muted-foreground">
        {data.decisionNotes ?? 'Track the 12-step admission lifecycle.'}
      </p>

      <div className="mb-5 grid gap-2">
        {data.entryScore ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Entry score
            </p>
            <p className="font-serif text-xl font-semibold">
              {data.entryScore}/100
            </p>
          </div>
        ) : null}
        {data.meritListDate ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Merit list
            </p>
            <p className="font-serif text-xl font-semibold">
              {data.meritListDate}
            </p>
          </div>
        ) : null}
        {data.feeDueDate ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Fee due
            </p>
            <p className="font-serif text-xl font-semibold">
              {data.feeCurrency} {data.feeAmount}
            </p>
            <p className="text-xs text-muted-foreground">by {data.feeDueDate}</p>
          </div>
        ) : null}
      </div>

      <h2 className="mb-3 text-xl font-semibold">12-step lifecycle</h2>
      <AdmissionTimeline
        steps={(data.steps ?? []).map((step) => ({
          stepNumber: step.stepNumber,
          name: step.label,
          status: toTimelineStatus(step.status),
          date: step.completedAt ? formatDisplayDate(step.completedAt) : null,
          approvedBy:
            step.status === 'COMPLETED' || step.status === 'IN_PROGRESS'
              ? consultantName
              : null,
          note: canEditNotes ? null : step.notes,
        }))}
        renderStepAction={(step: AdmissionTimelineStep) => (
          <div className="space-y-2">
            {canEditNotes ? (
              <DetailStepNotes
                applicationId={id}
                stepNumber={step.stepNumber}
                notes={notesByStep.get(step.stepNumber) ?? null}
              />
            ) : null}
            {canMarkComplete && step.status === 'Current' ? (
              <TapButton
                className="flex w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                disabled={stepMutation.isPending}
                onClick={() =>
                  stepMutation.mutate({
                    stepNumber: step.stepNumber,
                    status: 'COMPLETED',
                  })
                }
              >
                {stepMutation.isPending ? 'Updating…' : 'Mark complete'}
              </TapButton>
            ) : null}
          </div>
        )}
      />

      <div className="mt-8 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gold-ink" />
          <h2 className="text-xl font-semibold">University emails</h2>
        </div>
        {(data.emails ?? []).map((email) => (
          <article
            key={email.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <p className="font-serif text-base font-semibold">{email.subject}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {email.sender} · {formatDisplayDate(email.sentAt)}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{email.body}</p>
          </article>
        ))}
        {(data.emails ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No emails seeded for this application.
          </p>
        ) : null}
      </div>
    </PageMotion>
  );
}
