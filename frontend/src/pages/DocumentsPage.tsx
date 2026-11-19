import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { BackLink } from '../components/ivy/BackLink';
import { EmptyState } from '../components/ivy/EmptyState';
import { PageMotion } from '../components/ivy/PageMotion';
import { ReadOnlyBanner } from '../components/ivy/ReadOnlyBanner';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { StatusBadge, toDocStatus } from '../components/ivy/StatusBadge';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { fireScholaraConfetti } from '../lib/confetti';
import { cn } from '../lib/cn';
import { getBackPath, hasNavFrom } from '../lib/navigation';
import { formatDisplayDate } from '../lib/statusMaps';
import {
  fetchDocumentDownloadUrl,
  fetchDocuments,
  reviewDocument,
  uploadDocument,
} from '../services/scholaraApi';
import type { DocumentItem } from '../types/domain';

type DocumentsTab = 'general' | 'university';

function isUniversityDoc(doc: DocumentItem) {
  return doc.scope === 'UNIVERSITY' || Boolean(doc.applicationId);
}

function groupByUniversity(docs: DocumentItem[]) {
  const groups = new Map<
    string,
    { key: string; universityName: string; docs: DocumentItem[] }
  >();
  for (const doc of docs) {
    const key = doc.applicationId ?? doc.universityId ?? doc.universityName ?? 'unknown';
    const universityName = doc.universityName?.trim() || 'University';
    const existing = groups.get(key);
    if (existing) {
      existing.docs.push(doc);
    } else {
      groups.set(key, { key, universityName, docs: [doc] });
    }
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.universityName.localeCompare(b.universityName),
  );
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function DocCard({
  doc,
  canReview,
  canUpload,
  uploading,
  uploadLocked,
  reviewing,
  onApprove,
  onReject,
  onPickFile,
  onView,
}: {
  doc: DocumentItem;
  canReview: boolean;
  canUpload: boolean;
  uploading: boolean;
  /** True while any upload mutation is in flight (disables sibling Upload buttons). */
  uploadLocked: boolean;
  reviewing: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onPickFile: () => void;
  onView: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const status = toDocStatus(doc.status);
  const hasFile = Boolean(doc.hasFile || doc.storagePath);
  // Upload only for missing/rejected — never for verified (even if seed has no file).
  // Orphaned under-review (DB path cleared after missing Storage object) can re-upload.
  const showUpload =
    canUpload &&
    (doc.status === 'NOT_UPLOADED' ||
      doc.status === 'REJECTED' ||
      (doc.status === 'UNDER_REVIEW' && !hasFile));
  const showView = hasFile;

  return (
    <motion.div layout className="ivy-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1528] text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-foreground">
            {doc.title}
          </p>
          <p className="mb-2.5 text-sm text-muted-foreground">
            {doc.universityName
              ? `${doc.universityName} · ${doc.documentType}`
              : doc.documentType}{' '}
            · Updated {formatDisplayDate(doc.updatedAt)}
          </p>
          <StatusBadge status={status} />
        </div>
      </div>

      <AnimatePresence>
        {status === 'rejected' && doc.rejectionReason ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="status-danger mt-4 rounded-xl p-3.5">
              <p className="text-xs font-semibold text-destructive">
                What to fix
              </p>
              <p className="mt-1.5 text-sm text-foreground">
                {doc.rejectionReason}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {(showUpload || showView) && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {showUpload ? (
            <TapButton
              disabled={uploading || uploadLocked}
              onClick={onPickFile}
              className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl text-sm"
            >
              <Upload className="h-4 w-4" />
              {uploading
                ? 'Uploading…'
                : doc.status === 'REJECTED'
                  ? 'Re-upload'
                  : 'Upload'}
            </TapButton>
          ) : null}
          {showView ? (
            <TapButton
              onClick={onView}
              className="btn-outline flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              <Eye className="h-4 w-4 text-gold-ink" /> View file
            </TapButton>
          ) : null}
        </div>
      )}

      {canReview && doc.status === 'UNDER_REVIEW' ? (
        <div className="mt-5 space-y-2.5">
          <div className="flex gap-2.5">
            <TapButton
              disabled={reviewing}
              onClick={onApprove}
              className="flex flex-1 items-center justify-center rounded-xl bg-success text-sm font-semibold text-white shadow-btn"
            >
              {reviewing ? 'Saving…' : 'Approve'}
            </TapButton>
            <TapButton
              disabled={reviewing}
              onClick={() => setRejecting(true)}
              className="btn-outline flex flex-1 items-center justify-center rounded-xl border-destructive/40 text-sm font-semibold text-destructive"
            >
              Reject
            </TapButton>
          </div>
          {rejecting ? (
            <div className="space-y-2 rounded-xl border border-border bg-secondary p-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={reviewing}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                placeholder="Explain what must be fixed"
              />
              <div className="flex gap-2">
                <TapButton
                  disabled={reviewing || reason.trim().length < 3}
                  onClick={() => {
                    onReject(reason.trim());
                    setRejecting(false);
                    setReason('');
                  }}
                  className="flex flex-1 items-center justify-center rounded-xl bg-destructive text-sm font-semibold text-white disabled:opacity-50"
                >
                  Confirm
                </TapButton>
                <TapButton
                  disabled={reviewing}
                  onClick={() => {
                    setRejecting(false);
                    setReason('');
                  }}
                  className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </TapButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

export function DocumentsPage({
  studentId,
  canReview = false,
}: {
  studentId?: string;
  canReview?: boolean;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [tab, setTab] = useState<DocumentsTab>('general');
  const backFallback = studentId ? `/app/students/${studentId}` : '/app';
  const showBack = hasNavFrom(location);
  const backTo = getBackPath(location, backFallback);

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', studentId ?? 'self'],
    queryFn: () => fetchDocuments(studentId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
    }) => reviewDocument(id, decision, reason),
    onSuccess: (_data, variables) => {
      if (variables.decision === 'APPROVED') fireScholaraConfetti();
      toast.success('Document review saved');
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['consultant-students'] });
    },
    onError: () => toast.error('Review failed'),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadDocument(id, file),
    onSuccess: () => {
      toast.success('Document uploaded for review');
      setUploadTargetId(null);
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['consultant-students'] });
    },
    onError: (err: unknown) => {
      const message =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
          ? String(
              Array.isArray(
                (err.response.data as { message: unknown }).message,
              )
                ? (err.response.data as { message: string[] }).message[0]
                : (err.response.data as { message: string }).message,
            )
          : 'Upload failed';
      toast.error(message);
      setUploadTargetId(null);
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading documents…</p>;
  }
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">Could not load documents.</p>
    );
  }

  const generalDocs = data.filter((d) => !isUniversityDoc(d));
  const universityDocs = data.filter((d) => isUniversityDoc(d));
  const visibleDocs = tab === 'general' ? generalDocs : universityDocs;
  const universityGroups = groupByUniversity(universityDocs);

  const actionRequired = visibleDocs.filter(
    (d) => d.status === 'NOT_UPLOADED' || d.status === 'REJECTED',
  );
  const underReview = visibleDocs.filter((d) => d.status === 'UNDER_REVIEW');
  const approved = visibleDocs.filter((d) => d.status === 'VERIFIED');
  const canUpload = user?.role === 'STUDENT';
  const isGuardian = user?.role === 'GUARDIAN';
  const allApproved =
    visibleDocs.length > 0 && approved.length === visibleDocs.length;

  const renderDocCard = (doc: DocumentItem) => (
    <DocCard
      key={doc.id}
      doc={doc}
      canReview={canReview}
      canUpload={canUpload}
      uploading={uploadMutation.isPending && uploadTargetId === doc.id}
      uploadLocked={uploadMutation.isPending}
      reviewing={reviewMutation.isPending}
      onApprove={() => {
        if (reviewMutation.isPending) return;
        reviewMutation.mutate({ id: doc.id, decision: 'APPROVED' });
      }}
      onReject={(reason) => {
        if (reviewMutation.isPending) return;
        reviewMutation.mutate({
          id: doc.id,
          decision: 'REJECTED',
          reason,
        });
      }}
      onPickFile={() => {
        if (uploadMutation.isPending) {
          toast.error('Wait for the current upload to finish');
          return;
        }
        setUploadTargetId(doc.id);
        fileInputRef.current?.click();
      }}
      onView={() => {
        void fetchDocumentDownloadUrl(doc.id)
          .then(({ url }) => {
            window.open(url, '_blank', 'noopener,noreferrer');
          })
          .catch((err: unknown) => {
            const message =
              err &&
              typeof err === 'object' &&
              'response' in err &&
              err.response &&
              typeof err.response === 'object' &&
              'data' in err.response &&
              err.response.data &&
              typeof err.response.data === 'object' &&
              'message' in err.response.data
                ? String(
                    (err.response.data as { message: string }).message,
                  )
                : 'File is missing from storage. Please upload again.';
            toast.error(message);
            void queryClient.invalidateQueries({
              queryKey: ['documents'],
            });
            void queryClient.invalidateQueries({
              queryKey: ['dashboard'],
            });
          });
      }}
    />
  );

  function renderGrouped(docs: DocumentItem[]) {
    const action = docs.filter(
      (d) => d.status === 'NOT_UPLOADED' || d.status === 'REJECTED',
    );
    const review = docs.filter((d) => d.status === 'UNDER_REVIEW');
    const done = docs.filter((d) => d.status === 'VERIFIED');
    return (
      <div className="space-y-6">
        {action.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Action required
            </h3>
            <div className="space-y-4">{action.map(renderDocCard)}</div>
          </section>
        ) : null}
        {review.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Waiting for review
            </h3>
            <div className="space-y-4">{review.map(renderDocCard)}</div>
          </section>
        ) : null}
        {done.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Approved</h3>
            <div className="space-y-4">{done.map(renderDocCard)}</div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <PageMotion>
      <div className="space-y-8">
        <div>
          {showBack ? (
            <div className="mb-3 flex items-start gap-2">
              <BackLink to={backTo} className="mb-0" />
              <div className="min-w-0 flex-1">
                <ScreenTitle
                  eyebrow="Paperwork"
                  title={
                    canReview
                      ? 'Student documents'
                      : isGuardian
                        ? 'Student documents'
                        : 'Your documents'
                  }
                />
              </div>
            </div>
          ) : (
            <ScreenTitle
              eyebrow="Paperwork"
              title={
                canReview
                  ? 'Student documents'
                  : isGuardian
                    ? 'Student documents'
                    : 'Your documents'
              }
            />
          )}
          {isGuardian ? (
            <ReadOnlyBanner studentFirstName="your linked student" />
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const id = uploadTargetId;
            e.target.value = '';
            if (!file || !id) return;
            if (uploadMutation.isPending) {
              toast.error('Wait for the current upload to finish');
              return;
            }
            if (file.size === 0) {
              toast.error('File is empty');
              setUploadTargetId(null);
              return;
            }
            if (file.size > MAX_UPLOAD_BYTES) {
              toast.error('File must be 8 MB or smaller');
              setUploadTargetId(null);
              return;
            }
            if (file.type && !ALLOWED_UPLOAD_MIME.has(file.type)) {
              toast.error('Allowed types: PDF, JPG, PNG, WEBP, DOC, DOCX');
              setUploadTargetId(null);
              return;
            }
            uploadMutation.mutate({ id, file });
          }}
        />

        <div
          role="tablist"
          aria-label="Document categories"
          className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary p-1"
        >
          {(
            [
              ['general', 'General', generalDocs.length],
              ['university', 'By university', universityDocs.length],
            ] as const
          ).map(([id, label, count]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {label}
                <span
                  className={cn(
                    'ml-1.5 text-xs font-medium',
                    active ? 'text-gold-ink' : 'text-muted-foreground/80',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ['Action needed', actionRequired.length, 'text-destructive'],
              ['In review', underReview.length, 'text-gold-ink'],
              ['Approved', approved.length, 'text-success'],
            ] as const
          ).map(([label, n, color]) => (
            <div key={label} className="ivy-card py-3">
              <p className={cn('font-sans text-xl font-semibold', color)}>
                {n}
              </p>
              <p className="mt-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>
        {allApproved ? (
          <p className="status-success rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold">
            All {visibleDocs.length}{' '}
            {tab === 'general' ? 'general' : 'university'} documents are approved
          </p>
        ) : null}
        {visibleDocs.length === 0 ? (
          <div className="ivy-card !p-0">
            <EmptyState
              icon={FileText}
              title={
                tab === 'general'
                  ? 'No general documents yet'
                  : 'No university documents yet'
              }
              description={
                tab === 'general'
                  ? canUpload
                    ? 'Upload shared files like Civil ID, academic transcript, and passport photograph.'
                    : isGuardian
                      ? 'Your linked student has not uploaded general documents yet.'
                      : 'This student has not uploaded general documents yet.'
                  : canUpload
                    ? 'University-specific forms and receipts will appear here per application.'
                    : isGuardian
                      ? 'Your linked student has no university-specific documents yet.'
                      : 'This student has no university-specific documents yet.'
              }
            />
          </div>
        ) : tab === 'general' ? (
          renderGrouped(generalDocs)
        ) : (
          <div className="space-y-8">
            {universityGroups.map((group) => (
              <section key={group.key} className="space-y-4">
                <div>
                  <p className="label-caps">University</p>
                  <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground">
                    {group.universityName}
                  </h2>
                </div>
                {renderGrouped(group.docs)}
              </section>
            ))}
          </div>
        )}
      </div>
    </PageMotion>
  );
}
