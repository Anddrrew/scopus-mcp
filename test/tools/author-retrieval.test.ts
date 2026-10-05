import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from '../../src/server';
import { ScopusClient } from '../../src/scopus/client';
import {
  inputSchema,
  outputSchema,
} from '../../src/tools/author-retrieval/schemas';
import { mockFetch } from '../helpers/mock-fetch';

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../fixtures/author-retrieval/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as unknown;
}

async function connect(t: TestContext, upstream: ScopusClient) {
  const server = createServer(upstream);
  const client = new Client({
    name: 'author-retrieval-test',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

await test('author retrieval advertises identifiers, output envelopes, and read-only annotations', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  const tool = tools.find((item) => item.name === 'author_retrieval');
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.equal(tool.annotations?.idempotentHint, true);
  for (const key of ['author_id', 'eid', 'orcid']) {
    assert.ok(tool.inputSchema.properties?.[key]);
  }
  for (const key of [
    'author-retrieval-response',
    'author-retrieval-response-list',
  ]) {
    assert.ok(
      tool.outputSchema?.properties &&
        Object.hasOwn(tool.outputSchema.properties, key),
    );
  }
  assert.equal(tool.inputSchema.properties?.apiKey, undefined);
  assert.equal(mock.requests.length, 0);
});

for (const [name, input, pathname] of [
  [
    'single',
    { author_id: '1000000001' },
    '/content/author/author_id/1000000001',
  ],
  [
    'partial',
    { eid: '9-s2.0-1000000001', field: 'identifier' },
    '/content/author/eid/9-s2.0-1000000001',
  ],
  [
    'single',
    { orcid: '0000-0001-2345-6789' },
    '/content/author/orcid/0000-0001-2345-6789',
  ],
  ['batch', { author_id: '1000000001,1000000002' }, '/content/author'],
  ['batch', { eid: '9-s2.0-1000000001,9-s2.0-1000000002' }, '/content/author'],
] as const) {
  await test(`author retrieval preserves native JSON and routes ${JSON.stringify(input)}`, async (t) => {
    const payload = fixture(name);
    const mock = mockFetch(
      Response.json(payload, { headers: { 'X-RateLimit-Remaining': '15' } }),
    );
    const client = await connect(
      t,
      new ScopusClient(
        { apiKey: 'test-key', instToken: 'test-token' },
        mock.fetch,
      ),
    );
    const result = await client.callTool({
      name: 'author_retrieval',
      arguments: input,
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
    assert.deepEqual(result.content, [
      { type: 'text', text: JSON.stringify(payload) },
    ]);
    assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
      'X-RateLimit-Remaining': '15',
    });
    assert.ok(outputSchema.safeParse(result.structuredContent).success);
    assert.equal(mock.requests.length, 1);
    const request = mock.requests[0];
    assert.ok(request);
    const url = new URL(request.url);
    assert.equal(url.pathname, pathname);
    assert.equal(request.headers.get('Accept'), 'application/json');
    assert.equal(request.headers.get('X-ELS-APIKey'), 'test-key');
    assert.equal(request.headers.get('X-ELS-Insttoken'), 'test-token');
    if (pathname === '/content/author') {
      assert.deepEqual(Object.fromEntries(url.searchParams), input);
    } else {
      assert.equal(url.searchParams.has('author_id'), false);
      assert.equal(url.searchParams.has('eid'), false);
      assert.equal(url.searchParams.has('orcid'), false);
    }
  });
}

await test('author single and batch parameters retain their native names', async (t) => {
  const parameters = {
    view: 'DOCUMENTS',
    field: 'identifier',
    alias: false,
    startref: 0,
    refcount: 0,
    reqId: 'request-id',
    ver: 'new',
  };
  const mock = mockFetch(Response.json(fixture('partial')));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  await client.callTool({
    name: 'author_retrieval',
    arguments: { author_id: '1000000001', ...parameters },
  });
  assert.deepEqual(
    Object.fromEntries(new URL(mock.requests[0]?.url ?? '').searchParams),
    Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => [key, String(value)]),
    ),
  );
  const batchMock = mockFetch(Response.json(fixture('batch')));
  const batchClient = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, batchMock.fetch),
  );
  const batch = {
    author_id: '1,2',
    view: 'METRICS',
    field: 'identifier',
    reqId: 'batch-request',
    ver: 'new',
  };
  const result = await batchClient.callTool({
    name: 'author_retrieval',
    arguments: batch,
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(
    Object.fromEntries(new URL(batchMock.requests[0]?.url ?? '').searchParams),
    batch,
  );
});

