import { Outlet, useLocation } from 'react-router-dom';
import { FloatingChatbot } from '../components/chat/FloatingChatbot';
import { BottomTabBar } from '../components/layout/BottomTabBar';
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

  if (!user) return null;

  return (
    <MobileWrapper>
      <main
        className={cn(
          'no-scrollbar relative flex-1 overflow-y-auto px-5 pt-8',
          isLiveCall ? 'pb-4' : 'pb-40',
        )}
      >
        <Outlet />
      </main>
      {!isLiveCall ? <FloatingChatbot studentId={studentId} /> : null}
      {!isLiveCall ? <BottomTabBar /> : null}
    </MobileWrapper>
  );
}
