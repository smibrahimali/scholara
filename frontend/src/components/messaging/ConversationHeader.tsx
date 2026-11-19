import { BackLink } from '../ivy/BackLink';
import { getInitials } from '../../lib/messageGrouping';

export function ConversationHeader({
  backTo,
  peerName,
  roleLabel,
  statusLabel,
  readOnly,
}: {
  backTo: string;
  peerName: string;
  roleLabel: string;
  /** Async/persistence hint — not peer online status. */
  statusLabel: string;
  readOnly?: boolean;
}) {
  return (
    <header className="flex shrink-0 items-center gap-2.5 border-b border-[#EBE8E0]/90 bg-[#F9F8F6]/95 px-4 py-2.5 backdrop-blur-[6px]">
      <BackLink to={backTo} className="mb-0" />
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[11px] font-semibold tracking-wide text-white"
        aria-hidden
      >
        {getInitials(peerName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[15px] font-semibold leading-tight text-[#111827]">
          {peerName}
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <p className="truncate text-xs text-[#8B92A5]">{roleLabel}</p>
          <span className="text-[10px] text-[#C5C0B6]" aria-hidden>
            ·
          </span>
          <p className="truncate text-[11px] font-medium text-[#8B92A5]">
            {statusLabel}
            {readOnly ? ' · View only' : ''}
          </p>
        </div>
      </div>
    </header>
  );
}
