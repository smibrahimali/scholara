import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BottomTabBar } from '../components/layout/BottomTabBar';
import { ConsultantDossierBanner } from '../components/layout/ConsultantDossierBanner';
import { MobileWrapper } from '../components/layout/MobileWrapper';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

const FloatingChatbot = lazy(() =>
  import('../components/chat/FloatingChatbot').then((m) => ({
    default: m.FloatingChatbot,
  })),
);

function studentIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/\/app\/students\/([^/]+)/);
  return match?.[1];
}

/** Student `/app/messages` or consultant `/app/students/:id/messages`. */
function isMessagingPath(pathname: string): boolean {
  return (
    pathname === '/app/messages' ||
    /\/app\/students\/[^/]+\/messages\/?$/.test(pathname)
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const studentId = studentIdFromPath(pathname);
  const isLiveCall = pathname.includes('/live-call/');
  const isMessaging = isMessagingPath(pathname);
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
          'no-scrollbar relative flex-1 overflow-x-hidden',
          isMessaging ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
          isLiveCall
            ? 'pb-4'
            : isMessaging
              ? 'pb-[var(--chrome-bottom)]'
              : 'pb-[calc(var(--chrome-bottom)+1.5rem)]',
          showDossierChrome ? 'pt-0' : isMessaging ? 'pt-3' : 'pt-7',
        )}
      >
        {showDossierChrome && studentId ? (
          <ConsultantDossierBanner studentId={studentId} />
        ) : null}
        <div
          className={cn(
            isMessaging
              ? 'flex min-h-0 flex-1 flex-col px-0 pb-0'
              : 'px-5',
            showDossierChrome && !isMessaging && 'pt-5',
            !isLiveCall && !isMessaging && 'pb-8',
          )}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      {!isLiveCall && !isMessaging ? (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <FloatingChatbot studentId={studentId} />
          </Suspense>
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
