import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  MessageCircle,
  Phone,
  Upload,
  Wallet,
} from 'lucide-react';
import { CrestMark } from '../components/ivy/CrestMark';
import { EmptyState } from '../components/ivy/EmptyState';
import { HeraldicDivider } from '../components/ivy/HeraldicDivider';
import { ProgressRing } from '../components/ivy/ProgressRing';
import { ReadOnlyBanner } from '../components/ivy/ReadOnlyBanner';
import { SectionMotion } from '../components/ivy/SectionMotion';
import { StatusBadge, toDocStatus } from '../components/ivy/StatusBadge';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import {
  buildAttentionItems,
  filterAttentionByChannel,
  type AttentionItem,
  type AttentionTone,
} from '../lib/attention';
import { cn } from '../lib/cn';
import { withFrom } from '../lib/navigation';
import {
  callRequestsKey,
  callsKey,
  dashboardKey,
  paymentsKey,
} from '../lib/queryKeys';
import {
  fetchCallRequests,
  fetchCalls,
  fetchDashboard,
  fetchPayments,
} from '../services/scholaraApi';
import type { ApplicationStep, DocumentItem } from '../types/domain';

function attentionToneClass(tone: AttentionTone) {
  switch (tone) {
    case 'danger':
      return 'bg-destructive-soft text-destructive';
    case 'success':
      return 'bg-success-soft text-success';
    case 'info':
      return 'bg-info-soft text-info';
    case 'navy':
      return 'bg-primary text-gold';
    case 'warning':
    default:
      return 'bg-warning-soft text-warning';
  }
}

function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function daysUntil(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function formatShortDeadline(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return String(d.getDate());
}

function officialFileCode(studentId: string) {
  const n = studentId.replace(/\D/g, '').slice(-4) || '8841';
  return `APPL-2026-${n.padStart(4, '0')}`;
}

function stepDotClass(status: ApplicationStep['status']) {
  if (status === 'COMPLETED' || status === 'SKIPPED') return 'bg-gold';
  if (status === 'IN_PROGRESS') return 'border border-gold bg-transparent';
  return 'bg-white/20';
}

function docAccent(status: DocumentItem['status']) {
  switch (status) {
    case 'VERIFIED':
      return { bar: 'bg-success', tile: 'bg-primary text-gold' };
    case 'UNDER_REVIEW':
      return { bar: 'bg-warning', tile: 'bg-primary text-warning-soft' };
    case 'REJECTED':
      return { bar: 'bg-destructive', tile: 'bg-primary text-destructive-soft' };
    default:
      return { bar: 'bg-muted-foreground/35', tile: 'bg-primary text-muted-foreground' };
  }
}

function fileMeta(doc: DocumentItem) {
  const type = (doc.documentType || 'PDF').toUpperCase();
  const statusLabel =
    doc.status === 'VERIFIED'
      ? 'Approved'
      : doc.status === 'UNDER_REVIEW'
        ? 'Waiting for review'
        : doc.status === 'REJECTED'
          ? 'Needs re-upload'
          : 'Not uploaded';
  const scope = doc.universityName?.trim() || 'General';
  return `${scope} · ${type} · ${statusLabel}`;
}

function HomeSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton h-44 w-full" />
      <div className="grid grid-cols-3 gap-2">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
      <div className="skeleton h-28 w-full" />
      <div className="skeleton h-48 w-full" />
    </div>
  );
}

