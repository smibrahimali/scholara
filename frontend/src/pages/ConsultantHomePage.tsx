import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { cn } from '../lib/cn';
import { consultantPendingCallRequestsKey } from '../lib/queryKeys';
import {
  fetchCallRequests,
  fetchConsultantPeers,
  fetchConsultantStudents,
  handoverStudent,
} from '../services/scholaraApi';
import type { ConsultantStudent } from '../types/domain';

function attentionLabel(student: ConsultantStudent): string | null {
  if (student.pendingReviews > 0) {
    return `${student.pendingReviews} document${student.pendingReviews === 1 ? '' : 's'} to review`;
  }
  if (student.rejectedDocuments > 0) {
    return `${student.rejectedDocuments} rejected — follow up with student`;
  }
  return null;
}

function StudentOverflow({
  student,
  open,
  onToggle,
  onHandover,
}: {
  student: ConsultantStudent;
  open: boolean;
  onToggle: () => void;
  onHandover: () => void;
}) {
  return (
    <div className="relative">
      <TapButton
        aria-label="More actions"
        aria-expanded={open}
        className="btn-outline flex h-11 w-11 items-center justify-center rounded-xl"
        onClick={onToggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </TapButton>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={onToggle}
          />
          <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-elev2">
            <Link
              to={`/app/students/${student.id}/documents`}
              className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-foreground no-underline hover:bg-secondary"
              onClick={onToggle}
            >
              <FileText className="h-4 w-4 text-gold-ink" /> Documents
            </Link>
            <Link
              to={`/app/students/${student.id}/messages`}
              className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-foreground no-underline hover:bg-secondary"
              onClick={onToggle}
            >
              <MessageCircle className="h-4 w-4 text-gold-ink" /> Messages
            </Link>
            <Link
              to={`/app/students/${student.id}/calls`}
              className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-foreground no-underline hover:bg-secondary"
              onClick={onToggle}
            >
              <Phone className="h-4 w-4 text-gold-ink" /> Consultation calls
            </Link>
            <Link
              to={`/app/students/${student.id}/emails`}
              className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-foreground no-underline hover:bg-secondary"
              onClick={onToggle}
            >
              <Mail className="h-4 w-4 text-gold-ink" /> Consultant emails
            </Link>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 border-t border-border px-3 text-left text-sm font-medium text-foreground hover:bg-secondary"
              onClick={() => {
                onToggle();
                onHandover();
              }}
            >
              Transfer student
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ConsultantHomePage() {
  const queryClient = useQueryClient();
  const [handoverFor, setHandoverFor] = useState<string | null>(null);
  const [peerId, setPeerId] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['consultant-students'],
    queryFn: fetchConsultantStudents,
  });

  const peersQuery = useQuery({
    queryKey: ['consultant-peers'],
    queryFn: fetchConsultantPeers,
  });

  const pendingCallsQuery = useQuery({
    queryKey: consultantPendingCallRequestsKey,
    queryFn: () => fetchCallRequests({ status: 'PENDING' }),
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      // Only poll while there are pending requests.
      return (query.state.data?.length ?? 0) > 0 ? 8_000 : false;
    },
  });

  const handoverMutation = useMutation({
    mutationFn: () => {
      if (!handoverFor || !peerId) {
        return Promise.reject(new Error('Pick a consultant'));
      }
      return handoverStudent(handoverFor, peerId);
    },
    onSuccess: (result) => {
      toast.success(result.message);
      setHandoverFor(null);
      setPeerId('');
      void queryClient.invalidateQueries({ queryKey: ['consultant-students'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Transfer failed';
      toast.error(message);
    },
  });

  const pendingCalls = pendingCallsQuery.data ?? [];

  const { needsAttention, rest } = useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => {
      const score = (s: ConsultantStudent) =>
        s.pendingReviews * 10 + s.rejectedDocuments * 5;
      return score(b) - score(a);
    });
    const attention = list.filter(
      (s) => s.pendingReviews > 0 || s.rejectedDocuments > 0,
    );
    const other = list.filter(
      (s) => s.pendingReviews === 0 && s.rejectedDocuments === 0,
    );
    return { needsAttention: attention, rest: other };
  }, [data]);

  const totalPendingReviews = (data ?? []).reduce(
    (sum, s) => sum + s.pendingReviews,
    0,
  );
  const totalRejected = (data ?? []).reduce(
    (sum, s) => sum + s.rejectedDocuments,
    0,
  );
  const queueCount = totalPendingReviews + pendingCalls.length;

  if (isLoading) {
    return (
      <div className="ivy-card flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-gold-ink">
          <Users className="h-5 w-5 animate-pulse" />
        </span>
        <p className="editorial-title text-lg text-foreground">Loading roster</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Fetching your assigned students…
        </p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="ivy-card flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <Users className="h-5 w-5" />
        </span>
        <p className="editorial-title text-lg text-foreground">
          Could not load students
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Check that the API is running, then refresh. After reseeding, sign in
          again so your session matches the new demo data.
        </p>
      </div>
    );
  }

  function renderStudentCard(student: ConsultantStudent) {
    const label = attentionLabel(student);
    return (
      <article key={student.id} className="ivy-card p-5">
        <div className="flex items-start gap-3">
          <span className="ivy-medallion flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="label-caps">{student.targetProgram ?? 'Student'}</p>
            <h2 className="editorial-title mt-0.5 truncate text-xl text-foreground">
              {student.fullName}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {student.email}
            </p>
            {label ? (
              <p className="mt-2 text-xs font-semibold text-gold-ink">{label}</p>
            ) : (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {student.applications} application
                {student.applications === 1 ? '' : 's'} · up to date
              </p>
            )}
          </div>
          <StudentOverflow
            student={student}
            open={menuFor === student.id}
            onToggle={() =>
              setMenuFor((id) => (id === student.id ? null : student.id))
            }
            onHandover={() => {
              setHandoverFor(student.id);
              setPeerId('');
            }}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            to={`/app/students/${student.id}`}
            className="btn-primary flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold no-underline"
          >
            Open student file <ChevronRight className="h-4 w-4" />
          </Link>
          {student.pendingReviews > 0 ? (
            <Link
              to={`/app/students/${student.id}/documents`}
              className="btn-outline flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold no-underline"
            >
              Review
            </Link>
          ) : null}
        </div>

        {handoverFor === student.id ? (
          <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-4">
            <p className="mb-1 text-sm font-semibold text-foreground">
              Transfer student
            </p>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              The new consultant inherits applications, documents, and call
              history. Open calls will be closed.
            </p>
            <select
              className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
            >
              <option value="">Select receiving consultant…</option>
              {(peersQuery.data ?? []).map((peer) => (
                <option key={peer.id} value={peer.id}>
                  {peer.fullName} ({peer.email})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <TapButton
                className="btn-primary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                disabled={!peerId || handoverMutation.isPending}
                onClick={() => handoverMutation.mutate()}
              >
                Confirm transfer
              </TapButton>
              <TapButton
                className="btn-outline rounded-xl px-3 py-2.5 text-sm font-semibold"
                onClick={() => setHandoverFor(null)}
              >
                Cancel
              </TapButton>
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <PageMotion>
      <div className="space-y-6">
        <ScreenTitle eyebrow="Consultant desk" title="Work queue" />

        <div className="ivy-card border border-border/70 bg-secondary/40 px-4 py-3.5">
          <p className="text-sm font-semibold text-foreground">
            {queueCount === 0
              ? 'No pending work'
              : `${queueCount} item${queueCount === 1 ? '' : 's'} need attention`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalPendingReviews} document review
            {totalPendingReviews === 1 ? '' : 's'} · {pendingCalls.length} call
            request{pendingCalls.length === 1 ? '' : 's'}
            {totalRejected > 0
              ? ` · ${totalRejected} rejected awaiting student`
              : ''}
          </p>
        </div>

        {pendingCalls.length > 0 ? (
          <div className="ivy-card border border-gold/35 bg-gold-soft/40 p-5">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gold-ink" />
              <p className="label-caps">Pending call requests</p>
            </div>
            <ul className="space-y-2.5">
              {pendingCalls.map((req) => (
                <li key={req.id}>
                  <Link
                    to={`/app/students/${req.studentId}/calls`}
                    className="btn-outline flex min-h-12 items-center justify-between gap-2 rounded-xl px-4 text-sm font-semibold no-underline"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-foreground">
                        {req.studentName ?? 'Student'}
                      </span>
                      <span className="font-medium text-muted-foreground">
                        {' '}
                        ·{' '}
                        {new Date(req.scheduledFor).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.length === 0 ? (
          <div className="ivy-card flex flex-col items-center px-6 py-12 text-center">
            <span className="ivy-medallion mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <Users className="h-5 w-5" />
            </span>
            <p className="editorial-title text-lg text-foreground">
              No students assigned
            </p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Sign in as consultant1 to see Ali Raza, or accept a transfer from
              another consultant.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {needsAttention.length > 0 ? (
              <section className="space-y-3">
                <h2 className="font-sans text-base font-semibold text-foreground">
                  Students needing attention
                </h2>
                {needsAttention.map(renderStudentCard)}
              </section>
            ) : null}

            <section className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowAll((v) => !v)}
              >
                <h2 className="font-sans text-base font-semibold text-foreground">
                  All assigned students
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {showAll || needsAttention.length === 0 ? 'Hide' : 'Show'}{' '}
                  {rest.length || data.length}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      showAll || needsAttention.length === 0
                        ? 'rotate-180'
                        : '',
                    )}
                  />
                </span>
              </button>
              {(showAll || needsAttention.length === 0
                ? needsAttention.length === 0
                  ? data
                  : rest
                : []
              ).map(renderStudentCard)}
            </section>
          </div>
        )}
      </div>
    </PageMotion>
  );
}
