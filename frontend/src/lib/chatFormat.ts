/** Zero-dependency helpers to keep assistant replies mobile-scannable. */

const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;
const PIPE_ROW = /\|/;

/** Known Scholara status enums → Title Case (and tone for pills). */
const STATUS_LABELS: Record<string, string> = {
  NOT_UPLOADED: 'Not Uploaded',
  UNDER_REVIEW: 'Under Review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  IN_PROGRESS: 'In Progress',
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  WAITLISTED: 'Waitlisted',
  NOT_STARTED: 'Not Started',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  APPROVED: 'Approved',
  CANCELLED: 'Cancelled',
};

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted';

export function humanizeEnumToken(token: string): string {
  const key = token.toUpperCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return token
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function statusTone(token: string): StatusTone {
  const key = token.toUpperCase().replace(/\s+/g, '_');
  if (
    key === 'VERIFIED' ||
    key === 'ACCEPTED' ||
    key === 'COMPLETED' ||
    key === 'APPROVED'
  ) {
    return 'success';
  }
  if (
    key === 'REJECTED' ||
    key === 'CANCELLED' ||
    key === 'NOT_UPLOADED' ||
    key === 'ACTION_NEEDED'
  ) {
    return 'danger';
  }
  if (
    key === 'UNDER_REVIEW' ||
    key === 'IN_PROGRESS' ||
    key === 'PENDING' ||
    key === 'WAITLISTED' ||
    key === 'UPCOMING' ||
    key === 'NOT_STARTED'
  ) {
    return 'warning';
  }
  return 'muted';
}

/** Tone from a human Title Case status phrase (e.g. "Under Review"). */
export function humanStatusTone(label: string): StatusTone {
  const key = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  return statusTone(key);
}

/** True when the whole line is a bold section header like **📄 Documents**. */
export function isSectionHeaderLine(line: string): boolean {
  return /^\*\*[^*]+\*\*$/.test(line.trim());
}

export function sectionHeaderLabel(line: string): string {
  return line.trim().replace(/^\*\*/, '').replace(/\*\*$/, '');
}

const ITEM_EMOJI_PREFIXES = [
  '✅',
  '⏳',
  '⚠️',
  '⚠',
  '📄',
  '🎓',
  '📅',
  '📞',
  '💬',
  '📧',
] as const;

export function isBulletLine(line: string): boolean {
  const t = line.trim();
  if (/^[-*•]\s+/.test(t) || /^\d+\.\s+/.test(t)) return true;
  return ITEM_EMOJI_PREFIXES.some(
    (emoji) => t.startsWith(emoji) && (t.length === emoji.length || /\s/.test(t[emoji.length] ?? '')),
  );
}

export function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Convert Markdown table blocks into bullet-style lines so pipes never show.
 * Non-table content is left intact (aside from stripping pure separator lines).
 */
export function normalizeAssistantMarkdown(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const next = lines[i + 1] ?? '';

    // Detect a Markdown table: header row with pipes + separator row.
    if (
      PIPE_ROW.test(line) &&
      TABLE_SEP.test(next) &&
      splitTableCells(line).length >= 2
    ) {
      const headers = splitTableCells(line);
      i += 2; // skip header + separator
      while (i < lines.length) {
        const row = lines[i] ?? '';
        if (!PIPE_ROW.test(row) || TABLE_SEP.test(row)) {
          if (TABLE_SEP.test(row)) {
            i += 1;
            continue;
          }
          break;
        }
        const cells = splitTableCells(row);
        if (cells.length === 0) {
          i += 1;
          continue;
        }
        const title = cells[0] ?? 'Item';
        const details = cells
          .slice(1)
          .map((cell, idx) => {
            const label = headers[idx + 1];
            return label ? `${label}: ${cell}` : cell;
          })
          .filter(Boolean)
          .join(' · ');
        out.push(
          details ? `• **${title}** — ${details}` : `• **${title}**`,
        );
        i += 1;
      }
      continue;
    }

    // Lone separator or decorative ASCII divider — drop it.
    if (TABLE_SEP.test(line) || /^\s*-{3,}\s*$/.test(line)) {
      i += 1;
      continue;
    }

    // Soft-convert a single pipe-delimited row that isn't a full table.
    if (PIPE_ROW.test(line) && splitTableCells(line).length >= 2) {
      const cells = splitTableCells(line);
      const title = cells[0] ?? 'Item';
      const rest = cells.slice(1).join(' · ');
      out.push(rest ? `• **${title}** — ${rest}` : `• **${title}**`);
      i += 1;
      continue;
    }

    out.push(line);
    i += 1;
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Match leaked ALL_CAPS_SNAKE enums (2+ segments) for pill rendering. */
export const ENUM_TOKEN_RE = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;

const HUMAN_STATUS_RE =
  /^(Not Uploaded|Under Review|Waitlisted|Rejected|Accepted|Pending|In Progress|Verified|Approved|Completed|Action Needed)$/i;

export interface ParsedItemRow {
  emoji: string;
  title: string;
  statusLabel: string | null;
  rest: string;
}

/** Strip dead "Step N/A" placeholders from assistant copy. */
export function stripStepNA(text: string): string {
  return text
    .replace(/\(\s*Step\s*N\/A\s*\)/gi, '')
    .replace(/\bStep\s*N\/A\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:·—-])/g, '$1')
    .trim();
}

