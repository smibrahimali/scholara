import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { StatusBadge, toDocStatus } from '../components/ivy/StatusBadge';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { fireScholaraConfetti } from '../lib/confetti';
import { cn } from '../lib/cn';
import { formatDisplayDate } from '../lib/statusMaps';
import { fetchDocuments, reviewDocument } from '../services/scholaraApi';
import type { DocumentItem } from '../types/domain';

function DocCard({
  doc,
  canReview,
  onApprove,
  onReject,
}: {
  doc: DocumentItem;
  canReview: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const { user } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const status = toDocStatus(doc.status);

  return (
    <motion.div
      layout
      className="rounded-2xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <FileText className="h-5 w-5 text-primary" />
        </span>
        <div className="flex-1">
          <p className="font-semibold leading-snug">{doc.title}</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Updated {formatDisplayDate(doc.updatedAt)}
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
              {user?.role === 'STUDENT' ? (
                <TapButton
                  onClick={() =>
                    toast.message(
                      'Upload flow coming next — use demo review for now.',
                    )
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                >
                  <Upload className="h-4 w-4" /> Re-upload Document
                </TapButton>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

  return (
    <PageMotion>
      <ScreenTitle eyebrow="Secure Records" title="Your Documents" />
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
          />
        ))}
      </div>
    </PageMotion>
  );
}
