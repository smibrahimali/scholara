import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import {
  fetchCallRequests,
  fetchConsultantPeers,
  fetchConsultantStudents,
  handoverStudent,
} from '../services/scholaraApi';
import { fetchChatRequests } from '../services/messagingApi';

export function ConsultantHomePage() {
  const queryClient = useQueryClient();
  const [handoverFor, setHandoverFor] = useState<string | null>(null);
  const [peerId, setPeerId] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['consultant-students'],
    queryFn: fetchConsultantStudents,
  });

  const peersQuery = useQuery({
    queryKey: ['consultant-peers'],
    queryFn: fetchConsultantPeers,
  });

  const pendingCallsQuery = useQuery({
    queryKey: ['call-requests', 'PENDING'],
    queryFn: () => fetchCallRequests({ status: 'PENDING' }),
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : 8000,
  });

  const pendingChatsQuery = useQuery({
    queryKey: ['chat-requests', 'PENDING'],
    queryFn: () => fetchChatRequests({ status: 'PENDING' }),
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : 8000,
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
      void queryClient.invalidateQueries({ queryKey: ['chat-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['calls'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-session-open'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Handover failed';
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <div className="ivy-card flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-gold-ink">
          <Users className="h-5 w-5 animate-pulse" />
        </span>
        <p className="font-serif text-lg font-semibold text-foreground">
          Loading roster
        </p>
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
        <p className="font-serif text-lg font-semibold text-foreground">
          Could not load students
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Check that the API is running, then refresh. After reseeding, sign in
          again so your session matches the new demo data.
        </p>
      </div>
    );
  }

  const pendingCalls = pendingCallsQuery.data ?? [];
  const pendingChats = pendingChatsQuery.data ?? [];

  return (
    <PageMotion>
      <div className="space-y-6">
        <ScreenTitle eyebrow="Consultant desk" title="Assigned students" />

        {!pendingCallsQuery.isLoading &&
        !pendingChatsQuery.isLoading &&
        pendingCalls.length === 0 &&
        pendingChats.length === 0 ? (
          <div className="ivy-card border border-border/70 bg-secondary/40 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">
              0 pending call & chat requests
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your session queue is clear — new student requests will appear
              here.
            </p>
          </div>
        ) : null}

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

        {pendingChats.length > 0 ? (
          <div className="ivy-card border border-gold/35 bg-gold-soft/40 p-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-gold-ink" />
              <p className="label-caps">Pending chat requests</p>
            </div>
            <ul className="space-y-2.5">
              {pendingChats.map((req) => (
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
                        · chat ·{' '}
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
            <p className="font-serif text-lg font-semibold text-foreground">
              No students assigned
            </p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Sign in as consultant1 to see Ali Raza, or accept a handover from
              another consultant.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {data.map((student) => (
              <article key={student.id} className="ivy-card p-5">
                <div className="flex items-start gap-3">
                  <span className="ivy-medallion flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <Users className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="label-caps">
                      {student.targetProgram ?? 'Student'}
                    </p>
                    <h2 className="mt-0.5 truncate font-serif text-xl font-semibold text-foreground">
                      {student.fullName}
                    </h2>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {student.email}
                    </p>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      {student.applications} applications ·{' '}
                      {student.pendingReviews} pending ·{' '}
                      {student.rejectedDocuments} rejected
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2.5">
                  <Link
                    to={`/app/students/${student.id}`}
                    className="btn-primary flex min-h-12 items-center justify-center gap-1 rounded-xl text-sm font-semibold no-underline"
                  >
                    Open dossier <ChevronRight className="h-4 w-4" />
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/app/students/${student.id}/messages`}
                      className="btn-outline flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold no-underline"
                    >
                      <MessageCircle className="h-4 w-4 text-gold-ink" /> Chat
                    </Link>
                    <Link
                      to={`/app/students/${student.id}/calls`}
                      className="btn-outline flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold no-underline"
                    >
                      <Phone className="h-4 w-4 text-gold-ink" /> Calls
                    </Link>
                  </div>
                  <Link
                    to={`/app/students/${student.id}/documents`}
                    className="btn-outline flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold no-underline"
                  >
                    Documents
                  </Link>
                  <Link
                    to={`/app/students/${student.id}/emails`}
                    className="btn-outline flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold no-underline"
                  >
                    <Mail className="h-4 w-4" /> Applied emails
                  </Link>
                  <TapButton
                    className="btn-outline flex min-h-11 items-center justify-center rounded-xl border-dashed text-sm font-semibold"
                    onClick={() => {
                      setHandoverFor(student.id);
                      setPeerId('');
                    }}
                  >
                    Hand over to another consultant
                  </TapButton>

                  {handoverFor === student.id ? (
                    <div className="rounded-xl border border-border bg-secondary/50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Receiving consultant
                      </p>
                      <select
                        className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                        value={peerId}
                        onChange={(e) => setPeerId(e.target.value)}
                      >
                        <option value="">Select…</option>
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
                          Confirm handover
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
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </PageMotion>
  );
}
