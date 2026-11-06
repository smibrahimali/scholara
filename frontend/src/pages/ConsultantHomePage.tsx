import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { fetchConsultantStudents } from '../services/scholaraApi';

export function ConsultantHomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['consultant-students'],
    queryFn: fetchConsultantStudents,
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
            No students assigned. Sign in as consultant1 to see Ali Raza.
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
                  to={`/app/students/${student.id}/documents`}
                  className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold"
                >
                  Documents
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageMotion>
  );
}
