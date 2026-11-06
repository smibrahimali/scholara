import { NavLink } from 'react-router-dom';
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
  { to: '/app/applications', label: 'Apps', Icon: GraduationCap },
  { to: '/app/documents', label: 'Documents', Icon: FileText },
  { to: '/app/profile', label: 'Profile', Icon: User },
];

const CONSULTANT_TABS: Tab[] = [
  { to: '/app', end: true, label: 'Home', Icon: Home },
  { to: '/app/profile', label: 'Profile', Icon: User },
];

export function BottomTabBar() {
  const { user } = useAuth();
  const tabs = user?.role === 'CONSULTANT' ? CONSULTANT_TABS : STUDENT_TABS;

  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-50 border-t bg-card/85 px-2 pt-2 backdrop-blur-xl"
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        borderColor: 'rgba(120, 53, 15, 0.1)',
        boxShadow: '0 -8px 20px -4px rgba(0, 0, 0, 0.04)',
      }}
    >
      <ul
        className={cn(
          'grid',
          tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-4',
        )}
      >
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className="relative flex min-h-14 w-full flex-col items-center justify-center gap-1 overflow-visible px-0.5 no-underline"
            >
              {({ isActive }) => (
                <>
                  <motion.span
                    animate={{ y: isActive ? -1 : 0 }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <tab.Icon
                      className={cn(
                        'h-5 w-5',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                      strokeWidth={isActive ? 2.4 : 1.8}
                    />
                    {isActive ? (
                      <motion.span
                        layoutId="tab-dot"
                        className="h-1.5 w-1.5 rounded-full bg-gold"
                        style={{
                          boxShadow: '0 0 10px 2px rgba(212, 175, 55, 0.55)',
                        }}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5" aria-hidden />
                    )}
                  </motion.span>
                  <span
                    className={cn(
                      'max-w-full truncate text-center text-[11px] font-bold leading-tight',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
