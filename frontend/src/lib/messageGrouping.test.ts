import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMessageTimeline,
  formatDateSeparator,
  formatMessageTime,
  getInitials,
} from './messageGrouping.ts';
import type { DirectMessageItem } from '../types/domain.ts';

function msg(
  partial: Partial<DirectMessageItem> & Pick<DirectMessageItem, 'id' | 'senderUserId' | 'createdAt'>,
): DirectMessageItem {
  return {
    conversationId: 'c1',
    senderName: 'Sender',
    body: 'Hello',
    readAt: null,
    ...partial,
  };
}

describe('messageGrouping', () => {
  it('builds initials from a full name', () => {
    assert.equal(getInitials('Sarah Chen'), 'SC');
    assert.equal(getInitials('Alex'), 'AL');
    assert.equal(getInitials('  '), '?');
  });

  it('formats times and date separators', () => {
    const now = new Date('2026-11-19T15:00:00');
    assert.equal(formatDateSeparator('2026-11-19T10:00:00', now), 'Today');
    assert.equal(formatDateSeparator('2026-11-18T10:00:00', now), 'Yesterday');
    assert.match(formatMessageTime('2026-11-19T10:05:00'), /\d/);
  });

  it('groups consecutive same-sender messages and inserts date separators', () => {
    const now = new Date('2026-11-19T15:00:00');
    const timeline = buildMessageTimeline(
      [
        msg({
          id: '1',
          senderUserId: 'peer',
          senderName: 'Sarah',
          createdAt: '2026-11-18T10:00:00',
        }),
        msg({
          id: '2',
          senderUserId: 'me',
          createdAt: '2026-11-19T10:00:00',
        }),
        msg({
          id: '3',
          senderUserId: 'me',
          createdAt: '2026-11-19T10:01:00',
        }),
      ],
      'me',
      now,
    );

    assert.equal(timeline.filter((t) => t.type === 'date').length, 2);

    const first = timeline.find((t) => t.type === 'message' && t.message.id === '1');
    const second = timeline.find((t) => t.type === 'message' && t.message.id === '2');
    const third = timeline.find((t) => t.type === 'message' && t.message.id === '3');

    assert.ok(first && first.type === 'message');
    assert.equal(first.showName, true);
    assert.equal(first.showMeta, true);

    assert.ok(second && second.type === 'message');
    assert.equal(second.mine, true);
    assert.equal(second.isFirstInGroup, true);
    assert.equal(second.showMeta, false);

    assert.ok(third && third.type === 'message');
    assert.equal(third.isLastInGroup, true);
    assert.equal(third.showMeta, true);
  });
});
