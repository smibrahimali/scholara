import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { TapButton } from '../ivy/TapButton';
import { cn } from '../../lib/cn';
import {
  clearChatMessages,
  fetchChatMessages,
  sendChatMessage,
  type ChatMessageDto,
} from '../../services/chatApi';

function errorMessage(err: unknown, fallback: string) {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'message' in err.response.data
  ) {
    const msg = (err.response.data as { message: string | string[] }).message;
    return Array.isArray(msg) ? msg[0] : String(msg);
  }
  return fallback;
}

export function FloatingChatbot({ studentId }: { studentId?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['chat-messages'],
    queryFn: fetchChatMessages,
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendChatMessage(content, studentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      setDraft('');
    },
    onError: (err) => toast.error(errorMessage(err, 'Chat failed')),
  });

  const clearMutation = useMutation({
    mutationFn: clearChatMessages,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      toast.success('Chat cleared');
    },
    onError: () => toast.error('Could not clear chat'),
  });

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages.length, sendMutation.isPending]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    sendMutation.mutate(content);
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-40 right-3 z-[60] flex h-[min(420px,58dvh)] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[rgba(120,53,15,0.12)] bg-card shadow-[0_18px_40px_-18px_rgba(11,21,40,0.45)]"
          >
            <header className="flex items-center gap-2 border-b border-black/[0.06] bg-[#0B1528] px-3 py-3 text-primary-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm font-semibold leading-tight">
                  Scholara Assistant
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">
                  Groq · admissions help
                </p>
              </div>
              <TapButton
                aria-label="Clear chat"
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/80 hover:bg-white/10"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending || messages.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </TapButton>
              <TapButton
                aria-label="Close chat"
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/80 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </TapButton>
            </header>

            <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto bg-background/80 px-3 py-3">
              {messagesQuery.isLoading ? (
                <p className="text-center text-xs font-semibold text-muted-foreground">
                  Loading conversation…
                </p>
              ) : null}
              {!messagesQuery.isLoading && messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[rgba(120,53,15,0.15)] bg-gold-soft/40 px-3 py-4 text-center">
                  <p className="font-serif text-sm font-semibold text-foreground">
                    Ask about your admissions journey
                  </p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    Documents, deadlines, steps, or what to do next.
                  </p>
                </div>
              ) : null}
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {sendMutation.isPending ? (
                <div className="mr-8 rounded-2xl rounded-bl-md bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Assistant is typing…
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 border-t border-black/[0.06] bg-card px-2 py-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder="Ask Scholara…"
                className="max-h-24 min-h-11 flex-1 resize-none rounded-xl border border-black/[0.06] bg-background px-3 py-2.5 text-sm outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
              />
              <TapButton
                type="submit"
                disabled={!draft.trim() || sendMutation.isPending}
                className="btn-metallic flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </TapButton>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        aria-label={open ? 'Close assistant' : 'Open Scholara assistant'}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'absolute bottom-24 right-3 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-[0_10px_28px_-8px_rgba(212,175,55,0.55)]',
          open
            ? 'bg-[#0B1528] text-gold'
            : 'btn-metallic text-[#0B1528]',
        )}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </motion.button>
    </>
  );
}

function ChatBubble({ message }: { message: ChatMessageDto }) {
  const isUser = message.role === 'user';
  return (
    <div
      className={cn(
        'max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
        isUser
          ? 'ml-auto rounded-br-md bg-[#0B1528] text-primary-foreground'
          : 'mr-auto rounded-bl-md bg-secondary text-foreground',
      )}
    >
      <p className="whitespace-pre-wrap font-semibold">{message.content}</p>
    </div>
  );
}
