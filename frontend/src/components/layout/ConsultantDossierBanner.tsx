import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { BackLink } from '../ivy/BackLink';
import { fetchConsultantStudents } from '../../services/scholaraApi';

export function ConsultantDossierBanner({ studentId }: { studentId: string }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['consultant-students'],
    queryFn: fetchConsultantStudents,
    enabled: Boolean(user) && user.role === 'CONSULTANT',
    staleTime: 60_000,
  });

  const name = data?.find((s) => s.id === studentId)?.fullName;

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
        <BackLink
          to="/app"
          label="Back"
          className="mb-0 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="label-caps truncate">
            Consultant · Student file
          </p>
          <p className="editorial-title mt-0.5 truncate text-sm text-foreground">
            {name ?? 'Student'}
          </p>
        </div>
      </div>
    </div>
  );
}
