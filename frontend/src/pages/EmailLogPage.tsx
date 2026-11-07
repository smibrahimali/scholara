import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { formatDisplayDate, toDecisionStatus } from '../lib/statusMaps';
import { fetchEmailLog } from '../services/scholaraApi';
import type { EmailLogItem } from '../types/domain';

function EmailCard({
  email,
  detailPath,
}: {
  email: EmailLogItem;
  detailPath: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-gold-ink">
          <Mail className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-caps">{email.universityName}</p>
          <p className="font-serif text-lg font-semibold leading-snug text-foreground">
            {email.subject}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {email.sender} · {formatDisplayDate(email.sentAt)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {email.programName}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {toDecisionStatus(email.applicationStatus)}
          </p>
        </div>
        {open ? (
          <ChevronUp className="mt-1 h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {email.body}
          </p>
          <Link
            to={detailPath}
            className="inline-flex text-sm font-semibold text-gold-ink underline-offset-2 hover:underline"
          >
            Open application
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['emails', resolvedStudentId ?? 'self'],
    queryFn: () => fetchEmailLog(resolvedStudentId),
    enabled:
      Boolean(user) && (isConsultant ? Boolean(resolvedStudentId) : true),
  });

  if (isConsultant && !resolvedStudentId) {
    return (
      <PageMotion>
        <ScreenTitle eyebrow="Emails" title="Pick a student" />
        <p className="text-sm text-muted-foreground">
          Open a student dossier first, then view their applied email log.
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
      <p className="text-sm text-muted-foreground">Loading email log…</p>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">Could not load applied emails.</p>
    );
  }

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
          eyebrow="Admissions inbox"
          title="Applied Email Log"
        />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Seeded university messages across all applications, newest first.
      </p>

      {data.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">
            No university emails yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
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
