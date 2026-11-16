import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '../components/ivy/EmptyState';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { StatusBadge, toDocStatus } from '../components/ivy/StatusBadge';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { fireScholaraConfetti } from '../lib/confetti';
import { cn } from '../lib/cn';
import { formatDisplayDate } from '../lib/statusMaps';
import {
  fetchDocumentDownloadUrl,
  fetchDocuments,
  reviewDocument,
  uploadDocument,
} from '../services/scholaraApi';
import type { DocumentItem } from '../types/domain';

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
            {doc.documentType} · Updated {formatDisplayDate(doc.updatedAt)}
          </p>
          <StatusBadge status={status} />
          {doc.status === 'VERIFIED' ? (
            <p className="status-success mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold">
              Verified by Consultant
            </p>
          ) : null}
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
              <p className="text-xs font-medium uppercase tracking-wider">
                Reason from Consultant
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
              className="btn-primary flex flex-1 items-center justify-center rounded-xl bg-success border-success text-sm font-semibold text-white"
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', studentId ?? user?.id],
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
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
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
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
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

  const counts = {
    verified: data.filter((d) => d.status === 'VERIFIED').length,
    review: data.filter((d) => d.status === 'UNDER_REVIEW').length,
    missing: data.filter((d) => d.status === 'NOT_UPLOADED').length,
    rejected: data.filter((d) => d.status === 'REJECTED').length,
  };
  const canUpload = user?.role === 'STUDENT';
  const isGuardian = user?.role === 'GUARDIAN';
  const allVerified =
    data.length > 0 && counts.verified === data.length;

  return (
    <PageMotion>
      <div className="space-y-8">
        <ScreenTitle
          eyebrow="Secure Records"
          title={
            canReview
              ? 'Student Documents'
              : isGuardian
                ? 'Student Documents'
                : 'Your Documents'
          }
        />
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
        <div className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              ['Verified', counts.verified, 'text-success'],
              ['In Review', counts.review, 'text-gold-ink'],
              ['Missing', counts.missing, 'text-muted-foreground'],
              ['Rejected', counts.rejected, 'text-destructive'],
            ] as const
          ).map(([label, n, color]) => (
            <div key={label} className="ivy-card py-3">
              <p className={cn('font-sans text-xl font-semibold', color)}>
                {n}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>
        {allVerified ? (
          <p className="status-success rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold">
            All {data.length} documents verified by consultant
          </p>
        ) : null}
        {data.length === 0 ? (
          <div className="ivy-card !p-0">
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description={
                canUpload
                  ? 'Upload required files so your consultant can begin review.'
                  : isGuardian
                    ? 'Your linked student has not uploaded any documents yet.'
                    : 'This student has not uploaded any documents yet.'
              }
            />
          </div>
        ) : (
          <div className="space-y-5">
            {data.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                canReview={canReview}
                canUpload={canUpload}
                uploading={
                  uploadMutation.isPending && uploadTargetId === doc.id
                }
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
                              (err.response.data as { message: string })
                                .message,
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
            ))}
          </div>
        )}
      </div>
    </PageMotion>
  );
}
