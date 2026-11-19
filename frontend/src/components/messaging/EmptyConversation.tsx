import { MessageCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export const SUGGESTED_PROMPTS = [
  'Can you update me on my application?',
  'I have a question about my documents.',
  'What should I do next?',
  "I'd like to discuss my university options.",
] as const;

export function EmptyConversation({
  readOnly,
  onSelectPrompt,
}: {
  readOnly: boolean;
  onSelectPrompt?: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
      <span className="ivy-medallion mb-4 flex h-14 w-14 items-center justify-center rounded-full">
        <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <h2 className="editorial-title text-xl text-[#1E2430]">
        Your conversation starts here.
      </h2>
      <p className="mt-2 max-w-[18.5rem] text-sm leading-relaxed text-[#8B92A5]">
        {readOnly
          ? 'Messages between the student and consultant stay here — they do not need to be online at the same time.'
          : 'Message anytime. They do not need to be online — your chat history stays saved like a normal conversation.'}
      </p>

      {!readOnly && onSelectPrompt ? (
        <div className="mt-7 w-full max-w-sm">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8A6212]">
            Not sure what to ask? Start with one of these.
          </p>
          <ul className="flex flex-col gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className={cn(
                    'w-full rounded-2xl border border-[#EBE8E0] bg-white px-3.5 py-3 text-left text-sm font-medium text-[#1E2430]',
                    'shadow-[0_1px_2px_rgba(27,33,44,0.04)] transition-colors',
                    'hover:border-[#E5CE96] hover:bg-[#FFFDF9] active:bg-[#FBF3DF]',
                  )}
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
