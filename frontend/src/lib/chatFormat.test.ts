import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeRepeatedStatusWords,
  hashSectionLabel,
  humanizeEnumToken,
  humanStatusTone,
  isAllowedNavigatePath,
  isBulletLine,
  isHashSectionHeader,
  isSectionHeaderLine,
  normalizeAssistantMarkdown,
  parseColonItem,
  parseItemRow,
  parseNavigateDirective,
  filterSuggestionChips,
  parseScheduleSession,
  parseSuggestions,
  sectionHeaderLabel,
  splitAssistantDisplayLines,
  splitTableCells,
  statusEmojiFor,
  statusTone,
  hasChatHomeDirective,
  hasEndChatDirective,
  isNextStepsSectionLabel,
  stripAssistantDirectives,
  stripNavigateDirectives,
  stripStepNA,
} from './chatFormat.ts';

describe('chatFormat (mobile table flatten)', () => {
  it('splits pipe cells without keeping outer pipes', () => {
    assert.deepEqual(splitTableCells('| A | B | C |'), ['A', 'B', 'C']);
  });

  it('converts a markdown table into bullet lines without pipes', () => {
    const input = [
      'Here is progress:',
      '',
      '| University | Status | Due |',
      '| --- | --- | --- |',
      '| NUST | In progress | 2026-12-01 |',
      '| LUMS | Submitted | 2026-11-20 |',
      '',
      'Next: upload CNIC.',
    ].join('\n');

    const out = normalizeAssistantMarkdown(input);
    assert.equal(out.includes('|'), false);
    assert.match(out, /• \*\*NUST\*\*/);
    assert.match(out, /Status: In progress/);
    assert.match(out, /Next: upload CNIC/);
  });

  it('drops ascii divider rows', () => {
    const out = normalizeAssistantMarkdown('Hello\n---\nWorld');
    assert.equal(out, 'Hello\nWorld');
  });
});

describe('chatFormat (enums & sections)', () => {
  it('humanizes leaked status enums to Title Case', () => {
    assert.equal(humanizeEnumToken('NOT_UPLOADED'), 'Not Uploaded');
    assert.equal(humanizeEnumToken('UNDER_REVIEW'), 'Under Review');
    assert.equal(humanizeEnumToken('WAITLISTED'), 'Waitlisted');
  });

  it('maps status tone for pills', () => {
    assert.equal(statusTone('VERIFIED'), 'success');
    assert.equal(statusTone('REJECTED'), 'danger');
    assert.equal(statusTone('UNDER_REVIEW'), 'warning');
    assert.equal(statusTone('NOT_UPLOADED'), 'danger');
    assert.equal(humanStatusTone('Under Review'), 'warning');
  });

  it('detects bold section headers including emoji anchors', () => {
    assert.equal(isSectionHeaderLine('**Documents**'), true);
    assert.equal(isSectionHeaderLine('**📄 Documents**'), true);
    assert.equal(sectionHeaderLabel('**🎓 Applications**'), '🎓 Applications');
    assert.equal(isSectionHeaderLine('• **NUST** — Pending'), false);
  });

  it('treats emoji-led status lines as bullets', () => {
    assert.equal(isBulletLine('⚠️ **Passport** — *Not Uploaded*'), true);
    assert.equal(isBulletLine('  Upload your scan today.'), false);
  });
});

describe('chatFormat (navigate directives)', () => {
  it('parses and strips NAVIGATE directives', () => {
    const raw =
      'Opening documents for you.\n\n[[NAVIGATE:/app/documents|Open Documents]]';
    const parsed = parseNavigateDirective(raw);
    assert.deepEqual(parsed, {
      path: '/app/documents',
      label: 'Open Documents',
    });
    assert.equal(stripNavigateDirectives(raw).includes('[[NAVIGATE'), false);
    assert.match(stripNavigateDirectives(raw), /Opening documents/);
  });

  it('detects and strips CHAT_HOME without closing the drawer', () => {
    const raw = 'Here is the assistant home menu.\n\n[[CHAT_HOME]]';
    assert.equal(hasChatHomeDirective(raw), true);
    assert.equal(stripAssistantDirectives(raw).includes('[[CHAT_HOME]]'), false);
    assert.match(stripAssistantDirectives(raw), /assistant home menu/);
  });

  it('detects and strips END_CHAT without leaving brackets', () => {
    const raw =
      'Chat ended. Tap below to start a fresh conversation anytime!\n\n[[END_CHAT]]';
    assert.equal(hasEndChatDirective(raw), true);
    assert.equal(stripAssistantDirectives(raw).includes('[[END_CHAT]]'), false);
    assert.match(stripAssistantDirectives(raw), /Chat ended/);
  });

  it('allowlists student vs consultant routes', () => {
    assert.equal(isAllowedNavigatePath('/app/documents', 'STUDENT'), true);
    assert.equal(
      isAllowedNavigatePath('/app/students/abc/documents', 'STUDENT'),
      false,
    );
    assert.equal(isAllowedNavigatePath('/app', 'CONSULTANT'), true);
    assert.equal(
      isAllowedNavigatePath('/app/students/abc/documents', 'CONSULTANT'),
      false,
    );
    assert.equal(
      isAllowedNavigatePath('/app/students/abc/documents', 'CONSULTANT', 'abc'),
      true,
    );
  });
});

