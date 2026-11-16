import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
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

  // Never paint an empty phone shell when auth is cleared mid-session.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MobileWrapper>
      <AppScrollReset pathname={pathname} />
      <main
        id="scholara-main"
        className={cn(
          'no-scrollbar relative flex-1 overflow-x-hidden overflow-y-auto',
          isLiveCall ? 'pb-4' : 'pb-40',
          showDossierChrome ? 'pt-0' : 'pt-8',
        )}
      >
        {showDossierChrome && studentId ? (
          <ConsultantDossierBanner studentId={studentId} />
        ) : null}
        <div
          className={cn(
            'px-5',
            showDossierChrome && 'pt-5',
            !isLiveCall && 'pb-12',
          )}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      {!isLiveCall ? (
        <ErrorBoundary fallback={null}>
          <FloatingChatbot studentId={studentId} />
        </ErrorBoundary>
      ) : null}
      {!isLiveCall ? <BottomTabBar /> : null}
    </MobileWrapper>
  );
}

/** Reset scroll on route change so restored scroll doesn't look like a blank page. */
function AppScrollReset({ pathname }: { pathname: string }) {
  useEffect(() => {
    const main = document.getElementById('scholara-main');
    if (main) main.scrollTop = 0;
  }, [pathname]);
  return null;
}
