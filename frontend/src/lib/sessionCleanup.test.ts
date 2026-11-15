import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import {
  disconnectAllSockets,
  trackSocket,
  trackedSocketCount,
} from './socketRegistry.ts';
import { clearClientSession, TOKEN_KEY, USER_KEY } from './sessionCleanup.ts';

describe('sessionCleanup (P0-1)', () => {
  it('clears auth keys, query cache, and tracked sockets', () => {
    const store = new Map<string, string>();
    const original = globalThis.localStorage;
    // @ts-expect-error test stub
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };

    store.set(TOKEN_KEY, 'old-token');
    store.set(USER_KEY, '{"email":"student@scholara.demo"}');

    let disconnected = 0;
    const untrack = trackSocket({
      disconnect: () => {
        disconnected += 1;
      },
    });
    assert.equal(trackedSocketCount(), 1);

    const queryClient = new QueryClient();
    queryClient.setQueryData(['dashboard'], { secret: 'student-data' });
    assert.ok(queryClient.getQueryData(['dashboard']));

    clearClientSession(queryClient);

    assert.equal(store.has(TOKEN_KEY), false);
    assert.equal(store.has(USER_KEY), false);
    assert.equal(queryClient.getQueryData(['dashboard']), undefined);
    assert.equal(disconnected, 1);
    assert.equal(trackedSocketCount(), 0);

    untrack();
    disconnectAllSockets();
    // @ts-expect-error restore
    globalThis.localStorage = original;
  });
});
