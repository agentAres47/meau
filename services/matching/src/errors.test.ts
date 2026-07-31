// Self-check: `node --test src/errors.test.ts` (or `npx tsx --test`).
// Guards the one thing that matters here -- that a wrapped transport failure
// still reveals its root cause, which is what a bare `.message` threw away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errDetail } from './errors.js';

test('unwraps the cause chain that undici hides behind "fetch failed"', () => {
  const cause = Object.assign(new Error('getaddrinfo ENOTFOUND db.example.co'), {
    code: 'ENOTFOUND',
    syscall: 'getaddrinfo',
    hostname: 'db.example.co',
  });
  const out = errDetail(Object.assign(new TypeError('fetch failed'), { cause }));

  assert.match(out, /fetch failed/);
  assert.match(out, /ENOTFOUND/); // the bit that was invisible during the outage
  assert.match(out, /db\.example\.co/);
});

test('renders PostgrestError-shaped plain objects, not [object Object]', () => {
  const out = errDetail({ message: 'boom', code: '42702', hint: 'alias it' });

  assert.doesNotMatch(out, /\[object Object\]/);
  assert.match(out, /boom/);
  assert.match(out, /42702/);
});

test('survives a self-referencing cause instead of looping forever', () => {
  const e = new Error('loop') as Error & { cause?: unknown };
  e.cause = e;
  assert.match(errDetail(e), /loop/);
});
