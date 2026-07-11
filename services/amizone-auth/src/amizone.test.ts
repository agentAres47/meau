import assert from 'node:assert';
import { mockVerify } from './amizone.js';

// ponytail: one runnable check on the credential gate — the only branching logic
// in mock mode. Run with `npm test`.
assert.strictEqual(mockVerify('', 'pass'), null, 'empty id must be rejected');
assert.strictEqual(mockVerify('A1234', ''), null, 'empty password must be rejected');
assert.strictEqual(mockVerify('A1234', 'wrong'), null, 'sentinel "wrong" must be rejected');

const ok = mockVerify('A1234', 'anything');
assert.ok(ok, 'valid credentials must be accepted');
assert.strictEqual(ok.amizone_id, 'A1234');
assert.strictEqual(ok.role, 'student');
assert.ok(ok.full_name.includes('A1234'));

console.log('amizone mock checks passed');
