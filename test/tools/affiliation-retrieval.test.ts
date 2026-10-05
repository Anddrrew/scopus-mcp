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
} from '../../src/tools/affiliation-retrieval/schemas';
import { mockFetch } from '../helpers/mock-fetch';

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(
        `../fixtures/affiliation-retrieval/${name}.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  ) as unknown;
}

async function connect(t: TestContext, upstream: ScopusClient) {
  const server = createServer(upstream);
  const client = new Client({
    name: 'affiliation-retrieval-test',
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

await test('affiliation retrieval advertises native parameters and a read-only JSON output schema', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  const tool = tools.find((item) => item.name === 'affiliation_retrieval');
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.equal(tool.annotations?.idempotentHint, true);
  assert.ok(tool.inputSchema.properties?.affiliation_id);
  assert.ok(tool.inputSchema.properties?.eid);
  assert.ok(
    tool.outputSchema?.properties &&
      Object.hasOwn(
        tool.outputSchema.properties,
        'affiliation-retrieval-response',
      ),
  );
  assert.equal(tool.inputSchema.properties?.apiKey, undefined);
  assert.equal(mock.requests.length, 0);
});

for (const [name, input, pathname] of [
  [
    'single',
    { affiliation_id: '60000001' },
    '/content/affiliation/affiliation_id/60000001',
  ],
  [
    'documents',
    { eid: '10-s2.0-60000001', view: 'DOCUMENTS' },
    '/content/affiliation/eid/10-s2.0-60000001',
  ],
  [
    'authors',
    { affiliation_id: '60000001', view: 'AUTHORS' },
    '/content/affiliation/affiliation_id/60000001',
  ],
] as const) {
  await test(`affiliation retrieval preserves ${name} JSON and identifier routing`, async (t) => {
    const payload = fixture(name);
    const mock = mockFetch(
      Response.json(payload, { headers: { 'X-RateLimit-Remaining': '14' } }),
    );
    const client = await connect(
      t,
      new ScopusClient(
        { apiKey: 'test-key', instToken: 'test-token' },
        mock.fetch,
      ),
    );
    const result = await client.callTool({
      name: 'affiliation_retrieval',
      arguments: input,
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
    assert.deepEqual(result.content, [
      { type: 'text', text: JSON.stringify(payload) },
    ]);
    assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
      'X-RateLimit-Remaining': '14',
    });
    assert.ok(outputSchema.safeParse(result.structuredContent).success);
    assert.equal(mock.requests.length, 1);
    const request = mock.requests[0];
    assert.ok(request);
    const url = new URL(request.url);
    assert.equal(url.pathname, pathname);
    assert.equal(url.searchParams.has('affiliation_id'), false);
    assert.equal(url.searchParams.has('eid'), false);
    assert.equal(request.headers.get('Accept'), 'application/json');
    assert.equal(request.headers.get('X-ELS-APIKey'), 'test-key');
    assert.equal(request.headers.get('X-ELS-Insttoken'), 'test-token');
  });
}

await test('affiliation retrieval forwards all API parameters under their original names', async (t) => {
  const parameters = {
    view: 'STANDARD',
    field: 'identifier',
    startref: 0,
    refcount: 0,
    reqId: 'request-id',
    ver: 'new',
  };
  const mock = mockFetch(Response.json(fixture('single')));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'affiliation_retrieval',
    arguments: { affiliation_id: '60000001', ...parameters },
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(
    Object.fromEntries(new URL(mock.requests[0]?.url ?? '').searchParams),
    Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => [key, String(value)]),
    ),
  );
});

await test('affiliation identifiers remain within one encoded path segment', async (t) => {
  const mock = mockFetch(Response.json(fixture('single')));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const id = 'value/../?x=1#fragment%2e\\value';
  const result = await client.callTool({
    name: 'affiliation_retrieval',
    arguments: { affiliation_id: id },
  });
  assert.notEqual(result.isError, true);
  const url = new URL(mock.requests[0]?.url ?? '');
  assert.equal(url.origin, 'https://api.elsevier.com');
  assert.equal(
    url.pathname,
    `/content/affiliation/affiliation_id/${encodeURIComponent(id)}`,
  );
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
});

await test('affiliation retrieval supports BASIC and leaves service limits to Elsevier', () => {
  assert.ok(
    inputSchema.safeParse({ affiliation_id: '60000001', view: 'BASIC' })
      .success,
  );
  assert.ok(
    inputSchema.safeParse({
      affiliation_id: '60000001',
      startref: 10000,
      refcount: 10000,
    }).success,
  );
});

for (const payload of [
  { 'affiliation-retrieval-response': {} },
  { 'affiliation-retrieval-response': null },
  { 'affiliation-retrieval-response': [] },
  {
    'affiliation-retrieval-response': {
      coredata: { 'dc:identifier': 'AFFILIATION_ID:60000001' },
      'affiliation-name': null,
    },
  },
  {
    'affiliation-retrieval-response': {
      documents: { '@count': '0', document: null },
      'future-field': [{ nested: [1, '2', null] }],
    },
  },
]) {
  await test(`affiliation retrieval preserves partial and empty responses ${JSON.stringify(payload)}`, async (t) => {
    const mock = mockFetch(Response.json(payload));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    const result = await client.callTool({
      name: 'affiliation_retrieval',
      arguments: { affiliation_id: '60000001' },
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
  });
}

for (const input of [
  {},
  { affiliation_id: '' },
  { affiliation_id: ' ' },
  { affiliation_id: '..' },
  { eid: '.' },
  { affiliation_id: '1,2' },
  { eid: '1,2' },
  { affiliation_id: '1', eid: '2' },
  { affiliation_id: '1', view: 'UNKNOWN' },
  { affiliation_id: '1', view: 'DOCUMENTS', field: 'title' },
  { affiliation_id: '1', view: 'AUTHORS', field: 'identifier' },
  { affiliation_id: '1', startref: -1 },
  { affiliation_id: '1', refcount: 1.5 },
  { affiliation_id: '1', field: ' ' },
  { affiliation_id: '1', alias: false },
  { affiliation_id: '1', apiKey: 'forbidden' },
]) {
  await test(`affiliation retrieval rejects invalid input before HTTP ${JSON.stringify(input)}`, async (t) => {
    const mock = mockFetch(Response.json({}));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    let rejected: boolean;
    try {
      const result = await client.callTool({
        name: 'affiliation_retrieval',
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

await test('affiliation retrieval retains upstream errors and quota metadata', async (t) => {
  const mock = mockFetch(
    Response.json(fixture('error'), {
      status: 404,
      headers: { 'Retry-After': '4' },
    }),
  );
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'affiliation_retrieval',
    arguments: { affiliation_id: '1' },
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.deepEqual(result.content, [
    {
      type: 'text',
      text: JSON.stringify({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Affiliation not found',
        status: 404,
      }),
    },
  ]);
  assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
    'Retry-After': '4',
  });
});

for (const payload of [
  { unexpected: true },
  { 'affiliation-retrieval-response': 'bad' },
  { 'affiliation-retrieval-response': 123 },
]) {
  await test(`affiliation retrieval rejects wrong success shape ${JSON.stringify(payload)}`, async (t) => {
    const mock = mockFetch(Response.json(payload));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    const result = await client.callTool({
      name: 'affiliation_retrieval',
      arguments: { affiliation_id: '1' },
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
  });
}
