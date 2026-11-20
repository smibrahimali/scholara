import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  GraduationCap,
  Home,
  MoreHorizontal,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

type Tab = {
  to: string;
  end?: boolean;
  label: string;
  Icon: LucideIcon;
};

const STUDENT_TABS: Tab[] = [
  { to: '/app', end: true, label: 'Home', Icon: Home },
  { to: '/app/applications', label: 'Applications', Icon: GraduationCap },
  { to: '/app/documents', label: 'Documents', Icon: FileText },
  { to: '/app/profile', label: 'More', Icon: MoreHorizontal },
];

const CONSULTANT_TABS: Tab[] = [
  { to: '/app', end: true, label: 'Home', Icon: Home },
  { to: '/app/profile', label: 'Account', Icon: User },
];

/** Secondary hub destinations under More (student/guardian). */
function isMoreHubPath(pathname: string) {
  return (
    pathname === '/app/profile' ||
    pathname.startsWith('/app/profile/') ||
    pathname.startsWith('/app/consultant') ||
    pathname.startsWith('/app/emails') ||
    pathname.startsWith('/app/messages')
  );
}

function isTabActive(tab: Tab, pathname: string, role?: string) {
  if (tab.to === '/app/profile') {
    if (role === 'CONSULTANT') {
      return pathname === '/app/profile' || pathname.startsWith('/app/profile/');
    }
    return isMoreHubPath(pathname);
  }
  if (tab.end) {
    return pathname === tab.to;
  }
  return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

export function BottomTabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const tabs = user?.role === 'CONSULTANT' ? CONSULTANT_TABS : STUDENT_TABS;

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-phone -translate-x-1/2 border-t border-[#E8E2D6] bg-[#F9F8F6]/97 px-1.5 pt-1 backdrop-blur-[8px] shadow-[0_-6px_20px_-16px_rgba(15,30,54,0.18)]"
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <ul
        className={cn(
          'grid',
          tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-4',
        )}
      >
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname, user?.role);
          return (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={cn(
                  'relative flex min-h-12 w-full flex-col items-center justify-center gap-0.5 overflow-visible px-0.5 no-underline',
                  'rounded-lg transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/45 focus-visible:ring-offset-2',
                )}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.label}
              >
                <motion.span
                  animate={{ y: active ? -1 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-1"
                >
                  <tab.Icon
                    className={cn(
                      'h-[1.1rem] w-[1.1rem] transition-colors duration-200',
                      active ? 'text-[#0F1E36]' : 'text-[#8B92A5]',
                    )}
                    strokeWidth={active ? 1.85 : 1.5}
                    aria-hidden
                  />
                  {active ? (
                    <motion.span
                      layoutId="tab-dot"
                      className="h-0.5 w-3.5 rounded-full bg-[#C8963E]"
                    />
                  ) : (
                    <span className="h-0.5 w-3.5" aria-hidden />
                  )}
                </motion.span>
                <span
                  className={cn(
                    'max-w-full truncate text-center text-[0.6875rem] font-medium leading-tight transition-colors duration-200',
                    active ? 'text-[#1E2430]' : 'text-[#8B92A5]',
                  )}
                >
                  {tab.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
