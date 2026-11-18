import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  GraduationCap,
  Home,
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
  { to: '/app/applications', label: 'Application', Icon: GraduationCap },
  { to: '/app/documents', label: 'Documents', Icon: FileText },
  { to: '/app/profile', label: 'Profile', Icon: User },
];

const CONSULTANT_TABS: Tab[] = [
  { to: '/app', end: true, label: 'Home', Icon: Home },
  { to: '/app/profile', label: 'Profile', Icon: User },
];

/** Profile hub includes Support / emails / messages nested under profile IA. */
function isProfileHubPath(pathname: string) {
  return (
    pathname === '/app/profile' ||
    pathname.startsWith('/app/consultant') ||
    pathname.startsWith('/app/emails') ||
    pathname.startsWith('/app/messages')
  );
}

function isTabActive(tab: Tab, pathname: string) {
  if (tab.to === '/app/profile') {
    return isProfileHubPath(pathname);
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
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-phone -translate-x-1/2 border-t border-[#EBE8E0]/80 bg-[#F9F8F6]/92 px-2 pt-2 shadow-nav backdrop-blur-md"
      style={{
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <ul
        className={cn(
          'grid',
          tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-4',
        )}
      >
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          return (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className="relative flex min-h-14 w-full flex-col items-center justify-center gap-1 overflow-visible px-0.5 no-underline"
                aria-current={active ? 'page' : undefined}
              >
                <motion.span
                  animate={{ y: active ? -1 : 0 }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <tab.Icon
                    className={cn(
                      'h-5 w-5',
                      active ? 'text-[#111827]' : 'text-[#6B7280]',
                    )}
                    strokeWidth={1.5}
                  />
                  {active ? (
                    <motion.span
                      layoutId="tab-dot"
                      className="h-1 w-1 rounded-full bg-[#C8963E]"
                    />
                  ) : (
                    <span className="h-1 w-1" aria-hidden />
                  )}
                </motion.span>
                <span
                  className={cn(
                    'max-w-full truncate text-center text-[11px] font-medium leading-tight',
                    active ? 'text-[#1E2430]' : 'text-[#6B7280]',
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
