import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, isUuid, ownsRequest } from './security.js';

test('accepts only a real bearer header', () => {
  assert.equal(bearerToken('Bearer signed.jwt.value'), 'signed.jwt.value');
  assert.equal(bearerToken('bearer signed.jwt.value'), 'signed.jwt.value');
  assert.equal(bearerToken('signed.jwt.value'), null);
  assert.equal(bearerToken(undefined), null);
});

test('rejects malformed identifiers before they reach service-role queries', () => {
  assert.equal(isUuid('f2ce4c73-6d9e-4f9a-a81f-9b1ca8d28861'), true);
  assert.equal(isUuid('not-a-uuid'), false);
});

test('request ownership is exact', () => {
  assert.equal(ownsRequest('passenger-a', 'passenger-a'), true);
  assert.equal(ownsRequest('passenger-a', 'passenger-b'), false);
});
