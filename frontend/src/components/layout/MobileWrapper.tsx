import type { ReactNode } from 'react';

type MobileWrapperProps = {
  children: ReactNode;
};

export function MobileWrapper({ children }: MobileWrapperProps) {
  return (
    <div className="flex min-h-screen justify-center bg-desk sm:items-center sm:py-8">
      <div className="relative flex h-[100dvh] w-full max-w-phone flex-col overflow-hidden bg-background shadow-phone sm:h-[844px] sm:rounded-[2.5rem] sm:border sm:border-border">
        {children}
      </div>
    </div>
  );
}
