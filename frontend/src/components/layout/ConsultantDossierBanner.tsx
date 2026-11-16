import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchDashboard } from '../../services/scholaraApi';

export function ConsultantDossierBanner({ studentId }: { studentId: string }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['dashboard', studentId],
    queryFn: () => fetchDashboard(studentId),
    enabled: Boolean(user) && user.role === 'CONSULTANT',
    staleTime: 60_000,
  });

  const name = data?.student?.fullName;

  return (
    <div
      className="w-full border-b px-5 py-2.5"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in oklab, var(--card) 92%, #0B1528) 0%, var(--card) 100%)',
        borderColor: 'rgba(120, 53, 15, 0.12)',
        boxShadow: '0 8px 20px -16px rgba(11, 21, 40, 0.35)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/app"
          className="ivy-medallion inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full no-underline"
          aria-label="Back to assigned students"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-gold-ink">
            Consultant · Viewing dossier
          </p>
          <p className="truncate font-serif text-sm font-semibold text-foreground">
            {name ?? 'Student file'}
          </p>
        </div>
      </div>
    </div>
  );
}
