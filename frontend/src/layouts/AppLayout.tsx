import { Outlet } from 'react-router-dom';
import { BottomTabBar } from '../components/layout/BottomTabBar';
import { MobileWrapper } from '../components/layout/MobileWrapper';
import { useAuth } from '../context/AuthContext';

export function AppLayout() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <MobileWrapper>
      <main className="no-scrollbar flex-1 overflow-y-auto px-5 pb-28 pt-8">
        <Outlet />
      </main>
      <BottomTabBar />
    </MobileWrapper>
  );
}
