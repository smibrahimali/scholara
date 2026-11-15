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
    refetchInterval: 8000,
  });

  const pendingChatsQuery = useQuery({
    queryKey: ['chat-requests', 'PENDING'],
    queryFn: () => fetchChatRequests({ status: 'PENDING' }),
    refetchInterval: 8000,
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
      <p className="text-sm text-muted-foreground">Loading assigned students…</p>
    );
  }
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">Could not load students.</p>
    );
  }

  const pendingCalls = pendingCallsQuery.data ?? [];
  const pendingChats = pendingChatsQuery.data ?? [];

  return (
    <PageMotion>
      <div className="space-y-6">
        <ScreenTitle eyebrow="Consultant desk" title="Assigned students" />

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
                    className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold no-underline transition-colors hover:bg-secondary/70"
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
                    className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold no-underline transition-colors hover:bg-secondary/70"
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
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-gold-ink">
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
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-gold-ink">
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
                    className="btn-metallic flex min-h-12 items-center justify-center gap-1 rounded-xl text-sm font-semibold no-underline"
                  >
                    Open dossier <ChevronRight className="h-4 w-4" />
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/app/students/${student.id}/messages`}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground no-underline"
                    >
                      <MessageCircle className="h-4 w-4 text-gold-ink" /> Chat
                    </Link>
                    <Link
                      to={`/app/students/${student.id}/calls`}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground no-underline"
                    >
                      <Phone className="h-4 w-4 text-gold-ink" /> Calls
                    </Link>
                  </div>
                  <Link
                    to={`/app/students/${student.id}/documents`}
                    className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground no-underline"
                  >
                    Documents
                  </Link>
                  <Link
                    to={`/app/students/${student.id}/emails`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground no-underline"
                  >
                    <Mail className="h-4 w-4" /> Applied emails
                  </Link>
                  <TapButton
                    className="flex min-h-11 items-center justify-center rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground"
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
                          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                          disabled={!peerId || handoverMutation.isPending}
                          onClick={() => handoverMutation.mutate()}
                        >
                          Confirm handover
                        </TapButton>
                        <TapButton
                          className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground"
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
