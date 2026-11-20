import type { ReactNode } from 'react';

type MobileWrapperProps = {
  children: ReactNode;
};

export function MobileWrapper({ children }: MobileWrapperProps) {
  return (
    <div className="flex min-h-screen justify-center bg-[#F3F2F0] sm:items-center sm:py-8">
      <div
        id="scholara-phone-shell"
        className="relative flex h-[100dvh] w-full max-w-phone flex-col overflow-hidden overflow-x-hidden bg-background shadow-phone sm:h-[844px] sm:rounded-[2.25rem] sm:border sm:border-[#EBE8E0]/90"
      >
        {children}
      </div>
    </div>
  );
}
