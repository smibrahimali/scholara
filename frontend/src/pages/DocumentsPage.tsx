import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
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

function DocCard({
  doc,
  canReview,
  canUpload,
  uploading,
  onApprove,
  onReject,
  onPickFile,
  onView,
}: {
  doc: DocumentItem;
  canReview: boolean;
  canUpload: boolean;
  uploading: boolean;
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
    <motion.div
      layout
      className="rounded-2xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1528] text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]">
          <FileText className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold leading-snug text-foreground">
            {doc.title}
          </p>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {doc.documentType} · Updated {formatDisplayDate(doc.updatedAt)}
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
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive-soft p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-destructive">
                Reason from Consultant
              </p>
              <p className="mt-1 text-sm text-foreground">
                {doc.rejectionReason}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {(showUpload || showView) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {showView ? (
            <TapButton
              onClick={onView}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary text-sm font-semibold text-foreground"
            >
              <Eye className="h-4 w-4 text-gold-ink" /> View file
            </TapButton>
          ) : null}
          {showUpload ? (
            <TapButton
              disabled={uploading}
              onClick={onPickFile}
              className="btn-metallic flex flex-1 items-center justify-center gap-2 rounded-xl text-sm"
            >
              <Upload className="h-4 w-4" />
              {uploading
                ? 'Uploading…'
                : doc.status === 'REJECTED'
                  ? 'Re-upload'
                  : 'Upload'}
            </TapButton>
          ) : null}
        </div>
      )}

      {canReview &&
      (doc.status === 'UNDER_REVIEW' || doc.status === 'REJECTED') ? (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <TapButton
              onClick={onApprove}
              className="flex flex-1 items-center justify-center rounded-xl bg-success text-sm font-semibold text-white"
            >
              Approve
            </TapButton>
            <TapButton
              onClick={() => setRejecting(true)}
              className="flex flex-1 items-center justify-center rounded-xl bg-destructive text-sm font-semibold text-white"
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
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                placeholder="Explain what must be fixed"
              />
              <div className="flex gap-2">
                <TapButton
                  disabled={reason.trim().length < 3}
                  onClick={() => {
                    onReject(reason.trim());
                    setRejecting(false);
                    setReason('');
                  }}
                  className="flex flex-1 items-center justify-center rounded-xl bg-destructive text-sm font-semibold text-white"
                >
                  Confirm
                </TapButton>
                <TapButton
                  onClick={() => {
                    setRejecting(false);
                    setReason('');
                  }}
                  className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold"
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
    rejected: data.filter((d) => d.status === 'REJECTED').length,
  };
  const canUpload = user?.role === 'STUDENT';

  return (
    <PageMotion>
      <ScreenTitle eyebrow="Secure Records" title="Your Documents" />
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
          uploadMutation.mutate({ id, file });
        }}
      />
      <div className="mb-5 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['Verified', counts.verified, 'text-success'],
            ['In Review', counts.review, 'text-gold-ink'],
            ['Rejected', counts.rejected, 'text-destructive'],
          ] as const
        ).map(([label, n, color]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card py-3"
          >
            <p className={cn('font-serif text-2xl font-semibold', color)}>
              {n}
            </p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {data.map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            canReview={canReview}
            canUpload={canUpload}
            uploading={
              uploadMutation.isPending && uploadTargetId === doc.id
            }
            onApprove={() =>
              reviewMutation.mutate({ id: doc.id, decision: 'APPROVED' })
            }
            onReject={(reason) =>
              reviewMutation.mutate({
                id: doc.id,
                decision: 'REJECTED',
                reason,
              })
            }
            onPickFile={() => {
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
        ))}
      </div>
    </PageMotion>
  );
}
