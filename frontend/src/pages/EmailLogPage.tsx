import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { BackLink } from '../components/ivy/BackLink';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { formatDisplayDate, toDecisionStatus } from '../lib/statusMaps';
import {
  fetchEmailLog,
  replyToConsultantEmail,
} from '../services/scholaraApi';
import type { EmailLogItem } from '../types/domain';

function EmailCard({
  email,
  detailPath,
  canReply,
  onReply,
  replyPending,
}: {
  email: EmailLogItem;
  detailPath: string;
  canReply: boolean;
  onReply: (emailId: string, body: string) => Promise<void>;
  replyPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const fromName = email.consultantName ?? 'Your consultant';
  const needsReply = canReply && !email.studentReply;

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || replyPending) return;
    await onReply(email.id, body);
    setDraft('');
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ivy-medallion flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Mail className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-caps">From {fromName}</p>
          <p className="editorial-title text-lg leading-snug text-foreground">
            {email.subject}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {email.sender} · {formatDisplayDate(email.sentAt)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Re: {email.universityName} · {email.programName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="inline-flex rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info">
              Consultant update
            </p>
            <p className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {toDecisionStatus(email.applicationStatus)}
            </p>
            <p
              className={
                email.studentReply
                  ? 'inline-flex rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success'
                  : 'inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning'
              }
            >
              {email.studentReply
                ? canReply
                  ? 'You replied'
                  : 'Student replied'
                : canReply
                  ? 'Reply needed'
                  : 'Awaiting reply'}
            </p>
          </div>
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
            <p className="label-caps">Message from your consultant</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {email.body}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="label-caps">Your reply</p>
            {email.studentReply ? (
              <>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {email.studentReply}
                </p>
                {email.repliedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sent {formatDisplayDate(email.repliedAt)}
                  </p>
                ) : null}
              </>
            ) : needsReply ? (
              <form className="mt-2 space-y-2" onSubmit={submitReply}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={`Reply to ${fromName}…`}
                  className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                  disabled={replyPending}
                />
                <TapButton
                  type="submit"
                  disabled={!draft.trim() || replyPending}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {replyPending ? 'Sending…' : 'Send reply'}
                </TapButton>
              </form>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                No student reply yet.
              </p>
            )}
          </div>
          <Link
            to={detailPath}
            className="inline-flex text-sm font-semibold text-gold-ink underline-offset-2 hover:underline"
          >
            Open related application
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function EmailLogPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ studentId?: string }>();
  const resolvedStudentId = studentId ?? params.studentId;
  const isConsultant = user?.role === 'CONSULTANT';
  const canReply = user?.role === 'STUDENT';
  const queryClient = useQueryClient();
  const queryKey = ['emails', resolvedStudentId ?? 'self'] as const;

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchEmailLog(resolvedStudentId),
    enabled:
      Boolean(user) && (isConsultant ? Boolean(resolvedStudentId) : true),
  });

  const replyMutation = useMutation({
    mutationFn: ({ emailId, body }: { emailId: string; body: string }) =>
      replyToConsultantEmail(emailId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData<EmailLogItem[]>(queryKey, (prev) =>
        (prev ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success('Reply sent to your consultant');
    },
    onError: () => toast.error('Could not send reply'),
  });

  if (isConsultant && !resolvedStudentId) {
    return (
      <PageMotion>
        <ScreenTitle eyebrow="Consultant emails" title="Pick a student" />
        <p className="text-sm text-muted-foreground">
          Open a student dossier first, then view emails you sent them.
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

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading consultant emails…</p>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        Could not load consultant emails.
      </p>
    );
  }

  return (
    <PageMotion>
      <div className="mb-3 flex items-start gap-2">
        <BackLink
          to={
            isConsultant && resolvedStudentId
              ? `/app/students/${resolvedStudentId}`
              : '/app/profile'
          }
          label={
            isConsultant && resolvedStudentId
              ? 'Back to student'
              : 'Back to Profile'
          }
          className="mb-0"
        />
        <ScreenTitle
          eyebrow="Inbox"
          title="Consultant emails"
        />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {isConsultant
          ? 'Emails you sent this student about university progress. They reply to you here — you handle the universities.'
          : 'Emails from your consultant only. They handle universities and pass along what you need to know. Reply when action is needed.'}
      </p>

      {data.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">
            No consultant emails yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              canReply={canReply}
              replyPending={replyMutation.isPending}
              onReply={async (emailId, body) => {
                await replyMutation.mutateAsync({ emailId, body });
              }}
              detailPath={
                isConsultant && resolvedStudentId
                  ? `/app/students/${resolvedStudentId}/applications/${email.applicationId}`
                  : `/app/applications/${email.applicationId}`
              }
            />
          ))}
        </div>
      )}
    </PageMotion>
  );
}
