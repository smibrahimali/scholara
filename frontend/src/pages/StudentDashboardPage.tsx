import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  FileText,
  GraduationCap,
  MessageCircle,
  Phone,
  Upload,
} from 'lucide-react';
import { CrestMark } from '../components/ivy/CrestMark';
import { EmptyState } from '../components/ivy/EmptyState';
import { HeraldicDivider } from '../components/ivy/HeraldicDivider';
import { ProgressRing } from '../components/ivy/ProgressRing';
import { SectionMotion } from '../components/ivy/SectionMotion';
import { StatusBadge, toDocStatus } from '../components/ivy/StatusBadge';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { withFrom } from '../lib/navigation';
import { fetchCalls, fetchDashboard } from '../services/scholaraApi';
import { fetchOpenChatSession } from '../services/messagingApi';
import type { ApplicationStep, DocumentItem } from '../types/domain';

type DemoNotification = {
  id: string;
  title: string;
  detail: string;
  tone: 'danger' | 'gold' | 'navy';
  href: string;
};

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
      return { bar: 'bg-success', tile: 'bg-[#0B1528] text-gold' };
    case 'UNDER_REVIEW':
      return { bar: 'bg-gold', tile: 'bg-[#0B1528] text-gold' };
    case 'REJECTED':
      return { bar: 'bg-destructive', tile: 'bg-[#0B1528] text-destructive-soft' };
    default:
      return { bar: 'bg-muted-foreground/35', tile: 'bg-[#0B1528] text-gold/70' };
  }
}

