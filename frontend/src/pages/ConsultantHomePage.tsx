import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, Mail, Phone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import {
  fetchConsultantPeers,
  fetchConsultantStudents,
  handoverStudent,
} from '../services/scholaraApi';

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

  return (
    <PageMotion>
      <ScreenTitle eyebrow="Consultant desk" title="Assigned students" />
      {data.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">
            No students assigned. Sign in as consultant1 to see Ali Raza, or
            accept a handover from another consultant.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((student) => (
            <article
              key={student.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-gold-ink">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="label-caps">
                    {student.targetProgram ?? 'Student'}
                  </p>
                  <h2 className="font-serif text-xl font-semibold">
                    {student.fullName}
                  </h2>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {student.applications} applications · {student.pendingReviews}{' '}
                    pending · {student.rejectedDocuments} rejected
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  to={`/app/students/${student.id}`}
                  className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Open dossier <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  to={`/app/students/${student.id}/calls`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold"
                >
                  <Phone className="h-4 w-4" /> Live call & transcripts
                </Link>
                <Link
                  to={`/app/students/${student.id}/documents`}
                  className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold"
                >
                  Documents
                </Link>
                <Link
                  to={`/app/students/${student.id}/emails`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold"
                >
                  <Mail className="h-4 w-4" /> Applied emails
                </Link>
                <TapButton
                  className="flex min-h-12 items-center justify-center rounded-xl border border-border text-sm font-semibold"
                  onClick={() => {
                    setHandoverFor(student.id);
                    setPeerId('');
                  }}
                >
                  Hand over to another consultant
                </TapButton>

                {handoverFor === student.id ? (
                  <div className="rounded-xl border border-border bg-secondary/50 p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      Receiving consultant
                    </p>
                    <select
                      className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
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
                        className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
                        disabled={!peerId || handoverMutation.isPending}
                        onClick={() => handoverMutation.mutate()}
                      >
                        Confirm handover
                      </TapButton>
                      <TapButton
                        className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
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
    </PageMotion>
  );
}