describe('chatFormat (mobile row parse)', () => {
  it('strips Step N/A placeholders', () => {
    assert.equal(stripStepNA('Passport (Step N/A)'), 'Passport');
    assert.equal(stripStepNA('Step N/A upload now'), 'upload now');
  });

  it('parses emoji title and status onto one header row', () => {
    const row = parseItemRow('⚠️ **Passport** — *Not Uploaded*');
    assert.equal(row.emoji, '⚠️');
    assert.equal(row.title, 'Passport');
    assert.equal(row.statusLabel, 'Not Uploaded');
  });
});

describe('chatFormat (colon cards & suggestions)', () => {
  it('parses hash section headers', () => {
    assert.equal(isHashSectionHeader('### 📄 Documents'), true);
    assert.equal(hashSectionLabel('### 🎓 Applications'), '🎓 Applications');
    assert.equal(isHashSectionHeader('**Documents**'), false);
  });

  it('parses pipe-free :: item lines', () => {
    const item = parseColonItem(
      '- **Passport Photo** :: Not Uploaded :: Upload a clear photo by Nov 10 to stay on track.',
    );
    assert.equal(item?.title, 'Passport Photo');
    assert.equal(item?.status, 'Not Uploaded');
    assert.match(item?.note ?? '', /Upload a clear photo/);
    assert.equal(statusEmojiFor('Not Uploaded'), '⚠️');
    assert.equal(statusEmojiFor('Accepted'), '✅');
    assert.equal(statusEmojiFor('Under Review'), '⏳');
  });

  it('splits chained mid-paragraph - ** items onto separate lines', () => {
    const chained =
      'Here is your status: - **Passport** :: Not Uploaded :: Upload soon. - **Transcript** :: Under Review :: Waiting on office.';
    const lines = splitAssistantDisplayLines(chained);
    assert.ok(lines.length >= 3);
    assert.match(lines[0] ?? '', /Here is your status/);
    assert.match(lines[1] ?? '', /^-\s+\*\*Passport\*\*/);
    assert.match(lines[2] ?? '', /^-\s+\*\*Transcript\*\*/);
    assert.equal(parseColonItem(lines[1] ?? '')?.title, 'Passport');
    assert.equal(parseColonItem(lines[2] ?? '')?.title, 'Transcript');
    assert.equal((lines[1] ?? '').includes('::'), true);
    assert.equal(
      stripAssistantDirectives(chained).includes('[['),
      false,
    );
  });

  it('splits mid-paragraph ### headers so raw hashes never stick to prose', () => {
    const leaked =
      'Quick overview:### 📄 Documents\n- **Passport** :: Not Uploaded :: Upload soon.### 📅 Deadlines';
    const lines = splitAssistantDisplayLines(leaked);
    assert.ok(lines.some((l) => isHashSectionHeader(l) && l.includes('Documents')));
    assert.ok(lines.some((l) => isHashSectionHeader(l) && l.includes('Deadlines')));
    assert.equal(
      lines.some((l) => l.includes('###') && !isHashSectionHeader(l)),
      false,
    );
    assert.equal(isNextStepsSectionLabel('Next Steps'), true);
    assert.equal(isNextStepsSectionLabel('📋 Next steps'), true);
    assert.equal(isNextStepsSectionLabel('Documents'), false);
  });

  it('parses and strips SUGGESTIONS without leaving brackets', () => {
    const raw =
      'Here is your status.\n\n[[SUGGESTIONS:Check missing documents|View upcoming deadlines]]';
    assert.deepEqual(parseSuggestions(raw), [
      'Check missing documents',
      'View upcoming deadlines',
    ]);
    assert.equal(stripAssistantDirectives(raw).includes('[[SUGGESTIONS'), false);
    assert.match(stripAssistantDirectives(raw), /Here is your status/);
  });

  it('dedupes repeated status words in legacy text', () => {
    assert.equal(
      dedupeRepeatedStatusWords('Passport Not Uploaded Not Uploaded'),
      'Passport Not Uploaded',
    );
  });

  it('parses and strips SCHEDULE_SESSION directives', () => {
    const raw =
      'Pick a slot below.\n\n[[SCHEDULE_SESSION:CALL]]';
    assert.equal(parseScheduleSession(raw), 'CALL');
    assert.equal(parseScheduleSession('[[SCHEDULE_SESSION:ANY]]'), 'ANY');
    assert.equal(
      stripAssistantDirectives(raw).includes('[[SCHEDULE_SESSION'),
      false,
    );
    assert.match(stripAssistantDirectives(raw), /Pick a slot/);
  });

  it('filters suggestion chips that echo prior turns or answered topics', () => {
    const chips = filterSuggestionChips(
      ['Check missing documents', 'Schedule 1:1 Call', 'Check application progress'],
      {
        priorUserMessages: ['Which documents are still missing?'],
        assistantContent:
          '### 📄 Documents\n- **Passport** :: Not Uploaded :: Upload soon.',
      },
    );
    assert.deepEqual(chips, [
      'Schedule 1:1 Call',
      'Check application progress',
    ]);
  });
});
