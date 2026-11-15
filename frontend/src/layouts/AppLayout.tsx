import { Outlet, useLocation } from 'react-router-dom';
import { FloatingChatbot } from '../components/chat/FloatingChatbot';
import { BottomTabBar } from '../components/layout/BottomTabBar';
import { ConsultantDossierBanner } from '../components/layout/ConsultantDossierBanner';
import { MobileWrapper } from '../components/layout/MobileWrapper';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

function studentIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/\/app\/students\/([^/]+)/);
  return match?.[1];
}

export function AppLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const studentId = studentIdFromPath(pathname);
  const isLiveCall = pathname.includes('/live-call/');
  const showDossierChrome =
    user?.role === 'CONSULTANT' && Boolean(studentId) && !isLiveCall;

  if (!user) return null;

  return (
    <MobileWrapper>
      <main
        className={cn(
          'no-scrollbar relative flex-1 overflow-x-hidden overflow-y-auto',
          isLiveCall ? 'pb-4' : 'pb-44',
          showDossierChrome ? 'pt-0' : 'pt-8',
        )}
      >
        {showDossierChrome && studentId ? (
          <ConsultantDossierBanner studentId={studentId} />
        ) : null}
        <div className={cn('px-5', showDossierChrome && 'pt-5')}>
          <Outlet />
        </div>
      </main>
      {!isLiveCall ? <FloatingChatbot studentId={studentId} /> : null}
      {!isLiveCall ? <BottomTabBar /> : null}
    </MobileWrapper>
  );
}
