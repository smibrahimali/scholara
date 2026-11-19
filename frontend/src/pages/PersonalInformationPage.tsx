import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  FileWarning,
  GraduationCap,
  Phone,
  Users,
  Wallet,
} from 'lucide-react';
import { BackLink } from '../components/ivy/BackLink';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { getBackPath, withFrom } from '../lib/navigation';
import { dashboardKey, paymentsKey } from '../lib/queryKeys';
import { toDecisionStatus } from '../lib/statusMaps';
import { fetchDashboard, fetchPayments } from '../services/scholaraApi';
import type {
  ApplicationItem,
  DashboardData,
  DocumentItem,
  PaymentItem,
  PaymentsSummary,
} from '../types/domain';

const HISTORY_PREVIEW = 4;

function parseFeeDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
}

function formatFeeDate(value: string): string {
  const date = parseFeeDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatFeeDateShort(value: string): string {
  const date = parseFeeDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'CONSULTANT':
      return 'Consultant';
    case 'UNIVERSITY':
      return 'University';
    case 'APPLICATION':
      return 'Application';
    case 'DOCUMENT':
      return 'Documents';
    default:
      return 'Other';
  }
}

function DecisionChip({ status }: { status: ApplicationItem['status'] }) {
  const label = toDecisionStatus(status);
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        label === 'Accepted' && 'bg-success-soft text-success',
        label === 'Waitlisted' && 'bg-warning-soft text-warning',
        label === 'Rejected' && 'bg-destructive-soft text-destructive',
        label === 'Pending' && 'bg-neutral-soft text-neutral',
      )}
      role="status"
    >
      {label}
    </span>
  );
}

