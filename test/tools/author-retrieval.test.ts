import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import {
  fromJsonSchema,
  type JsonSchemaType,
  InMemoryTransport,
} from '@modelcontextprotocol/server';
import { createServer } from '../../src/server';
import { ScopusClient } from '../../src/scopus/client';
import { validateSchema } from '../../src/schemas/schema';
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

await test('published author schema enforces identifier choice and batch restrictions without server refinements', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  const tool = tools.find((item) => item.name === 'author_retrieval');
  assert.ok(tool);
  const published = fromJsonSchema(tool.inputSchema as JsonSchemaType);

  for (const input of [
    {
      author_id: '1',
      view: 'DOCUMENTS',
      alias: false,
      startref: 0,
      refcount: 0,
    },
    { eid: '9-s2.0-1,9-s2.0-2', view: 'METRICS', field: 'identifier' },
    { orcid: '0000-0001-2345-6789' },
    { author_id: ' 1 , 2 ' },
    { author_id: '. .' },
  ]) {
    assert.equal(
      (await validateSchema(published, input)).issues,
      undefined,
      JSON.stringify(input),
    );
  }

  for (const input of [
    {},
    { author_id: '1', eid: '2' },
    { author_id: '1', eid: '2', orcid: '3' },
    { orcid: '1,2' },
    { author_id: '1, .. ,2' },
    { author_id: '1,2', view: 'DOCUMENTS' },
    { eid: '1,2', alias: true },
    { author_id: '1,2', startref: 0 },
    { eid: '1,2', refcount: 0 },
  ]) {
    assert.ok(
      (await validateSchema(published, input)).issues,
      JSON.stringify(input),
    );
  }

  assert.ok(tool.outputSchema);
  const publishedOutput = fromJsonSchema(tool.outputSchema as JsonSchemaType);
  assert.ok((await validateSchema(publishedOutput, {})).issues);
  for (const output of [
    { 'author-retrieval-response': null },
    { 'author-retrieval-response-list': null },
    { 'author-retrieval-response': {}, 'author-retrieval-response-list': {} },
  ]) {
    assert.equal(
      (await validateSchema(publishedOutput, output)).issues,
      undefined,
    );
  }
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
    assert.equal(
      (await validateSchema(outputSchema, result.structuredContent)).issues,
      undefined,
    );
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

await test('author schemas allow API-determined sizes and documented BASIC view', async () => {
  for (const input of [
    { author_id: '1', view: 'BASIC' },
    { author_id: '1', startref: 10000, refcount: 10000 },
    { author_id: Array.from({ length: 100 }, (_, i) => String(i)).join(',') },
  ]) {
    assert.equal((await validateSchema(inputSchema, input)).issues, undefined);
  }
});

await test('author identifiers preserve padded values and reject blank or dot-only segments', async () => {
  const padding = ' '.repeat(20_000);
  for (const key of ['author_id', 'eid', 'orcid']) {
    const input = { [key]: `${padding}1${padding}` };
    assert.deepEqual(await validateSchema(inputSchema, input), {
      value: input,
    });
    for (const value of [padding, `${padding}..${padding}`]) {
      assert.ok((await validateSchema(inputSchema, { [key]: value })).issues);
    }
  }
  for (const key of ['author_id', 'eid']) {
    const input = { [key]: `${padding}1,${padding}2` };
    assert.deepEqual(await validateSchema(inputSchema, input), {
      value: input,
    });
    for (const value of [`1,${padding}`, `1,${padding}..${padding},2`]) {
      assert.ok((await validateSchema(inputSchema, { [key]: value })).issues);
    }
  }
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
  { author_id: ' .. ' },
  { eid: '.' },
  { author_id: '1,,2' },
  { author_id: '1, ' },
  { author_id: '1, .. ,2' },
  { eid: ',1' },
  { orcid: ' \t' },
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
  { author_id: '1', refcount: Number.MAX_SAFE_INTEGER + 1 },
  { author_id: '1', startref: Number.MAX_SAFE_INTEGER + 1 },
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
    const result = await client.callTool({
      name: 'author_retrieval',
      arguments: input,
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /Input validation error/);
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

await test('author profile redirection is an HTTP_301 tool error without an additional request', async (t) => {
  const mock = mockFetch((request) => {
    assert.equal(request.redirect, 'manual');
    return new Response('', {
      status: 301,
      headers: {
        Location: 'https://api.elsevier.com/content/author/author_id/2',
      },
    });
  });
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
        code: 'HTTP_301',
        message: 'Scopus request failed (HTTP 301).',
        status: 301,
      }),
    },
  ]);
  assert.equal(mock.requests.length, 1);
});