function fileMeta(doc: DocumentItem) {
  const type = (doc.documentType || 'PDF').toUpperCase();
  const statusLabel =
    doc.status === 'VERIFIED'
      ? 'Verified'
      : doc.status === 'UNDER_REVIEW'
        ? 'In review'
        : doc.status === 'REJECTED'
          ? 'Needs fix'
          : 'Missing';
  return `${type} · file · ${statusLabel}`;
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
  const isConsultantDossier =
    Boolean(studentId) && user?.role === 'CONSULTANT';
  // Consultants must never hit self-scoped student APIs (403 without studentId).
  const studentScopeEnabled =
    Boolean(user) &&
    (user?.role !== 'CONSULTANT' || Boolean(studentId));

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', studentId ?? user?.id],
    queryFn: () => fetchDashboard(studentId),
    enabled: studentScopeEnabled,
    retry: false,
  });
  const callsQuery = useQuery({
    queryKey: ['calls', studentId ?? 'self'],
    queryFn: () => fetchCalls(studentId),
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : 5000,
    enabled: studentScopeEnabled,
    retry: false,
  });

  const openChatQuery = useQuery({
    queryKey: ['chat-session-open', studentId ?? 'self'],
    queryFn: () => fetchOpenChatSession(studentId),
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : 5000,
    enabled: studentScopeEnabled,
    retry: false,
  });

  const greeting = useMemo(() => greetingForNow(), []);
  const openLiveCall =
    callsQuery.data?.find((call) => !call.endedAt) ?? null;
  const openChat = openChatQuery.data ?? null;

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

  const notifications = useMemo(() => {
    if (!data) return [] as DemoNotification[];
    const items: DemoNotification[] = [];
    const documents = data.documents ?? [];
    const deadlines = data.deadlines ?? [];
    const recentCallNotes = data.recentCallNotes ?? [];
    for (const doc of documents) {
      if (doc.status === 'REJECTED') {
        items.push({
          id: `rej-${doc.id}`,
          title: `${doc.title} rejected`,
          detail: isConsultantDossier
            ? (doc.rejectionReason ??
              'Student needs to re-upload a corrected file.')
            : (doc.rejectionReason ?? 'Please re-upload a corrected file.'),
          tone: 'danger',
          href: docsPath,
        });
      } else if (doc.status === 'NOT_UPLOADED') {
        items.push({
          id: `miss-${doc.id}`,
          title: `${doc.title} missing`,
          detail: isConsultantDossier
            ? 'Waiting on the student to upload this document.'
            : 'Upload this document to keep your application moving.',
          tone: 'gold',
          href: docsPath,
        });
      } else if (doc.status === 'UNDER_REVIEW') {
        items.push({
          id: `rev-${doc.id}`,
          title: `${doc.title} under review`,
          detail: isConsultantDossier
            ? 'Ready for your verification.'
            : 'Waiting on consultant verification.',
          tone: 'navy',
          href: docsPath,
        });
      }
    }
    for (const d of deadlines.slice(0, 3)) {
      const left = daysUntil(d.date);
      items.push({
        id: `due-${d.applicationId}-${d.label}`,
        title: `${d.label} · ${d.university}`,
        detail:
          left == null
            ? d.date
            : left < 0
              ? 'Passed'
              : left === 0
                ? 'Due today'
                : `${left} days left`,
        tone: 'gold',
        href: appsPath,
      });
    }
    if (openLiveCall) {
      items.unshift({
        id: `live-${openLiveCall.id}`,
        title: 'Live consultation in progress',
        detail: isConsultantDossier
          ? 'Open the live call room for this student.'
          : 'Open Calls to follow the transcript.',
        tone: 'navy',
        href: isConsultantDossier
          ? `/app/live-call/${openLiveCall.id}`
          : '/app/calls',
      });
    }
    if (openChat) {
      items.unshift({
        id: `chat-${openChat.id}`,
        title: 'Encrypted chat in progress',
        detail: isConsultantDossier
          ? 'Open the ephemeral chat room for this student.'
          : 'Join the private chat with your consultant.',
        tone: 'gold',
        href: messagesPath,
      });
    }
    for (const note of recentCallNotes.slice(0, 2)) {
      items.push({
        id: `note-${note.id}`,
        title: 'New consultation note',
        detail: note.summary || note.followUps || 'Review the latest call summary.',
        tone: 'navy',
        href: callsPath,
      });
    }
    return items.slice(0, 8);
  }, [
    appsPath,
    callsPath,
    data,
    docsPath,
    isConsultantDossier,
    messagesPath,
    openChat,
    openLiveCall,
  ]);

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
  const days = nextDeadline ? daysUntil(nextDeadline.date) : null;
  const totalDocs = Math.max(documents.length, 1);
  const verifiedDocs = data.counts?.verifiedDocuments ?? 0;
  const alertDoc =
    documents.find((d) => d.status === 'NOT_UPLOADED') ??
    documents.find((d) => d.status === 'REJECTED');
  const hasUnread =
    (data.counts?.rejectedDocuments ?? 0) > 0 ||
    (data.counts?.pendingDocuments ?? 0) > 0;
  const isGuardianView = Boolean(data.readOnly) && !isConsultantDossier;

  const consultant = data.student?.consultant;
  const consultantInitial = consultant?.fullName?.[0] ?? 'C';
  const chipDue = nextDeadline ? formatShortDeadline(nextDeadline.date) : null;
  const fileCode = officialFileCode(data.student?.id ?? 'unknown');

  const daysLabel =
    days == null ? '—' : days <= 0 ? 'Due' : `${days} Days`;
  const daysSub =
    days != null && days > 21 ? 'Early Decision' : 'Priority window';

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-5 -right-5 -top-6 h-[280px] overflow-hidden"
      >
        <div className="ivy-ambient absolute inset-0" />
        <div className="absolute -right-8 top-0 opacity-[0.1]">
          <CrestMark size={200} />
        </div>
      </div>

      <SectionMotion index={0} className="relative mb-6">
        <div className="relative mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CrestMark size={36} />
            <div>
              <p className="font-sans text-xl font-semibold leading-none text-foreground">
                Scholara
              </p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Est. Admissions Office
              </p>
            </div>
          </div>
          {!isConsultantDossier ? (
            <div className="relative">
              <TapButton
                aria-label="Notifications"
                aria-expanded={notifOpen}
                className="relative flex h-11 w-11 min-h-0 items-center justify-center rounded-2xl border border-[#EBE8E0]/80 bg-white text-[#1E2430] shadow-[0_2px_8px_-2px_rgba(27,33,44,0.04),0_8px_24px_-4px_rgba(27,33,44,0.02)]"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell className="h-5 w-5 text-[#1E2430]" strokeWidth={1.5} />
                {hasUnread || notifications.length > 0 ? (
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border border-white bg-[#C8963E]" />
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
                                  navigate(n.href);
                                }}
                              >
                                <span
                                  className={cn(
                                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                                    n.tone === 'danger' &&
                                      'bg-destructive-soft text-destructive',
                                    n.tone === 'gold' &&
                                      'bg-gold-soft text-gold-ink',
                                    n.tone === 'navy' &&
                                      'bg-[#0B1528] text-gold',
                                  )}
                                >
                                  {n.tone === 'danger' ? (
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  ) : n.tone === 'gold' ? (
                                    <CalendarDays className="h-3.5 w-3.5" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-foreground">
                                    {n.title}
                                  </span>
                                  <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
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
                            to={docsPath}
                            onClick={() => setNotifOpen(false)}
                            className="inline-flex min-h-10 items-center text-xs font-semibold text-gold-ink"
                          >
                            Open documents →
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

        <p className="font-mono text-[10px] font-semibold tracking-[0.25em] text-gold-ink">
          OFFICIAL FILE · {fileCode}
        </p>
        <p className="label-caps mt-3">
          {isConsultantDossier
            ? 'Student dossier,'
            : data.readOnly
              ? 'Guardian view,'
              : greeting}
        </p>
        <h1 className="mt-1 font-serif text-[34px] font-semibold leading-none text-[#1E2430]">
          {isConsultantDossier ? studentName : firstName}
        </h1>
        <p className="mt-2 font-sans text-sm italic text-muted-foreground">
          {isConsultantDossier
            ? 'Assigned file — review progress, documents, and outreach.'
            : '“Education is the passport to the future.”'}
        </p>
        <HeraldicDivider className="mt-4" />
      </SectionMotion>

      {!primary ? (
        <SectionMotion index={1} className="mt-8">
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
                onClick={() => navigate(appsPath)}
                className="btn-outline rounded-xl px-5 text-sm font-medium"
              >
                Open applications
              </TapButton>
            </EmptyState>
          </div>
        </SectionMotion>
      ) : null}

      {primary ? (
        <SectionMotion index={1} className="relative mt-8">
          <div
            className="hero-midnight relative overflow-hidden rounded-2xl border p-6 text-primary-foreground"
            style={{ borderColor: 'rgba(251, 191, 36, 0.3)' }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-2 opacity-10"
            >
              <CrestMark size={140} />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 8px)',
              }}
            />
            <div
              className="pointer-events-none absolute inset-[5px] rounded-[12px]"
              style={{
                boxShadow:
                  'inset 0 0 0 1px color-mix(in oklab, #FBBF24 40%, transparent)',
              }}
            />

            <div className="relative flex items-center gap-4">
              <ProgressRing done={ringDone} total={totalSteps} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  {isConsultantDossier
                    ? 'Application progress'
                    : 'Your Application Journey'}
                </p>
                <h2 className="mt-1 truncate font-sans text-lg font-semibold leading-snug text-primary-foreground">
                  {primary.university.name}
                </h2>
                <p className="mt-1 text-xs font-medium text-primary-foreground/65">
                  {primary.program.name}
                </p>
                <div className="mt-3 flex flex-wrap gap-[5px]">
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
                <span className="mt-3 inline-flex rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-semibold text-gold-ink">
                  {chipStep}/{totalSteps} STEPS
                  {chipDue ? ` · Due ${chipDue}` : ''}
                </span>
              </div>
            </div>

            <TapButton
              onClick={() => navigate(appsPath)}
              className="btn-metallic shimmer-sweep relative mt-5 flex w-full items-center justify-center gap-2 rounded-xl text-white"
            >
              {isConsultantDossier
                ? 'Open applications'
                : 'Continue Your Journey'}{' '}
              <ArrowRight className="h-4 w-4 text-white" strokeWidth={1.5} />
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {/* Metric ribbon */}
      <SectionMotion index={2} className="mt-8 grid grid-cols-3 gap-3">
        {[
          { value: daysLabel, label: daysSub },
          { value: 'Competitive', label: 'Counselor Vetted' },
          {
            value: `${verifiedDocs} of ${totalDocs}`,
            label: 'Docs Completed',
          },
        ].map((pill) => (
          <div
            key={pill.label}
            className="relative min-w-0 rounded-2xl border border-[#EBE8E0]/80 bg-white px-2.5 py-3 text-center shadow-elev1 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-elev2"
          >
            <span
              className="absolute inset-x-0 top-0 h-[2px] bg-[#C8963E]/80"
              aria-hidden
            />
            <p className="font-sans text-sm font-semibold leading-tight text-[#1E2430]">
              {pill.value}
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase leading-snug tracking-[0.06em] text-[#6B7280]">
              {pill.label}
            </p>
          </div>
        ))}
      </SectionMotion>

      {openLiveCall && !isConsultantDossier ? (
        <SectionMotion index={2} className="mt-6">
          <div className="status-success rounded-2xl p-5">
            <p className="font-semibold text-foreground">Live call waiting</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your consultant is on a call. Join to speak — transcription runs
              automatically.
            </p>
            <TapButton
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
              onClick={() =>
                navigate(
                  `/app/live-call/${openLiveCall.id}`,
                  withFrom(pathname),
                )
              }
            >
              <Phone className="h-4 w-4" /> Join live call
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {openChat && !isConsultantDossier ? (
        <SectionMotion index={2} className="mt-6">
          <div className="rounded-2xl border border-gold/35 bg-gold-soft/50 p-5">
            <p className="font-semibold text-foreground">Encrypted chat waiting</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your consultant opened a private room. Messages clear when the
              chat ends.
            </p>
            <TapButton
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
              onClick={() => navigate(messagesPath, withFrom(pathname))}
            >
              <MessageCircle className="h-4 w-4" /> Join encrypted chat
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {openLiveCall && isConsultantDossier ? (
        <SectionMotion index={2} className="mt-6">
          <div className="status-success rounded-2xl p-5">
            <p className="font-semibold text-foreground">Live call open</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A consultation room is open for this student.
            </p>
            <TapButton
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
              onClick={() =>
                navigate(
                  `/app/live-call/${openLiveCall.id}`,
                  withFrom(pathname),
                )
              }
            >
              <Phone className="h-4 w-4" /> Open live call
            </TapButton>
          </div>
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
                <Phone className="h-4 w-4" /> Calls
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
              onClick={() =>
                navigate(callsPath, { state: { from: pathname, focus: 'chat' } })
              }
            >
              <MessageCircle className="h-4 w-4" />
            </TapButton>
            <TapButton
              aria-label="Call consultant"
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

      {!alertDoc &&
      documents.length > 0 &&
      verifiedDocs === documents.length ? (
        <SectionMotion index={4} className="mt-6">
          <div className="status-success rounded-2xl px-4 py-3.5">
            <p className="text-sm font-semibold">
              All {documents.length} documents verified by consultant
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {isGuardianView
                ? 'No uploads needed — paperwork is complete for this dossier.'
                : isConsultantDossier
                  ? 'No pending document reviews for this student.'
                  : 'Paperwork looks complete — focus on applications and deadlines next.'}
            </p>
          </div>
        </SectionMotion>
      ) : null}

      {alertDoc ? (
        <SectionMotion index={4} className="mt-6">
          <div
            className="rounded-2xl bg-warning-soft p-5"
            style={{
              border:
                '1px solid color-mix(in oklab, var(--warning) 35%, transparent)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.7) inset',
            }}
          >
            <p className="text-sm font-semibold leading-snug text-foreground">
              {isConsultantDossier
                ? alertDoc.status === 'REJECTED'
                  ? `${alertDoc.title} was rejected — student must re-upload`
                  : `${alertDoc.title} is missing — waiting on student upload`
                : isGuardianView
                  ? alertDoc.status === 'REJECTED'
                    ? `${alertDoc.title} was rejected — waiting on student re-upload`
                    : `${alertDoc.title} is still missing — waiting on student upload`
                  : alertDoc.status === 'REJECTED'
                    ? `${alertDoc.title} was rejected — re-upload to keep your application moving`
                    : `${alertDoc.title} is missing — upload to keep your application moving`}
            </p>
            <TapButton
              onClick={() => navigate(docsPath)}
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              {isConsultantDossier || isGuardianView ? (
                <>
                  <FileText className="h-4 w-4" /> Review documents
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload
                </>
              )}
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      <SectionMotion index={5} className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <p className="label-caps">Paperwork</p>
            <h2 className="font-sans text-xl font-semibold tracking-tight text-[#0F1E36]">
              Recent Documents
            </h2>
          </div>
          <Link
            to={docsPath}
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
                onClick={() => navigate(docsPath)}
                className="ivy-card ivy-interactive flex min-h-16 w-full items-stretch gap-0 !p-0 text-left"
              >
                <span className={cn('w-1 shrink-0 rounded-l-[1.125rem]', accent.bar)} />
                <span className="flex flex-1 items-center gap-3 px-5 py-4">
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
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
                  onClick={() => navigate(docsPath)}
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

      {deadlines.length > 0 ? (
        <SectionMotion index={6} className="mt-8 pb-2">
          <p className="label-caps">Calendar</p>
          <h2 className="mb-4 font-sans text-xl font-semibold text-foreground">
            Upcoming deadlines
          </h2>
          <ul className="space-y-4">
            {deadlines.slice(0, 3).map((d) => {
              const left = daysUntil(d.date);
              return (
                <li
                  key={`${d.applicationId}-${d.label}`}
                  className="ivy-card flex items-center gap-4"
                >
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-gold-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_40%,transparent)]">
                    <span className="font-sans text-lg font-semibold leading-none text-foreground">
                      {formatDay(d.date)}
                    </span>
                    <span className="text-[9px] font-semibold tracking-[0.12em] text-gold-ink">
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
                </li>
              );
            })}
          </ul>
        </SectionMotion>
      ) : null}
    </div>
  );
}