function PaymentRow({
  item,
  tone,
}: {
  item: PaymentItem;
  tone: 'paid' | 'due';
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(item.description || item.payeeLabel);

  return (
    <div className="px-4 py-3.5">
      <button
        type="button"
        className={cn(
          'flex w-full items-start gap-3 text-left',
          hasDetails ? 'cursor-pointer' : 'cursor-default',
        )}
        onClick={() => {
          if (hasDetails) setOpen((v) => !v);
        }}
        aria-expanded={hasDetails ? open : undefined}
      >
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            tone === 'paid'
              ? 'bg-success-soft text-success'
              : 'bg-warning-soft text-warning',
          )}
          aria-hidden
        >
          {tone === 'paid' ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">
              {item.title}
            </p>
            <p
              className={cn(
                'shrink-0 text-[15px] font-semibold tabular-nums',
                tone === 'paid' ? 'text-success' : 'text-warning',
              )}
            >
              {formatMoney(item.amount, item.currency)}
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {tone === 'due' ? (
              <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                Due
              </span>
            ) : (
              <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                Paid
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatFeeDateShort(item.occurredOn)}
            </span>
            <span className="rounded-md bg-[#F3F2F0] px-1.5 py-0.5 text-[10px] font-medium text-[#5C6578]">
              {categoryLabel(item.category)}
            </span>
            {hasDetails ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#8A7F6C]">
                {open ? 'Less' : 'Details'}
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    open && 'rotate-180',
                  )}
                  strokeWidth={2}
                />
              </span>
            ) : null}
          </div>
        </div>
      </button>
      {open && hasDetails ? (
        <div className="ml-11 mt-2 space-y-1 border-l-2 border-[#EDE5D5] pl-3">
          {item.payeeLabel ? (
            <p className="text-xs text-muted-foreground">{item.payeeLabel}</p>
          ) : null}
          {item.description ? (
            <p className="text-xs leading-relaxed text-[#6B7280]">
              {item.description}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type NextAction = {
  title: string;
  detail: string;
  cta: string;
  to: string;
  tone: 'urgent' | 'warn' | 'ok';
};

function buildNextAction(
  dashboard: DashboardData | undefined,
  payments: PaymentsSummary | undefined,
): NextAction | null {
  if (!dashboard) return null;

  const rejected = dashboard.documents.find((d) => d.status === 'REJECTED');
  if (rejected) {
    return {
      title: `Re-upload ${rejected.title}`,
      detail:
        rejected.rejectionReason?.slice(0, 120) ??
        'This document was rejected and needs a clearer file.',
      cta: 'Open Documents',
      to: '/app/documents',
      tone: 'urgent',
    };
  }

  const missing = dashboard.documents.find((d) => d.status === 'NOT_UPLOADED');
  if (missing) {
    return {
      title: `Upload ${missing.title}`,
      detail: 'Missing file is blocking application progress.',
      cta: 'Upload now',
      to: '/app/documents',
      tone: 'warn',
    };
  }

  const nextFee = payments?.upcoming[0];
  if (nextFee) {
    return {
      title: nextFee.title,
      detail: `Due ${formatFeeDate(nextFee.occurredOn)} · ${formatMoney(nextFee.amount, nextFee.currency)}`,
      cta: 'Review fees',
      to: '/app/profile/personal',
      tone: 'warn',
    };
  }

  const nextDeadline = dashboard.deadlines[0];
  if (nextDeadline) {
    return {
      title: `${nextDeadline.label} — ${nextDeadline.university}`,
      detail: `Due ${formatFeeDate(nextDeadline.date)}`,
      cta: 'View applications',
      to: '/app/applications',
      tone: 'warn',
    };
  }

  return {
    title: 'You are on track',
    detail: 'No urgent document or fee actions right now.',
    cta: 'View applications',
    to: '/app/applications',
    tone: 'ok',
  };
}

function docCounts(documents: DocumentItem[]) {
  let missing = 0;
  let review = 0;
  let verified = 0;
  let rejected = 0;
  for (const doc of documents) {
    if (doc.status === 'NOT_UPLOADED') missing += 1;
    else if (doc.status === 'UNDER_REVIEW') review += 1;
    else if (doc.status === 'VERIFIED') verified += 1;
    else if (doc.status === 'REJECTED') rejected += 1;
  }
  return { missing, review, verified, rejected, total: documents.length };
}

export function PersonalInformationPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = getBackPath(location, '/app/profile');
  const showStudentLedger =
    user?.role === 'STUDENT' || user?.role === 'GUARDIAN';
  const [showAllHistory, setShowAllHistory] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: dashboardKey('self'),
    queryFn: () => fetchDashboard(),
    enabled: Boolean(user) && showStudentLedger,
  });

  const paymentsQuery = useQuery({
    queryKey: paymentsKey('self'),
    queryFn: () => fetchPayments(),
    enabled: Boolean(user) && showStudentLedger,
  });

  const dashboard = dashboardQuery.data;
  const payments = paymentsQuery.data;
  const nextAction = useMemo(
    () => buildNextAction(dashboard, payments),
    [dashboard, payments],
  );
  const docs = useMemo(
    () => docCounts(dashboard?.documents ?? []),
    [dashboard?.documents],
  );

  // Deep-link from Home attention: /app/profile/personal#fees
  useEffect(() => {
    if (location.hash !== '#fees') return;
    if (showStudentLedger && paymentsQuery.isLoading) return;
    const timer = window.setTimeout(() => {
      document.getElementById('fees')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash, paymentsQuery.isLoading, showStudentLedger]);

  if (!user) return null;

  const profile = dashboard?.student;
  const phone = profile?.phone ?? '—';
  const targetProgram = profile?.targetProgram ?? '—';
  const preferredIntake = profile?.preferredIntake?.trim() || '—';

  return (
    <PageMotion className="pb-32">
      <div className="mb-3 flex items-start gap-2">
        <BackLink to={backTo} label="Back to Profile" className="mb-0" />
        <ScreenTitle eyebrow="Account" title="Personal Information" />
      </div>

      {/* 1. Contact & academic profile */}
      <div className="overflow-hidden rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9]">
        <div className="border-b border-[#EDE5D5] px-4 py-3">
          <p className="text-sm font-semibold text-[#111E33]">
            Contact & academic profile
          </p>
        </div>
        <dl className="divide-y divide-[#EDE5D5] text-sm">
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A7F6C]">
              Full name
            </dt>
            <dd className="text-right font-medium text-[#111E33]">
              {profile?.fullName ?? user.fullName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A7F6C]">
              Email
            </dt>
            <dd className="break-all text-right font-medium text-[#111E33]">
              {profile?.email ?? user.email}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A7F6C]">
              Phone
            </dt>
            <dd className="text-right font-medium text-[#111E33]">{phone}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A7F6C]">
              Target program
            </dt>
            <dd className="text-right font-medium text-[#111E33]">
              {targetProgram}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A7F6C]">
              Preferred intake
            </dt>
            <dd className="text-right font-medium text-[#111E33]">
              {preferredIntake}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A7F6C]">
              Role
            </dt>
            <dd className="text-right font-medium text-[#111E33]">
              {user.role}
            </dd>
          </div>
        </dl>
      </div>

      {showStudentLedger ? (
        <>
          {/* 3. Next action */}
          {nextAction ? (
            <section
              className={cn(
                'mt-5 rounded-2xl border p-4',
                nextAction.tone === 'urgent' && 'alert-danger',
                nextAction.tone === 'warn' && 'alert-warning',
                nextAction.tone === 'ok' && 'alert-success',
              )}
            >
              <p className="label-caps">Next action</p>
              <p className="mt-1 text-sm font-semibold text-[#0F1E36]">
                {nextAction.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#525B6B]">
                {nextAction.detail}
              </p>
              {nextAction.to !== '/app/profile/personal' ? (
                <TapButton
                  type="button"
                  className="btn-primary mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold"
                  onClick={() =>
                    navigate(nextAction.to, withFrom(location.pathname))
                  }
                >
                  {nextAction.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </TapButton>
              ) : null}
            </section>
          ) : null}

          {/* 2. Linked people */}
          <section className="mt-5 overflow-hidden rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9]">
            <div className="flex items-center gap-2 border-b border-[#EDE5D5] px-4 py-3">
              <Users className="h-4 w-4 text-[#8A6514]" />
              <p className="text-sm font-semibold text-[#111E33]">
                Linked people
              </p>
            </div>
            <div className="divide-y divide-[#EDE5D5]">
              {profile?.consultant ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate('/app/consultant', withFrom(location.pathname))
                  }
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5CE96] bg-[#FBF3DF] text-[#8A6212]">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#111E33]">
                      {profile.consultant.fullName}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {profile.consultant.title ?? 'Admissions consultant'}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ) : (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  No consultant assigned yet.
                </p>
              )}

              {user.role === 'STUDENT' && profile?.guardian ? (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5CE96] bg-[#FBF3DF] text-[#8A6212]">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111E33]">
                      {profile.guardian.fullName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Guardian · {profile.guardian.email}
                    </p>
                  </div>
                </div>
              ) : null}

              {user.role === 'GUARDIAN' && profile ? (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5CE96] bg-[#FBF3DF] text-[#8A6212]">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111E33]">
                      {profile.fullName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Linked student · read-only oversight
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* 4. Document readiness */}
          <section className="mt-5 overflow-hidden rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9]">
            <div className="flex items-center justify-between gap-2 border-b border-[#EDE5D5] px-4 py-3">
              <div className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-[#8A6514]" />
                <p className="text-sm font-semibold text-[#111E33]">
                  Document readiness
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate('/app/documents', withFrom(location.pathname))
                }
                className="text-xs font-semibold text-[#8A6514]"
              >
                View all
              </button>
            </div>
            {dashboardQuery.isLoading ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">
                Loading documents…
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 px-4 py-3">
                <div className="rounded-xl bg-success-soft px-2 py-2 text-center">
                  <p className="text-sm font-semibold text-success">
                    {docs.verified}
                  </p>
                  <p className="text-[10px] font-medium text-success/80">
                    Verified
                  </p>
                </div>
                <div className="rounded-xl bg-warning-soft px-2 py-2 text-center">
                  <p className="text-sm font-semibold text-warning">
                    {docs.review}
                  </p>
                  <p className="text-[10px] font-medium text-warning/80">
                    Review
                  </p>
                </div>
                <div className="rounded-xl bg-destructive-soft px-2 py-2 text-center">
                  <p className="text-sm font-semibold text-destructive">
                    {docs.rejected}
                  </p>
                  <p className="text-[10px] font-medium text-destructive/80">
                    Rejected
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-soft px-2 py-2 text-center">
                  <p className="text-sm font-semibold text-neutral">
                    {docs.missing}
                  </p>
                  <p className="text-[10px] font-medium text-neutral/80">
                    Missing
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 5. Application snapshot */}
          <section className="mt-5 overflow-hidden rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9]">
            <div className="flex items-center justify-between gap-2 border-b border-[#EDE5D5] px-4 py-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[#8A6514]" />
                <p className="text-sm font-semibold text-[#111E33]">
                  Application snapshot
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate('/app/applications', withFrom(location.pathname))
                }
                className="text-xs font-semibold text-[#8A6514]"
              >
                Open
              </button>
            </div>
            {(dashboard?.applications.length ?? 0) === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">
                No applications on file yet.
              </p>
            ) : (
              <div className="divide-y divide-[#EDE5D5]">
                {dashboard?.applications.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/app/applications/${app.id}`,
                        withFrom(location.pathname),
                      )
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#111E33]">
                        {app.university.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {app.program.name}
                      </span>
                    </span>
                    <DecisionChip status={app.status} />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Payments */}
          <section id="fees" className="mt-6 scroll-mt-6">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="label-caps">Finances</p>
                <h2 className="font-sans text-xl font-semibold tracking-tight text-[#0F1E36]">
                  Fees & payments
                </h2>
              </div>
              <Wallet className="h-5 w-5 text-[#C8963E]" strokeWidth={1.5} />
            </div>

            {paymentsQuery.isLoading ? (
              <p className="rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9] px-4 py-5 text-xs font-semibold text-muted-foreground">
                Loading fees…
              </p>
            ) : null}
            {paymentsQuery.isError ? (
              <p className="alert-danger rounded-2xl px-4 py-5 text-xs font-semibold">
                Could not load payments. Try again shortly.
              </p>
            ) : null}

            {payments ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-border bg-card px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Paid
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-success">
                      {formatMoney(payments.paidTotal, payments.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-warning-border bg-warning-soft/70 px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                      Due
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-warning">
                      {formatMoney(payments.dueTotal, payments.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(payments.grandTotal, payments.currency)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9]">
                  <div className="flex items-center justify-between gap-2 border-b border-[#EDE5D5] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-[#8A6514]" />
                      <p className="text-sm font-semibold text-[#111E33]">
                        Upcoming
                      </p>
                    </div>
                    {payments.upcoming.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {payments.upcoming.length} due
                      </span>
                    ) : null}
                  </div>
                  {payments.upcoming.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-muted-foreground">
                      Nothing due right now.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EDE5D5]">
                      {payments.upcoming.map((item) => (
                        <PaymentRow key={item.id} item={item} tone="due" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9]">
                  <div className="flex items-center justify-between gap-2 border-b border-[#EDE5D5] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-success" />
                      <p className="text-sm font-semibold text-[#111E33]">
                        History
                      </p>
                    </div>
                    {payments.history.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {payments.history.length} paid
                      </span>
                    ) : null}
                  </div>
                  {payments.history.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-muted-foreground">
                      No payments recorded yet.
                    </p>
                  ) : (
                    <>
                      <div className="divide-y divide-[#EDE5D5]">
                        {(showAllHistory
                          ? payments.history
                          : payments.history.slice(0, HISTORY_PREVIEW)
                        ).map((item) => (
                          <PaymentRow key={item.id} item={item} tone="paid" />
                        ))}
                      </div>
                      {payments.history.length > HISTORY_PREVIEW ? (
                        <div className="border-t border-[#EDE5D5] px-4 py-2.5">
                          <TapButton
                            type="button"
                            className="flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-[#5C6578] hover:bg-[#F3F2F0]"
                            onClick={() => setShowAllHistory((v) => !v)}
                          >
                            {showAllHistory
                              ? 'Show less'
                              : `Show ${payments.history.length - HISTORY_PREVIEW} earlier`}
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 transition-transform',
                                showAllHistory && 'rotate-180',
                              )}
                            />
                          </TapButton>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : (
        <p className="mt-6 rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9] px-4 py-4 text-xs leading-relaxed text-muted-foreground">
          Student dossier tools (fees, documents, applications) open from each
          assigned student file.
        </p>
      )}
    </PageMotion>
  );
}
