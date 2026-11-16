import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { withFrom } from '../lib/navigation';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!user) return null;

  const rows = [
    {
      icon: User,
      label: 'Personal Information',
      subtitle: 'Academic record & guardian details',
      onClick: () =>
        toast.message('Demo profile', {
          description: `${user.fullName} · ${user.email}`,
        }),
    },
    ...(user.role === 'CONSULTANT'
      ? []
      : [
          {
            icon: Mail,
            label: 'Applied Email Log',
            subtitle: 'University admissions correspondence',
            onClick: () => navigate('/app/emails', withFrom(pathname)),
          },
          {
            icon: Phone,
            label: 'My Consultant',
            subtitle: 'Direct line & 1:1 session booking',
            onClick: () => navigate('/app/consultant', withFrom(pathname)),
          },
        ]),
  ];

  return (
    <PageMotion className="pb-32">
      <ScreenTitle
        eyebrow={
          user.role === 'CONSULTANT'
            ? 'Consultant Account'
            : user.role === 'GUARDIAN'
              ? 'Guardian Account'
              : 'Student Account'
        }
        title="Profile"
      />
      <div className="flex items-center gap-4 rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9] p-4 shadow-[0_6px_20px_-6px_rgba(15,30,54,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold bg-primary font-serif text-2xl text-primary-foreground">
          {user.fullName[0]}
        </span>
        <div>
          <p className="font-serif text-xl font-semibold text-[#111E33]">
            {user.fullName}
          </p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="label-caps mt-1">{user.role}</p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-[#EDE5D5] overflow-hidden rounded-2xl border border-[#DFD4BE] bg-[#FFFDF9]">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={r.onClick}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5CE96] bg-[#FBF3DF] text-[#8A6212]">
              <r.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#111E33]">
                {r.label}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {r.subtitle}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
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