export function StudentDashboardPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const isConsultantDossier =
    Boolean(studentId) && user?.role === 'CONSULTANT';
  // Consultants must never hit self-scoped student APIs (403 without studentId).
  const studentScopeEnabled =
    Boolean(user) &&
    (user?.role !== 'CONSULTANT' || Boolean(studentId));

  const studentScope = studentId ?? 'self';

  const { data, isLoading, error } = useQuery({
    queryKey: dashboardKey(studentScope),
    queryFn: () => fetchDashboard(studentId),
    enabled: studentScopeEnabled,
    retry: false,
  });
  const callsQuery = useQuery({
    queryKey: callsKey(studentScope),
    queryFn: () => fetchCalls(studentId),
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const hasOpen = query.state.data?.some((call) => !call.endedAt);
      // Poll only while a live call exists — idle dashboards stay quiet.
      return hasOpen ? 5_000 : false;
    },
    enabled: studentScopeEnabled,
    retry: false,
  });

  const pendingCallsQuery = useQuery({
    queryKey: callRequestsKey(studentScope, 'PENDING'),
    queryFn: () =>
      fetchCallRequests({
        status: 'PENDING',
        ...(studentId ? { studentId } : {}),
      }),
    enabled: studentScopeEnabled,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: paymentsKey(studentScope),
    queryFn: () => fetchPayments(studentId),
    enabled: studentScopeEnabled && user?.role !== 'CONSULTANT',
    retry: false,
  });

  const greeting = useMemo(() => greetingForNow(), []);
  const openLiveCall =
    callsQuery.data?.find((call) => !call.endedAt) ?? null;

  const docsPath = studentId
    ? `/app/students/${studentId}/documents`
    : '/app/documents';
  const appsPath = studentId
    ? `/app/students/${studentId}/applications`
    : '/app/applications';
  const callsPath = studentId
    ? `/app/students/${studentId}/calls`
    : '/app/consultant';
  const messagesPath = studentId
    ? `/app/students/${studentId}/messages`
    : '/app/messages';
  const paymentsPath = '/app/profile/personal#fees';

  const allAttentionItems = useMemo(() => {
    if (!data) return [] as AttentionItem[];
    const role =
      user?.role === 'CONSULTANT'
        ? 'CONSULTANT'
        : data.readOnly
          ? 'GUARDIAN'
          : 'STUDENT';
    return buildAttentionItems({
      data,
      paths: {
        docs: docsPath,
        apps: appsPath,
        calls: callsPath,
        messages: messagesPath,
        payments: paymentsPath,
        liveCall: (id) => `/app/live-call/${id}`,
      },
      openLiveCallId: openLiveCall?.id ?? null,
      pendingCallRequests: pendingCallsQuery.data ?? [],
      payments: paymentsQuery.data ?? null,
      role,
    });
  }, [
    appsPath,
    callsPath,
    data,
    docsPath,
    messagesPath,
    openLiveCall?.id,
    paymentsPath,
    paymentsQuery.data,
    pendingCallsQuery.data,
    user?.role,
  ]);

  /** Home: docs, fees, deadlines */
  const attentionItems = useMemo(
    () => filterAttentionByChannel(allAttentionItems, 'task'),
    [allAttentionItems],
  );

  /** Bell: live call, messages, call requests, consultation notes */
  const notifications = useMemo(
    () => filterAttentionByChannel(allAttentionItems, 'comms'),
    [allAttentionItems],
  );

  if (user?.role === 'CONSULTANT' && !studentId) {
    return <Navigate to="/app" replace />;
  }

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) {
    return (
      <div className="ivy-card flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="font-sans text-lg font-semibold text-foreground">
          Could not load dashboard
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Check that the API is running, then refresh. After reseeding, sign out
          and sign in again.
        </p>
      </div>
    );
  }

  const documents = data.documents ?? [];
  const deadlines = data.deadlines ?? [];
  const applications = data.applications ?? [];
  const studentName = data.student?.fullName ?? 'Student';
  const firstName = studentName.split(' ')[0] ?? studentName;
  const primary = applications[0];
  const steps = [...(primary?.steps ?? [])].sort(
    (a, b) => a.stepNumber - b.stepNumber,
  );
  const totalSteps = Math.max(steps.length, 1);
  const doneSteps = steps.filter(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED',
  ).length;
  const currentStep = steps.find((s) => s.status === 'IN_PROGRESS');
  const chipStep =
    currentStep?.stepNumber ??
    (doneSteps >= totalSteps ? totalSteps : doneSteps + 1);
  const ringDone = Math.max(
    doneSteps,
    currentStep ? currentStep.stepNumber : 0,
  );

  const nextDeadline = deadlines[0];
  const hasUnread = notifications.length > 0;
  const isGuardianView = Boolean(data.readOnly) && !isConsultantDossier;

  const consultant = data.student?.consultant;
  const consultantInitial = consultant?.fullName?.[0] ?? 'C';
  const chipDue = nextDeadline ? formatShortDeadline(nextDeadline.date) : null;
  const fileCode = officialFileCode(data.student?.id ?? 'unknown');
  const currentStepLabel = currentStep?.label ?? null;
  const urgentPayment = (paymentsQuery.data?.upcoming ?? []).find((p) => {
    const left = daysUntil(p.occurredOn);
    return left != null && left <= 14;
  });

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-5 -right-5 -top-6 h-[260px] overflow-hidden"
      >
        <div className="ivy-ambient absolute inset-0" />
        <div className="absolute -right-10 top-2 opacity-[0.045]">
          <CrestMark size={180} />
        </div>
      </div>

      <SectionMotion index={0} className="relative mb-5">
        <div className="relative mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CrestMark size={34} />
            <div className="min-w-0">
              <p className="font-sans text-lg font-semibold leading-none tracking-tight text-foreground">
                Scholara
              </p>
              <p className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Est. Admissions Office
              </p>
            </div>
          </div>
          {!isConsultantDossier ? (
            <div className="relative shrink-0">
              <TapButton
                aria-label="Notifications"
                aria-expanded={notifOpen}
                className="relative flex h-10 w-10 min-h-0 items-center justify-center rounded-xl border border-[#EBE8E0]/90 bg-white text-[#1E2430] shadow-elev1"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell className="h-[1.1rem] w-[1.1rem] text-[#1E2430]" strokeWidth={1.5} />
                {hasUnread || notifications.length > 0 ? (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full border border-white bg-[#C8963E]" />
                ) : null}
              </TapButton>

              <AnimatePresence>
                {notifOpen ? (
                  <>
                    <button
                      key="notif-scrim"
                      type="button"
                      aria-label="Close notifications"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setNotifOpen(false)}
                    />
                    <motion.div
                      key="notif-panel"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-14 z-40 w-[min(320px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[rgba(120,53,15,0.12)] bg-card shadow-[0_18px_40px_-18px_rgba(11,21,40,0.4)]"
                    >
                      <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2.5">
                        <p className="label-caps tracking-[0.14em]">Inbox</p>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {notifications.length} item
                          {notifications.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ul className="no-scrollbar max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <li className="px-3 py-6 text-center text-sm font-semibold text-muted-foreground">
                            You&apos;re all caught up.
                          </li>
                        ) : (
                          notifications.map((n) => (
                            <li
                              key={n.id}
                              className="border-b border-black/[0.05] last:border-0"
                            >
                              <button
                                type="button"
                                className="flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-secondary/80"
                                onClick={() => {
                                  setNotifOpen(false);
                                  navigate(n.href, withFrom(pathname));
                                }}
                              >
                                <span
                                  className={cn(
                                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                                    attentionToneClass(n.tone),
                                  )}
                                >
                                  {n.tone === 'danger' ? (
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  ) : n.tone === 'success' ? (
                                    <Phone className="h-3.5 w-3.5" />
                                  ) : n.tone === 'warning' ? (
                                    <CalendarDays className="h-3.5 w-3.5" />
                                  ) : n.tone === 'info' ? (
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-foreground">
                                    {n.title}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {n.detail}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                      {notifications.length > 0 ? (
                        <div className="border-t border-black/[0.06] px-3 py-2">
                          <Link
                            to={messagesPath}
                            {...withFrom(pathname)}
                            onClick={() => setNotifOpen(false)}
                            className="inline-flex min-h-10 items-center text-xs font-semibold text-gold-ink"
                          >
                            Open messages →
                          </Link>
                        </div>
                      ) : null}
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>

        <p className="font-mono text-[0.625rem] font-semibold tracking-[0.16em] text-gold-ink">
          APPLICATION REFERENCE · {fileCode}
        </p>
        <p className="label-caps mt-3.5">
          {isConsultantDossier
            ? 'Student file,'
            : data.readOnly
              ? 'Guardian view,'
              : greeting}
        </p>
        <h1 className="editorial-title mt-1.5 text-[2rem] text-[#1E2430] sm:text-[2.125rem]">
          {isConsultantDossier ? studentName : firstName}
        </h1>
        {primary ? (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {primary.university.name}
            {currentStepLabel ? ` · Current step: ${currentStepLabel}` : ''}
          </p>
        ) : (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {isConsultantDossier
              ? 'Review progress, documents, and outreach for this student.'
              : 'Your admission overview appears below.'}
          </p>
        )}
        <HeraldicDivider className="mt-4" />
      </SectionMotion>

      {isGuardianView ? <ReadOnlyBanner studentFirstName={firstName} /> : null}

      {!primary ? (
        <SectionMotion index={1} className="mt-6">
          <div className="ivy-card !p-0">
            <EmptyState
              icon={GraduationCap}
              title="No applications yet"
              description={
                isConsultantDossier
                  ? 'This student has no university journey seeded yet.'
                  : isGuardianView
                    ? 'No university journey is linked for this student yet.'
                    : 'When a university journey is ready, progress will appear here.'
              }
            >
              <TapButton
                onClick={() => navigate(appsPath, withFrom(pathname))}
                className="btn-outline rounded-xl px-5 text-sm font-medium"
              >
                Open applications
              </TapButton>
            </EmptyState>
          </div>
        </SectionMotion>
      ) : null}

      {primary ? (
        <SectionMotion index={1} className="relative mt-6">
          <div
            className="hero-midnight relative overflow-hidden rounded-[1.125rem] border p-5 text-primary-foreground sm:p-6"
            style={{ borderColor: 'rgba(200, 150, 62, 0.28)' }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-4 opacity-[0.06]"
            >
              <CrestMark size={120} />
            </div>
            <div
              className="pointer-events-none absolute inset-[4px] rounded-[0.9rem]"
              style={{
                boxShadow:
                  'inset 0 0 0 1px color-mix(in oklab, #C8963E 28%, transparent)',
              }}
            />

            <div className="relative flex items-start gap-3.5 sm:items-center sm:gap-4">
              <ProgressRing done={ringDone} total={totalSteps} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-gold">
                  {isConsultantDossier ? 'Application progress' : 'Application journey'}
                </p>
                <h2 className="mt-1.5 font-sans text-base font-semibold leading-snug text-primary-foreground sm:text-lg">
                  <span className="line-clamp-2">{primary.university.name}</span>
                </h2>
                <p className="mt-1 line-clamp-2 text-[0.8125rem] font-medium leading-snug text-primary-foreground/65">
                  {primary.program.name}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {Array.from({ length: totalSteps }, (_, i) => {
                    const step = steps[i];
                    const status = step?.status ?? 'NOT_STARTED';
                    return (
                      <span
                        key={step?.id ?? i}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          stepDotClass(status),
                        )}
                        title={step?.label ?? `Step ${i + 1}`}
                      />
                    );
                  })}
                </div>
                <span className="mt-3 inline-flex max-w-full items-center rounded-full bg-gold-soft px-2.5 py-1 text-[0.6875rem] font-semibold leading-tight text-gold-ink">
                  <span className="truncate">
                    {chipStep}/{totalSteps} steps
                    {chipDue ? ` · Due ${chipDue}` : ''}
                  </span>
                </span>
              </div>
            </div>

            <TapButton
              onClick={() => navigate(appsPath, withFrom(pathname))}
              className="btn-metallic relative mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"
            >
              {isConsultantDossier
                ? 'Open applications'
                : 'Continue your journey'}
              <ArrowRight className="h-4 w-4 text-white" strokeWidth={1.5} />
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {attentionItems.length > 0 ? (
        <SectionMotion index={2} className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Needs attention
              <span className="ml-1.5 font-medium text-muted-foreground">
                ({attentionItems.length})
              </span>
            </p>
            {attentionItems.length > 2 ? (
              <button
                type="button"
                className="text-xs font-semibold text-gold-ink"
                onClick={() => setShowAllAttention((v) => !v)}
              >
                {showAllAttention
                  ? 'Show less'
                  : `View all (${attentionItems.length})`}
              </button>
            ) : null}
          </div>
          <ul className="overflow-hidden rounded-[1rem] border border-[#EBE8E0]/90 bg-card shadow-elev1">
            {(showAllAttention
              ? attentionItems
              : attentionItems.slice(0, 2)
            ).map((item, index, list) => (
              <li
                key={item.id}
                className={cn(
                  index < list.length - 1 && 'border-b border-[#EBE8E0]/80',
                )}
              >
                <button
                  type="button"
                  onClick={() => navigate(item.href, withFrom(pathname))}
                  className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      attentionToneClass(item.tone),
                    )}
                  >
                    {item.tone === 'danger' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : item.tone === 'success' ? (
                      <Phone className="h-3.5 w-3.5" />
                    ) : item.href.includes('payment') ||
                      item.href.includes('personal') ? (
                      <Wallet className="h-3.5 w-3.5" />
                    ) : item.tone === 'warning' ? (
                      <CalendarDays className="h-3.5 w-3.5" />
                    ) : item.tone === 'info' ? (
                      <MessageCircle className="h-3.5 w-3.5" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.cta}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </SectionMotion>
      ) : (
        <SectionMotion index={2} className="mt-5">
          <div className="flex items-center gap-2.5 rounded-[1rem] border border-success-border/40 bg-success-soft/50 px-3.5 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <p className="text-sm font-medium text-foreground">
              You&apos;re all caught up
            </p>
          </div>
        </SectionMotion>
      )}

      {deadlines.length > 0 ? (
        <SectionMotion index={3} className="mt-7">
          <p className="label-caps">Calendar</p>
          <h2 className="mb-3 font-sans text-lg font-semibold text-foreground">
            Upcoming deadlines
          </h2>
          <ul className="space-y-3">
            {deadlines.slice(0, 3).map((d) => {
              const left = daysUntil(d.date);
              return (
                <li key={`${d.applicationId}-${d.label}`}>
                  <button
                    type="button"
                    onClick={() => navigate(appsPath, withFrom(pathname))}
                    className="ivy-card flex w-full items-center gap-4 text-left"
                  >
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-gold-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_40%,transparent)]">
                      <span className="font-sans text-lg font-semibold leading-none text-foreground">
                        {formatDay(d.date)}
                      </span>
                      <span className="text-[0.625rem] font-semibold tracking-[0.08em] text-gold-ink">
                        {formatMonth(d.date)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {d.label} · {d.university}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {left == null
                          ? d.date
                          : left < 0
                            ? 'Passed'
                            : left === 0
                              ? 'Due today'
                              : `${left} days left`}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </SectionMotion>
      ) : null}

      {isConsultantDossier ? (
        <SectionMotion index={3} className="mt-6">
          <div className="ivy-card p-5">
            <p className="label-caps">Outreach</p>
            <p className="mt-1 font-sans text-lg font-semibold text-foreground">
              Contact {firstName}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Message or manage calls for this assigned student.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <TapButton
                aria-label="Message student"
                className="btn-metallic flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-sm"
                onClick={() => navigate(messagesPath, withFrom(pathname))}
              >
                <MessageCircle className="h-4 w-4" /> Message
              </TapButton>
              <TapButton
                aria-label="Student calls"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground"
                onClick={() => {
                  if (openLiveCall) {
                    navigate(
                      `/app/live-call/${openLiveCall.id}`,
                      withFrom(pathname),
                    );
                    return;
                  }
                  navigate(callsPath, withFrom(pathname));
                }}
              >
                <Phone className="h-4 w-4" /> Consultation calls
              </TapButton>
            </div>
          </div>
        </SectionMotion>
      ) : consultant ? (
        <SectionMotion index={3} className="mt-6">
          <div className="ivy-card flex items-center gap-3 p-5">
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold bg-[#0B1528] font-sans text-lg text-primary-foreground">
              {consultantInitial}
              <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success shadow-[0_0_6px_rgba(31,122,77,0.6)]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-lg font-semibold text-foreground">
                {consultant.fullName}
              </p>
              <p className="text-sm text-muted-foreground">
                {consultant.title ?? 'Admissions Consultant'}
              </p>
            </div>
            <TapButton
              aria-label="Message consultant"
              className="flex h-11 w-11 min-h-0 items-center justify-center rounded-full border border-[#DEC484] bg-[#FBF3DF] text-[#0F1E36] shadow-2xs"
              onClick={() => navigate(messagesPath, withFrom(pathname))}
            >
              <MessageCircle className="h-4 w-4" />
            </TapButton>
            <TapButton
              aria-label="Schedule a call"
              className="flex h-11 w-11 min-h-0 items-center justify-center rounded-full bg-[#0F1E36] text-[#FFFDF9] shadow-xs"
              onClick={() => {
                if (openLiveCall) {
                  navigate(
                    `/app/live-call/${openLiveCall.id}`,
                    withFrom(pathname),
                  );
                  return;
                }
                navigate(callsPath, {
                  state: { from: pathname, focus: 'call' },
                });
              }}
            >
              <Phone className="h-4 w-4" />
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {!isConsultantDossier && urgentPayment ? (
        <SectionMotion index={5} className="mt-6">
          <button
            type="button"
            onClick={() => navigate(paymentsPath, withFrom(pathname))}
            className="ivy-card flex w-full items-center gap-3 text-left !p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold-ink">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Fees & payments
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {urgentPayment.title} · review upcoming fees
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </SectionMotion>
      ) : null}

      <SectionMotion index={6} className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <p className="label-caps">Paperwork</p>
            <h2 className="font-sans text-lg font-semibold tracking-tight text-[#0F1E36]">
              Recent documents
            </h2>
          </div>
          <Link
            to={docsPath}
            {...withFrom(pathname)}
            className="inline-flex min-h-10 items-center text-sm font-semibold text-gold-ink"
          >
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {documents.slice(0, 4).map((d) => {
            const accent = docAccent(d.status);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(docsPath, withFrom(pathname))}
                className="ivy-card ivy-interactive flex min-h-16 w-full items-stretch gap-0 !p-0 text-left"
              >
                <span className={cn('w-1 shrink-0 rounded-l-[1.125rem]', accent.bar)} />
                <span className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden px-5 py-4">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      accent.tile,
                    )}
                  >
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1E2430]">
                      {d.title}
                    </span>
                    <span className="text-xs font-normal text-[#8B92A5]">
                      {fileMeta(d)}
                    </span>
                  </span>
                  <StatusBadge status={toDocStatus(d.status)} />
                </span>
              </button>
            );
          })}
          {documents.length === 0 ? (
            <div className="ivy-card !p-0">
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description={
                  isConsultantDossier
                    ? 'Waiting on the student to upload required files.'
                    : isGuardianView
                      ? 'Your linked student has not uploaded files yet.'
                      : 'Upload your first file to keep your application moving.'
                }
              >
                <TapButton
                  onClick={() => navigate(docsPath, withFrom(pathname))}
                  className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium"
                >
                  {isConsultantDossier || isGuardianView ? (
                    <>
                      <FileText className="h-4 w-4" strokeWidth={1.5} /> View
                      documents
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" strokeWidth={1.5} /> Go to
                      documents
                    </>
                  )}
                </TapButton>
              </EmptyState>
            </div>
          ) : null}
        </div>
      </SectionMotion>

    </div>
  );
}