/**
 * Parse "⚠️ **Passport** — *Not Uploaded*" into emoji / title / status
 * for a single-line mobile header row.
 */
export function parseItemRow(raw: string): ParsedItemRow {
  let text = stripStepNA(raw.trim());
  let emoji = '';
  const emojiMatch = /^(✅|⏳|⚠️|⚠|📄|🎓|📅|📞|💬|📧)\s*/u.exec(text);
  if (emojiMatch) {
    emoji = emojiMatch[1] ?? '';
    text = text.slice(emojiMatch[0].length).trim();
  }

  let title = text;
  const bold = /\*\*([^*]+)\*\*/.exec(text);
  if (bold?.[1]) {
    title = bold[1].trim();
    text = text.replace(bold[0], '').trim();
  }

  // Drop leftover em-dash / dash separators after title extraction.
  text = text.replace(/^[—–\-:·]+\s*/, '').trim();

  let statusLabel: string | null = null;
  // Prefer trailing *Status* italics (after title), not nested inside **bold**.
  const italicStatus = /(?:^|[—–\-:·]\s*)\*([^*]+)\*\s*$/.exec(text);
  if (italicStatus?.[1] && HUMAN_STATUS_RE.test(italicStatus[1].trim())) {
    statusLabel = italicStatus[1].trim();
    text = text.replace(italicStatus[0], '').replace(/^[—–\-:·]+\s*/, '').trim();
  } else {
    const plain = text.replace(/^\*|\*$/g, '').trim();
    if (HUMAN_STATUS_RE.test(plain)) {
      statusLabel = plain;
      text = '';
    }
  }

  return {
    emoji,
    title: title || 'Item',
    statusLabel,
    rest: text,
  };
}

/** `[[NAVIGATE:/app/documents|Open Documents]]` (case-insensitive). */
export const NAVIGATE_DIRECTIVE_RE =
  /\[\[NAVIGATE:(\/app(?:\/[A-Za-z0-9_-]+)*)\|([^\]]+)\]\]/gi;

export interface NavigateDirective {
  path: string;
  label: string;
}

export function parseNavigateDirective(
  content: string,
): NavigateDirective | null {
  const all = parseNavigateDirectives(content);
  return all[0] ?? null;
}

/** All NAVIGATE directives in order (for picking the first allowed path). */
export function parseNavigateDirectives(
  content: string,
): NavigateDirective[] {
  const out: NavigateDirective[] = [];
  const re =
    /\[\[NAVIGATE:(\/app(?:\/[A-Za-z0-9_-]+)*)\|([^\]]+)\]\]/gi;
  for (const match of content.matchAll(re)) {
    if (!match[1] || !match[2]) continue;
    out.push({ path: match[1], label: match[2].trim() || 'Go' });
  }
  return out;
}