await test('author identifiers are encoded as one path segment without invented format rules', async (t) => {
  const mock = mockFetch(Response.json(fixture('single')));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const id = 'value/../?x=1#fragment%2e\\value';
  const result = await client.callTool({
    name: 'author_retrieval',
    arguments: { author_id: id },
  });
  assert.notEqual(result.isError, true);
  const url = new URL(mock.requests[0]?.url ?? '');
  assert.equal(url.origin, 'https://api.elsevier.com');
  assert.equal(
    url.pathname,
    `/content/author/author_id/${encodeURIComponent(id)}`,
  );
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
});

await test('author schemas allow API-determined sizes and documented BASIC view', () => {
  assert.ok(inputSchema.safeParse({ author_id: '1', view: 'BASIC' }).success);
  assert.ok(
    inputSchema.safeParse({ author_id: '1', startref: 10000, refcount: 10000 })
      .success,
  );
  assert.ok(
    inputSchema.safeParse({
      author_id: Array.from({ length: 100 }, (_, i) => String(i)).join(','),
    }).success,
  );
});

for (const payload of [
  { 'author-retrieval-response': {} },
  { 'author-retrieval-response': null },
  { 'author-retrieval-response': [] },
  {
    'author-retrieval-response-list': {
      'author-retrieval-response': { '@status': 'not-found', coredata: null },
    },
  },
  { 'author-retrieval-response-list': { 'author-retrieval-response': [] } },
]) {
  await test(`author retrieval preserves partial response ${JSON.stringify(payload)}`, async (t) => {
    const mock = mockFetch(Response.json(payload));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    const result = await client.callTool({
      name: 'author_retrieval',
      arguments: { author_id: '1' },
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
  });
}

for (const input of [
  {},
  { author_id: '' },
  { author_id: '   ' },
  { author_id: '..' },
  { eid: '.' },
  { author_id: '1,,2' },
  { author_id: '1, ' },
  { author_id: '1', eid: '2' },
  { author_id: '1', orcid: '2' },
  { eid: '1', orcid: '2' },
  { orcid: '1,2' },
  { author_id: '1,2', view: 'DOCUMENTS' },
  { author_id: '1,2', alias: false },
  { eid: '1,2', startref: 0 },
  { eid: '1,2', refcount: 1 },
  { author_id: '1', startref: -1 },
  { author_id: '1', refcount: 1.5 },
  { author_id: '1', view: 'ORCID' },
  { author_id: '1', field: ' ' },
  { author_id: '1', apiKey: 'forbidden' },
]) {
  await test(`author retrieval rejects invalid input before HTTP ${JSON.stringify(input)}`, async (t) => {
    const mock = mockFetch(Response.json({}));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    let rejected: boolean;
    try {
      const result = await client.callTool({
        name: 'author_retrieval',
        arguments: input,
      });
      rejected = result.isError === true;
    } catch {
      rejected = true;
    }
    assert.ok(rejected);
    assert.equal(mock.requests.length, 0);
  });
}

await test('author retrieval retains upstream error and quota metadata', async (t) => {
  const mock = mockFetch(
    Response.json(fixture('error'), {
      status: 404,
      headers: { 'Retry-After': '3' },
    }),
  );
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'author_retrieval',
    arguments: { author_id: '1' },
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.deepEqual(result.content, [
    {
      type: 'text',
      text: JSON.stringify({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Author not found',
        status: 404,
      }),
    },
  ]);
  assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
    'Retry-After': '3',
  });
});

for (const payload of [
  { unexpected: true },
  { 'author-retrieval-response': 'bad' },
  { 'author-retrieval-response-list': [] },
]) {
  await test(`author retrieval rejects wrong success shape ${JSON.stringify(payload)}`, async (t) => {
    const mock = mockFetch(Response.json(payload));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    const result = await client.callTool({
      name: 'author_retrieval',
      arguments: { author_id: '1' },
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
  });
}
