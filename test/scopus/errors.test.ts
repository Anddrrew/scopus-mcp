import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiError } from '../../src/scopus/errors';

for (const body of [
  undefined,
  null,
  'upstream HTML',
  [],
  { 'service-error': { status: { statusCode: 123 } } },
  { 'error-response': { errorMessage: null } },
]) {
  await test(`malformed error body falls back to HTTP status: ${JSON.stringify(body)}`, async () => {
    const error = await apiError(429, body, { 'Retry-After': '10' }, []);
    assert.equal(error.code, 'HTTP_429');
    assert.equal(
      error.message,
      'Scopus quota or request rate exceeded. Check the response metadata before retrying.',
    );
    assert.equal(error.status, 429);
    assert.deepEqual(error.headers, { 'Retry-After': '10' });
  });
}

await test('native error envelopes allow unknown data and prefer the service error', async () => {
  const error = await apiError(
    400,
    {
      'service-error': {
        status: {
          statusCode: 'SERVICE',
          statusText: 'Native message',
          extra: 1,
        },
        extra: true,
      },
      'error-response': {
        errorCode: 'GATEWAY',
        errorMessage: 'Fallback',
        extra: null,
      },
      extra: { arbitrary: [1, null] },
    },
    {},
    [],
  );
  assert.equal(error.code, 'SERVICE');
  assert.equal(error.message, 'Native message');
});

await test('error validation retains redaction of raw and encoded credentials and message length limit', async () => {
  const secret = 'test/key+token';
  const error = await apiError(
    401,
    {
      'error-response': {
        errorCode: `AUTH_${encodeURIComponent(secret)}`,
        errorMessage: `${secret} / ${encodeURIComponent(secret)} ${'x'.repeat(1500)}`,
      },
    },
    {},
    [secret],
  );
  assert.equal(error.code, 'AUTH_[REDACTED]');
  assert.ok(error.message.startsWith('[REDACTED] / [REDACTED] '));
  assert.equal(error.message.length, 1000);
  assert.equal(error.message.includes(secret), false);
});
