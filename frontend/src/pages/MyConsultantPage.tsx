import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Mic,
  Phone,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { formatDisplayDate } from '../lib/statusMaps';
import {
  fetchCalls,
  fetchDashboard,
  startCall,
} from '../services/scholaraApi';
import type { CallSessionItem } from '../types/domain';

function CallCard({ call }: { call: CallSessionItem }) {
  const [open, setOpen] = useState(false);
  const consultantName = call.consultant?.user.fullName ?? 'Consultant';
  const ended = Boolean(call.endedAt);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-gold-ink">
          <Phone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-caps">{ended ? 'Completed call' : 'Open call'}</p>
          <p className="font-serif text-lg font-semibold text-foreground">
            with {consultantName}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDisplayDate(call.startedAt)}
            {call.endedAt ? ` → ${formatDisplayDate(call.endedAt)}` : ''}
          </p>
          {call.note?.summary ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {call.note.summary}
            </p>
          ) : null}
        </div>
        {open ? (
          <ChevronUp className="mt-1 h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <p className="label-caps mb-1">Transcript</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {call.transcript?.trim() || 'No transcript saved yet.'}
            </p>
          </div>
          {call.note ? (
            <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
              <p className="label-caps">Call note</p>
              <p className="text-sm">
                <span className="font-semibold">Summary: </span>
                {call.note.summary}
              </p>
              <p className="text-sm whitespace-pre-wrap">
                <span className="font-semibold">Actions: </span>
                {call.note.actionItems}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Universities: </span>
                {call.note.universitiesDiscussed}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Follow-ups: </span>
                {call.note.followUps}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No structured note yet.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function ConsultantCallTools({ studentId }: { studentId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: calls } = useQuery({
    queryKey: ['calls', studentId],
    queryFn: () => fetchCalls(studentId),
    refetchInterval: 4000,
  });

  const openCall = useMemo(
    () => calls?.find((c) => !c.endedAt) ?? null,
    [calls],
  );

  const startMutation = useMutation({
    mutationFn: () => startCall(studentId),
    onSuccess: (call) => {
      toast.success('Live call started — allow microphone access');
      void queryClient.invalidateQueries({ queryKey: ['calls', studentId] });
      navigate(`/app/live-call/${call.id}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not start call';
      toast.error(message);
    },
  });

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="label-caps mb-2">Live transcribed call</p>
      <p className="mb-3 text-sm text-muted-foreground">
        Start a call, open the same room on the student device, and speak.
        Speech is transcribed and saved for handover.
      </p>
      {openCall ? (
        <TapButton
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          onClick={() => navigate(`/app/live-call/${openCall.id}`)}
        >
          <Mic className="h-4 w-4" />
          Rejoin live call
        </TapButton>
      ) : (
        <TapButton
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          <Phone className="h-4 w-4" />
          {startMutation.isPending ? 'Starting…' : 'Start live call'}
        </TapButton>
      )}
    </div>
  );
}

export function MyConsultantPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ studentId?: string }>();
  const resolvedStudentId = studentId ?? params.studentId;
  const isConsultant = user?.role === 'CONSULTANT';

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', resolvedStudentId ?? 'self'],
    queryFn: () => fetchDashboard(resolvedStudentId),
    enabled: Boolean(user) && (isConsultant ? Boolean(resolvedStudentId) : true),
  });

  const callsQuery = useQuery({
    queryKey: ['calls', resolvedStudentId ?? 'self'],
    queryFn: () => fetchCalls(resolvedStudentId),
    enabled: Boolean(user) && (isConsultant ? Boolean(resolvedStudentId) : true),
    refetchInterval: 4000,
  });

  if (isConsultant && !resolvedStudentId) {
    return (
      <PageMotion>
        <ScreenTitle eyebrow="Calls" title="Pick a student" />
        <p className="text-sm text-muted-foreground">
          Open a student dossier, then use Calls — or go back to your assigned
          list.
        </p>
        <TapButton
          className="mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          onClick={() => navigate('/app')}
        >
          Back to students
        </TapButton>
      </PageMotion>
    );
  }

  if (dashboardQuery.isLoading || callsQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading consultant & calls…</p>
    );
  }

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <p className="text-sm text-destructive">Could not load consultant details.</p>
    );
  }

  const consultant = dashboardQuery.data.student.consultant;
  const calls = callsQuery.data ?? [];
  const openCall = calls.find((c) => !c.endedAt) ?? null;

  return (
    <PageMotion>
      <div className="mb-3 flex items-center gap-2">
        <TapButton
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          onClick={() =>
            navigate(
              isConsultant && resolvedStudentId
                ? `/app/students/${resolvedStudentId}`
                : '/app/profile',
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </TapButton>
        <ScreenTitle
          eyebrow={isConsultant ? 'Student calls' : 'Support'}
          title={isConsultant ? 'Call history' : 'My Consultant'}
        />
      </div>

      {consultant ? (
        <div className="ivy-card mb-5 flex items-center gap-3 p-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold bg-[#0B1528] font-serif text-xl text-primary-foreground">
            {consultant.fullName[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-semibold">{consultant.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {consultant.title ?? 'Admissions Consultant'}
            </p>
            {!isConsultant ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Live calls are transcribed so a new consultant can pick up your
                applications later.
              </p>
            ) : null}
          </div>
          <UserRound className="h-5 w-5 text-gold-ink" />
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">No consultant assigned.</p>
        </div>
      )}

      {!isConsultant && openCall ? (
        <div className="mb-5 rounded-2xl border border-success/30 bg-success/10 p-4">
          <p className="font-semibold text-foreground">Live call in progress</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your consultant started a call. Join to speak — your words are
            transcribed automatically.
          </p>
          <TapButton
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            onClick={() => navigate(`/app/live-call/${openCall.id}`)}
          >
            <Mic className="h-4 w-4" /> Join live call
          </TapButton>
        </div>
      ) : null}

      {isConsultant && resolvedStudentId ? (
        <ConsultantCallTools studentId={resolvedStudentId} />
      ) : null}

      <h2 className="mb-3 font-serif text-xl font-semibold">Saved calls</h2>
      {callsQuery.error ? (
        <p className="text-sm text-destructive">Could not load call history.</p>
      ) : calls.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">
            No call sessions yet.
            {isConsultant
              ? ' Start a live call above to capture a transcript.'
              : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <CallCard key={call.id} call={call} />
          ))}
        </div>
      )}

      {!isConsultant ? (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Need something else?{' '}
          <Link to="/app/profile" className="underline">
            Back to profile
          </Link>
        </p>
      ) : null}
    </PageMotion>
  );
}
