import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { withFrom } from '../lib/navigation';

type HubRow = {
  icon: typeof User;
  label: string;
  subtitle: string;
  onClick: () => void;
};

function HubGroup({
  title,
  rows,
}: {
  title: string;
  rows: HubRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-5">
      <p className="label-caps mb-2 px-1">{title}</p>
      <div className="divide-y divide-[#EBE8E0] overflow-hidden rounded-[1.125rem] border border-[#EBE8E0]/90 bg-card shadow-elev1">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={r.onClick}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold-soft text-gold-ink">
              <r.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#1E2430]">
                {r.label}
              </span>
              <span className="mt-0.5 block truncate text-xs leading-snug text-muted-foreground">
                {r.subtitle}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!user) return null;

  const isConsultant = user.role === 'CONSULTANT';
  const isGuardian = user.role === 'GUARDIAN';

  const communication: HubRow[] = isConsultant
    ? []
    : [
        {
          icon: MessageCircle,
          label: 'Messages',
          subtitle: isGuardian
            ? 'View private chat with the consultant'
            : 'Private chat with your consultant',
          onClick: () => navigate('/app/messages', withFrom(pathname)),
        },
        {
          icon: Mail,
          label: 'Consultant emails',
          subtitle: 'Admissions correspondence by university',
          onClick: () => navigate('/app/emails', withFrom(pathname)),
        },
        {
          icon: Phone,
          label: 'Consultation calls',
          subtitle: isGuardian
            ? 'View scheduled sessions and call history'
            : 'Request a 1:1 audio session or view history',
          onClick: () => navigate('/app/consultant', withFrom(pathname)),
        },
      ];

  const account: HubRow[] = [
    {
      icon: User,
      label: 'Personal information',
      subtitle: isConsultant
        ? 'Account details'
        : 'Profile, applications overview, and fees & payments',
      onClick: () => navigate('/app/profile/personal', withFrom(pathname)),
    },
  ];

  return (
    <PageMotion className="pb-32">
      <ScreenTitle
        eyebrow={
          isConsultant
            ? 'Consultant account'
            : isGuardian
              ? 'Guardian'
              : 'Account & support'
        }
        title={isConsultant ? 'Account' : 'More'}
      />
      <div className="flex items-center gap-4 rounded-[1.125rem] border border-[#EBE8E0]/90 bg-card p-4 shadow-elev1">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/60 bg-primary font-serif text-xl font-semibold text-primary-foreground">
          {user.fullName[0]}
        </span>
        <div className="min-w-0">
          <p className="editorial-title truncate text-xl text-[#1E2430]">
            {user.fullName}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {user.email}
          </p>
          <p className="label-caps mt-1.5">{user.role}</p>
        </div>
      </div>

      <HubGroup title="Communication" rows={communication} />
      <HubGroup title="Account" rows={account} />

      <div className="mt-6 flex justify-center">
        <TapButton
          className="rounded-xl border border-[#EBC3C3] bg-[#FCEEEE]/60 px-5 py-2.5 text-xs font-semibold text-[#9E2A2B] hover:bg-[#FCEEEE]"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <span className="inline-flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </span>
        </TapButton>
      </div>
    </PageMotion>
  );
}
