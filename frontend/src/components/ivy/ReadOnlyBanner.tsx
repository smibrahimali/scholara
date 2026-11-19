import { Eye } from 'lucide-react';

/** Explicit read-only context for guardians (and similar viewers). */
export function ReadOnlyBanner({
  studentFirstName,
}: {
  studentFirstName: string;
}) {
  return (
    <div className="alert-info mb-5 flex items-start gap-3 rounded-[1rem] px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-info shadow-elev1">
        <Eye className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          Viewing {studentFirstName}&apos;s admission progress
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Only the student can upload documents or request appointments. You can
          follow applications, deadlines, and messages here.
        </p>
      </div>
    </div>
  );
}