/** Strip all NAVIGATE directives so raw brackets never show in the UI. */
export function stripNavigateDirectives(content: string): string {
  return content
    .replace(NAVIGATE_DIRECTIVE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const CHAT_HOME_DIRECTIVE_RE = /\[\[CHAT_HOME\]\]/g;

export function hasChatHomeDirective(content: string): boolean {
  return /\[\[CHAT_HOME\]\]/.test(content);
}

export function stripChatHomeDirective(content: string): string {
  return content
    .replace(CHAT_HOME_DIRECTIVE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const END_CHAT_DIRECTIVE_RE = /\[\[END_CHAT\]\]/g;

export function hasEndChatDirective(content: string): boolean {
  return /\[\[END_CHAT\]\]/.test(content);
}

export function stripEndChatDirective(content: string): string {
  return content
    .replace(END_CHAT_DIRECTIVE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const SUGGESTIONS_DIRECTIVE_RE =
  /\[\[SUGGESTIONS:([^\]]+)\]\]/g;

export function parseSuggestions(content: string): string[] {
  const match = /\[\[SUGGESTIONS:([^\]]+)\]\]/.exec(content);
  if (!match?.[1]) return [];
  return match[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function suggestionOverlapsText(label: string, text: string): boolean {
  const a = label.trim().toLowerCase();
  const b = text.trim().toLowerCase();
  if (!a || !b) return false;
  // Exact or user text contains the chip — avoid killing chips when a short
  // prior message is a substring of a longer chip label.
  return a === b || (a.length >= 3 && b.includes(a));
}

/** Topics just covered in the assistant reply → suppress matching chips. */
const ANSWERED_TOPIC_RULES: { answered: RegExp; chip: RegExp }[] = [
  {
    answered: /###\s*.*documents|missing document|not uploaded|passport|cnic/i,
    chip: /missing doc|document status|check missing|upload doc/i,
  },
  {
    answered: /###\s*.*deadlines|upcoming deadline|due\b/i,
    chip: /deadline|what.?s due|upcoming deadline/i,
  },
  {
    answered: /###\s*.*applications|application progress|step\s*\d/i,
    chip: /application progress|check application|review application/i,
  },
  {
    answered:
      /schedule_session|schedule a|1:1|call request|chat request|book a/i,
    chip: /schedule 1:1|book a|schedule a call|schedule a chat/i,
  },
];

/**
 * Keep suggestion chips fresh: drop labels that echo the last 1–2 user turns
 * or the topic just answered in this assistant message.
 */
export function filterSuggestionChips(
  labels: string[],
  opts: { priorUserMessages?: string[]; assistantContent?: string },
): string[] {
  const priors = (opts.priorUserMessages ?? [])
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(-2);
  const answered = opts.assistantContent ?? '';

  return labels.filter((label) => {
    if (priors.some((p) => suggestionOverlapsText(label, p))) return false;
    for (const rule of ANSWERED_TOPIC_RULES) {
      if (rule.answered.test(answered) && rule.chip.test(label)) return false;
    }
    return true;
  });
}

export function stripSuggestionsDirective(content: string): string {
  return content
    .replace(SUGGESTIONS_DIRECTIVE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type ScheduleSessionMode = 'CALL' | 'CHAT' | 'ANY';

export const SCHEDULE_SESSION_DIRECTIVE_RE =
  /\[\[SCHEDULE_SESSION:(CALL|CHAT|ANY)\]\]/gi;

export function parseScheduleSession(
  content: string,
): ScheduleSessionMode | null {
  const match = /\[\[SCHEDULE_SESSION:(CALL|CHAT|ANY)\]\]/i.exec(content);
  if (!match?.[1]) return null;
  return match[1].toUpperCase() as ScheduleSessionMode;
}

export function stripScheduleSessionDirective(content: string): string {
  return content
    .replace(SCHEDULE_SESSION_DIRECTIVE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Drop any leftover `[[...]]` machine tokens so malformed directives never leak. */
export function stripResidualDirectives(content: string): string {
  return content
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Strip all machine directives before rendering assistant text. */
export function stripAssistantDirectives(content: string): string {
  return stripResidualDirectives(
    stripEndChatDirective(
      stripScheduleSessionDirective(
        stripSuggestionsDirective(
          stripChatHomeDirective(stripNavigateDirectives(content)),
        ),
      ),
    ),
  );
}

/**
 * Split assistant body into display lines. Also splits mid-paragraph when
 * Groq forgets a newline before the next `- **Title** :: …` item or `### ` header.
 */
export function splitAssistantDisplayLines(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n+|(?=\s*###\s+)|(?=\s*-\s+\*\*)/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isHashSectionHeader(line: string): boolean {
  return /^#{2,3}\s+\S/.test(line.trim());
}

export function hashSectionLabel(line: string): string {
  return line.trim().replace(/^#{2,3}\s+/, '');
}

/** True for redundant "Next Steps" closing sections (emoji-tolerant). */
export function isNextStepsSectionLabel(label: string): boolean {
  const cleaned = label
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return (
    /^next\s*steps?\b/.test(cleaned) ||
    /^what\s+to\s+do\s+next\b/.test(cleaned)
  );
}

export interface ColonItem {
  title: string;
  status: string | null;
  note: string | null;
}

/** Parse `- **Title** :: Status :: Note` (also tolerates legacy em-dash forms). */
export function parseColonItem(line: string): ColonItem | null {
  const text = stripStepNA(line.trim())
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+\.\s+/, '');
  if (!text) return null;

  if (text.includes('::')) {
    const parts = text.split('::').map((p) => p.trim());
    const titlePart = parts[0] ?? '';
    const status = parts[1] ? parts[1].replace(/^\*|\*$/g, '').trim() : null;
    const note = parts.slice(2).join(' :: ').trim() || null;
    const bold = /\*\*([^*]+)\*\*/.exec(titlePart);
    const title = (bold?.[1] ?? titlePart.replace(/\*\*/g, '')).trim();
    return {
      title: title || 'Item',
      status: status || null,
      note,
    };
  }

  // Legacy fallback via parseItemRow
  const row = parseItemRow(text);
  let note = row.rest || null;
  if (row.statusLabel && note) {
    // Drop duplicated status words in the note.
    const escaped = row.statusLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    note = note.replace(new RegExp(escaped, 'gi'), '').trim() || null;
  }
  return {
    title: row.title,
    status: row.statusLabel,
    note,
  };
}

export function statusEmojiFor(status: string | null): string {
  if (!status) return '';
  const tone = humanStatusTone(status);
  if (tone === 'success') return '✅';
  if (tone === 'warning') return '⏳';
  if (tone === 'danger') return '⚠️';
  return '';
}

const HUMAN_STATUS_PHRASES = [
  'Not Uploaded',
  'Under Review',
  'Waitlisted',
  'Rejected',
  'Accepted',
  'Pending',
  'In Progress',
  'Verified',
  'Approved',
  'Completed',
  'Action Needed',
] as const;

/** Collapse consecutive duplicate status phrases in legacy wall-of-text replies. */
export function dedupeRepeatedStatusWords(text: string): string {
  let out = text;
  for (const phrase of HUMAN_STATUS_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(${escaped})(?:\\s+\\1)+`, 'gi'), '$1');
  }
  return out;
}

/**
 * Allowlist from App.tsx routes. Consultants may use /app/students/:id/...
 * when studentId is present; students/guardians use self-scoped /app/* paths.
 */
export function isAllowedNavigatePath(
  path: string,
  role: string,
  studentId?: string,
): boolean {
  if (role === 'CONSULTANT') {
    if (path === '/app' || path === '/app/profile') return true;
    if (!studentId) return false;
    const base = `/app/students/${studentId}`;
    return (
      path === base ||
      path === `${base}/documents` ||
      path === `${base}/applications` ||
      path === `${base}/calls` ||
      path === `${base}/emails` ||
      path === `${base}/messages` ||
      path.startsWith(`${base}/applications/`)
    );
  }

  return (
    path === '/app' ||
    path === '/app/documents' ||
    path === '/app/applications' ||
    path === '/app/profile' ||
    path === '/app/emails' ||
    path === '/app/consultant' ||
    path === '/app/messages' ||
    path.startsWith('/app/applications/')
  );
}
