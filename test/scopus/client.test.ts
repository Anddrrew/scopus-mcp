import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { ScopusClient } from '../../src/scopus/client';
import { ScopusError } from '../../src/scopus/errors';
import { searchFixture } from '../helpers/fixtures';
import { mockFetch } from '../helpers/mock-fetch';

const path = '/content/search/scopus';
const config = { apiKey: 'test-api-key', instToken: 'test-inst-token' };

await test('GET keeps params and response intact, sends credentials only as headers', async () => {
  const body = searchFixture('success');
  const mock = mockFetch(
    Response.json(body, {
      headers: {
        'X-RateLimit-Limit': '20000',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1792000000',
        'Set-Cookie': 'not-exposed',
      },
    }),
  );
  const params = {
    query: 'TITLE-ABS-KEY(Київ & AI) + test',
    cursor: 'next+/==',
    count: 25,
    suppressNavLinks: false,
    alias: false,
    field: undefined,
  };
  const response = await new ScopusClient(config, mock.fetch).get(path, params);
  assert.deepEqual(response.body, body);
  assert.deepEqual(response.headers, {
    'X-RateLimit-Limit': '20000',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': '1792000000',
  });
  assert.equal(mock.requests.length, 1);
  const request = mock.requests[0];
  assert.ok(request);
  const url = new URL(request.url);
  assert.equal(
    url.origin + url.pathname,
    'https://api.elsevier.com/content/search/scopus',
  );
  assert.equal(request.method, 'GET');
  assert.equal(request.headers.get('Accept'), 'application/json');
  assert.equal(request.headers.get('X-ELS-APIKey'), config.apiKey);
  assert.equal(request.headers.get('X-ELS-Insttoken'), config.instToken);
  assert.equal(request.redirect, 'error');
  for (const [key, value] of Object.entries(params)) {
    assert.equal(
      url.searchParams.get(key),
      value === undefined ? null : String(value),
    );
  }
  assert.equal(request.url.includes(config.apiKey), false);
  assert.equal(request.url.includes(config.instToken), false);
});

await test('institutional token is optional', async () => {
  const mock = mockFetch(Response.json({}));
  await new ScopusClient({ apiKey: 'test' }, mock.fetch).get(path, {
    start: 0,
  });
  assert.equal(mock.requests[0]?.headers.has('X-ELS-Insttoken'), false);
  assert.equal(
    new URL(mock.requests[0]?.url ?? '').searchParams.get('start'),
    '0',
  );
});

await test('missing or invalid credentials fail without making an HTTP call', async () => {
  const mock = mockFetch(Response.json({}));
  await assert.rejects(new ScopusClient({}, mock.fetch).get(path, {}), {
    code: 'MISSING_API_KEY',
  });
  await assert.rejects(
    new ScopusClient({ apiKey: 'key\nInjected: true' }, mock.fetch).get(
      path,
      {},
    ),
    { code: 'INVALID_CREDENTIALS' },
  );
  assert.equal(mock.requests.length, 0);
});

await test('credentials cannot be sent to another origin', async () => {
  const mock = mockFetch(Response.json({}));
  await assert.rejects(
    new ScopusClient(config, mock.fetch).get('https://example.com/', {}),
    { code: 'INVALID_ENDPOINT' },
  );
  assert.equal(mock.requests.length, 0);
});

for (const status of [400, 401, 403, 429, 500, 503]) {
  await test(`HTTP ${status} is a useful error even if the body is XML`, async () => {
    const mock = mockFetch(
      new Response('<error>upstream failure</error>', {
        status,
        headers: {
          'Content-Type': 'text/xml',
          'Retry-After': '10',
          'X-RateLimit-Reset': '1792000000',
        },
      }),
    );
    await assert.rejects(
      new ScopusClient(config, mock.fetch).get(path, { query: 'test' }),
      (error: unknown) => {
        assert.ok(error instanceof ScopusError);
        assert.equal(error.status, status);
        assert.equal(error.code, `HTTP_${status}`);
        assert.equal(error.headers['Retry-After'], '10');
        assert.equal(error.headers['X-RateLimit-Reset'], '1792000000');
        assert.equal(error.message.includes('<error>'), false);
        return true;
      },
    );
    assert.equal(mock.requests.length, 1);
  });
}

await test('Elsevier JSON error messages are retained and credentials are redacted', async () => {
  const mock = mockFetch(
    Response.json(searchFixture('error'), { status: 400 }),
  );
  await assert.rejects(new ScopusClient(config, mock.fetch).get(path, {}), {
    code: 'INVALID_INPUT',
    message: 'Error translating query',
  });
  const echo = mockFetch(
    Response.json(
      {
        'error-response': {
          errorCode: `AUTH_${config.apiKey}`,
          errorMessage: `Invalid ${config.apiKey} / ${config.instToken}`,
        },
      },
      { status: 401 },
    ),
  );
  await assert.rejects(
    new ScopusClient(config, echo.fetch).get(path, {}),
    (error: unknown) => {
      assert.ok(error instanceof ScopusError);
      assert.equal(error.message, 'Invalid [REDACTED] / [REDACTED]');
      assert.equal(error.code, 'AUTH_[REDACTED]');
      return true;
    },
  );
});

await test('malformed success JSON and network failures are separate errors', async () => {
  const malformed = mockFetch(new Response('not json'));
  await assert.rejects(
    new ScopusClient(config, malformed.fetch).get(path, {}),
    { code: 'INVALID_RESPONSE' },
  );
  const network = mockFetch(() => {
    throw new Error(`socket error ${config.apiKey}`);
  });
  await assert.rejects(new ScopusClient(config, network.fetch).get(path, {}), {
    code: 'NETWORK_ERROR',
    message: 'Could not reach the Scopus API.',
  });
});

await test('timeout aborts the upstream request', async () => {
  const mock = mockFetch(async (request) => {
    await delay(1000, undefined, { signal: request.signal });
    return Response.json({});
  });
  await assert.rejects(new ScopusClient(config, mock.fetch, 10).get(path, {}), {
    code: 'TIMEOUT',
  });
  assert.equal(mock.requests[0]?.signal.aborted, true);
});

await test('cancellation is forwarded without exposing its reason', async () => {
  const controller = new AbortController();
  const mock = mockFetch(async (request) => {
    controller.abort(new Error(config.apiKey));
    await delay(1000, undefined, { signal: request.signal });
    return Response.json({});
  });
  await assert.rejects(
    new ScopusClient(config, mock.fetch).get(path, {}, controller.signal),
    {
      code: 'CANCELLED',
      message: 'Scopus request was cancelled.',
    },
  );
  assert.equal(mock.requests[0]?.signal.aborted, true);
});
