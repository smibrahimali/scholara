import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const rows = [
    { icon: User, label: 'Personal Information' },
    { icon: Mail, label: 'Applied Email Log' },
    { icon: Phone, label: 'My Consultant' },
    { icon: ShieldCheck, label: 'Privacy & Security' },
  ];

  return (
    <PageMotion>
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
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold bg-primary font-serif text-2xl text-primary-foreground">
          {user.fullName[0]}
        </span>
        <div>
          <p className="font-serif text-xl font-semibold">{user.fullName}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="label-caps mt-1">{user.role}</p>
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((r, i) => (
          <button
            key={r.label}
            type="button"
            className={cn(
              'flex min-h-14 w-full items-center gap-3 px-4 text-left',
              i > 0 && 'border-t border-border',
            )}
          >
            <r.icon className="h-5 w-5 text-gold-ink" />
            <span className="flex-1 text-sm font-semibold">{r.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      <TapButton
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 text-sm font-semibold text-destructive"
        onClick={() => {
          logout();
          navigate('/login');
        }}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </TapButton>
    </PageMotion>
  );
}
