import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  FileText,
  MessageCircle,
  Phone,
  Upload,
} from 'lucide-react';
import { CrestMark } from '../components/ivy/CrestMark';
import { HeraldicDivider } from '../components/ivy/HeraldicDivider';
import { ProgressRing } from '../components/ivy/ProgressRing';
import { SectionMotion } from '../components/ivy/SectionMotion';
import { StatusBadge, toDocStatus } from '../components/ivy/StatusBadge';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { fetchCalls, fetchDashboard } from '../services/scholaraApi';
import type { ApplicationStep, DocumentItem } from '../types/domain';

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
  if (status === 'COMPLETED') return 'bg-gold';
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
    <div className="space-y-4">
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
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', studentId ?? user?.id],
    queryFn: () => fetchDashboard(studentId),
  });
  const callsQuery = useQuery({
    queryKey: ['calls', studentId ?? 'self'],
    queryFn: () => fetchCalls(studentId),
    refetchInterval: 5000,
    enabled: Boolean(user),
  });

  const greeting = useMemo(() => greetingForNow(), []);
  const openLiveCall =
    callsQuery.data?.find((call) => !call.endedAt) ?? null;

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) {
    return (
      <p className="text-sm font-semibold text-destructive">
        Could not load dashboard.
      </p>
    );
  }

  const firstName =
    data.student.fullName.split(' ')[0] ?? data.student.fullName;
  const primary = data.applications[0];
  const steps = [...(primary?.steps ?? [])].sort(
    (a, b) => a.stepNumber - b.stepNumber,
  );
  const totalSteps = Math.max(steps.length, 12);
  const doneSteps = steps.filter((s) => s.status === 'COMPLETED').length;
  const currentStep = steps.find((s) => s.status === 'IN_PROGRESS');
  const ringDone = Math.max(doneSteps, currentStep ? currentStep.stepNumber : 0);

  const nextDeadline = data.deadlines[0];
  const days = nextDeadline ? daysUntil(nextDeadline.date) : null;
  const totalDocs = Math.max(data.documents.length, 1);
  const verifiedDocs = data.counts.verifiedDocuments;
  const messages = data.recentCallNotes.length;

  const alertDoc =
    data.documents.find((d) => d.status === 'NOT_UPLOADED') ??
    data.documents.find((d) => d.status === 'REJECTED');
  const hasUnread =
    data.counts.rejectedDocuments > 0 ||
    data.counts.pendingDocuments > 0 ||
    messages > 0;

  const docsPath = studentId
    ? `/app/students/${studentId}/documents`
    : '/app/documents';
  const appsPath = studentId
    ? `/app/students/${studentId}/applications`
    : '/app/applications';

  const consultant = data.student.consultant;
  const consultantInitial = consultant?.fullName?.[0] ?? 'C';
  const chipDue = nextDeadline ? formatShortDeadline(nextDeadline.date) : null;
  const chipStep = currentStep?.stepNumber ?? doneSteps + 1;
  const fileCode = officialFileCode(data.student.id);

  const daysLabel =
    days == null ? '—' : days <= 0 ? 'Due' : `${days} Days`;
  const daysSub =
    days != null && days > 21 ? 'Early Decision' : 'Priority window';

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-5 -right-5 -top-8 h-[280px] overflow-hidden"
      >
        <div className="ivy-ambient absolute inset-0" />
        <div className="absolute -right-8 top-0 opacity-[0.1]">
          <CrestMark size={200} />
        </div>
      </div>

      <SectionMotion index={0} className="relative mb-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CrestMark size={36} />
            <div>
              <p className="font-serif text-xl font-semibold leading-none text-foreground">
                Scholara
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Est. Admissions Office
              </p>
            </div>
          </div>
          <TapButton
            aria-label="Notifications"
            className="ivy-card relative flex w-12 items-center justify-center text-foreground"
          >
            <Bell className="h-5 w-5" />
            {hasUnread ? (
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_rgba(212,175,55,0.7)] ring-2 ring-card" />
            ) : null}
          </TapButton>
        </div>

        <p className="font-mono text-[10px] font-semibold tracking-[0.25em] text-gold-ink">
          OFFICIAL FILE · {fileCode}
        </p>
        <p className="label-caps mt-3">
          {data.readOnly ? 'Guardian view,' : greeting}
        </p>
        <h1 className="mt-1 font-serif text-[34px] font-semibold leading-none text-foreground">
          {firstName}
        </h1>
        <p className="mt-2 font-serif text-sm italic text-muted-foreground">
          “Education is the passport to the future.”
        </p>
        <HeraldicDivider className="mt-3" />
      </SectionMotion>

      {primary ? (
        <SectionMotion index={1} className="relative mt-6">
          <div
            className="hero-midnight relative overflow-hidden rounded-2xl border p-5 text-primary-foreground"
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
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  Your Application Journey
                </p>
                <h2 className="mt-1 font-serif text-lg font-semibold leading-snug">
                  {primary.university.name}
                </h2>
                <p className="mt-0.5 text-xs text-white/85">
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
                <span className="mt-3 inline-flex rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-gold-ink">
                  Step {chipStep}
                  {chipDue ? ` · Due ${chipDue}` : ''}
                </span>
              </div>
            </div>

            <TapButton
              onClick={() => navigate(appsPath)}
              className="btn-metallic shimmer-sweep relative mt-5 flex w-full items-center justify-center gap-2 rounded-xl"
            >
              Continue Your Journey <ArrowRight className="h-4 w-4" />
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {/* Metric ribbon */}
      <SectionMotion index={2} className="mt-4 grid grid-cols-3 gap-2">
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
            className="rounded-full border bg-card px-2 py-2.5 text-center"
            style={{
              borderColor: 'color-mix(in oklab, var(--gold) 45%, transparent)',
              boxShadow:
                '0 1px 0 0 rgba(255,255,255,0.85) inset, 0 6px 14px -8px rgba(20,28,45,0.08)',
            }}
          >
            <p className="font-serif text-sm font-semibold leading-tight text-foreground">
              {pill.value}
            </p>
            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-gold-ink">
              {pill.label}
            </p>
          </div>
        ))}
      </SectionMotion>

      {openLiveCall && !studentId ? (
        <SectionMotion index={2} className="mt-5">
          <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
            <p className="font-semibold text-foreground">Live call waiting</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your consultant is on a call. Join to speak — transcription runs
              automatically.
            </p>
            <TapButton
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
              onClick={() => navigate(`/app/live-call/${openLiveCall.id}`)}
            >
              <Phone className="h-4 w-4" /> Join live call
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {consultant ? (
        <SectionMotion index={3} className="mt-5">
          <div className="ivy-card flex items-center gap-3 p-4">
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold bg-[#0B1528] font-serif text-lg text-primary-foreground">
              {consultantInitial}
              <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success shadow-[0_0_6px_rgba(31,122,77,0.6)]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-lg font-semibold text-foreground">
                {consultant.fullName}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {consultant.title ?? 'Admissions Consultant'}
              </p>
            </div>
            <TapButton
              aria-label="Message consultant"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-gold-ink shadow-[inset_0_0_0_1px_rgba(120,53,15,0.12)]"
              onClick={() =>
                navigate(
                  studentId
                    ? `/app/students/${studentId}/calls`
                    : '/app/consultant',
                )
              }
            >
              <MessageCircle className="h-4 w-4" />
            </TapButton>
            <TapButton
              aria-label="Call consultant"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-gold-ink shadow-[inset_0_0_0_1px_rgba(120,53,15,0.12)]"
              onClick={() => {
                if (openLiveCall && !studentId) {
                  navigate(`/app/live-call/${openLiveCall.id}`);
                  return;
                }
                navigate(
                  studentId
                    ? `/app/students/${studentId}/calls`
                    : '/app/consultant',
                );
              }}
            >
              <Phone className="h-4 w-4" />
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      {alertDoc ? (
        <SectionMotion index={4} className="mt-5">
          <div
            className="rounded-2xl bg-warning-soft p-4"
            style={{
              border:
                '1px solid color-mix(in oklab, var(--warning) 35%, transparent)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.7) inset',
            }}
          >
            <p className="text-sm font-semibold text-foreground">
              {alertDoc.status === 'REJECTED'
                ? `${alertDoc.title} was rejected — re-upload to keep your application moving`
                : `${alertDoc.title} is missing — upload to keep your application moving`}
            </p>
            <TapButton
              onClick={() => navigate(docsPath)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1528] text-sm font-semibold text-primary-foreground"
            >
              <Upload className="h-4 w-4" /> Upload
            </TapButton>
          </div>
        </SectionMotion>
      ) : null}

      <SectionMotion index={5} className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <p className="label-caps">Paperwork</p>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              Recent Documents
            </h2>
          </div>
          <Link
            to={docsPath}
            className="inline-flex min-h-10 items-center text-sm font-bold text-gold-ink"
          >
            View all
          </Link>
        </div>
        <div className="ivy-card overflow-hidden">
          {data.documents.slice(0, 4).map((d, i) => {
            const accent = docAccent(d.status);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(docsPath)}
                className={cn(
                  'flex min-h-16 w-full items-stretch gap-0 text-left transition-all',
                  'active:bg-secondary active:shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]',
                  i > 0 && 'border-t border-black/[0.06]',
                )}
              >
                <span className={cn('w-1 shrink-0', accent.bar)} />
                <span className="flex flex-1 items-center gap-3 px-3 py-3">
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]',
                      accent.tile,
                    )}
                  >
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {d.title}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {fileMeta(d)}
                    </span>
                  </span>
                  <StatusBadge status={toDocStatus(d.status)} />
                </span>
              </button>
            );
          })}
          {data.documents.length === 0 ? (
            <p className="px-4 py-6 text-sm font-semibold text-muted-foreground">
              No documents yet.
            </p>
          ) : null}
        </div>
      </SectionMotion>

      {data.deadlines.length > 0 ? (
        <SectionMotion index={6} className="mt-8 pb-2">
          <p className="label-caps">Calendar</p>
          <h2 className="mb-3 font-serif text-xl font-semibold text-foreground">
            Upcoming deadlines
          </h2>
          <ul className="space-y-2">
            {data.deadlines.slice(0, 3).map((d) => {
              const left = daysUntil(d.date);
              return (
                <li
                  key={`${d.applicationId}-${d.label}`}
                  className="ivy-card flex items-center gap-3 px-3 py-3"
                >
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-gold-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_40%,transparent)]">
                    <span className="font-serif text-lg font-semibold leading-none text-foreground">
                      {formatDay(d.date)}
                    </span>
                    <span className="text-[9px] font-bold tracking-[0.12em] text-gold-ink">
                      {formatMonth(d.date)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {d.label} · {d.university}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
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
