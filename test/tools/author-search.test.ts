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
} from '../../src/tools/author-search/schemas';
import { mockFetch } from '../helpers/mock-fetch';

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../fixtures/author-search/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as unknown;
}

async function connect(t: TestContext, upstream: ScopusClient) {
  const server = createServer(upstream);
  const client = new Client({ name: 'author-search-test', version: '1.0.0' });
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

await test('author search advertises native schemas and read-only annotations', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  const tool = tools.find((entry) => entry.name === 'author_search');
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.ok(tool.inputSchema.properties?.query);
  assert.ok(tool.inputSchema.properties?.['co-author']);
  assert.ok(
    tool.outputSchema?.properties &&
      Object.hasOwn(tool.outputSchema.properties, 'search-results'),
  );
  assert.equal(tool.inputSchema.properties?.apiKey, undefined);
  assert.equal(mock.requests.length, 0);
});

for (const name of ['success', 'empty']) {
  await test(`author search preserves the ${name} response and makes one JSON request`, async (t) => {
    const payload = fixture(name);
    const mock = mockFetch(
      Response.json(payload, { headers: { 'X-RateLimit-Remaining': '12' } }),
    );
    const client = await connect(
      t,
      new ScopusClient(
        { apiKey: 'test-key', instToken: 'test-token' },
        mock.fetch,
      ),
    );
    const result = await client.callTool({
      name: 'author_search',
      arguments: { query: 'AUTHLASTNAME(Smith)' },
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
    assert.equal(result.content.length, 1);
    const text = result.content[0];
    assert.ok(text?.type === 'text');
    assert.deepEqual(JSON.parse(text.text) as unknown, payload);
    assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
      'X-RateLimit-Remaining': '12',
    });
    assert.ok(outputSchema.safeParse(result.structuredContent).success);
    assert.equal(mock.requests.length, 1);
    const request = mock.requests[0];
    assert.ok(request);
    assert.equal(request.headers.get('Accept'), 'application/json');
    assert.equal(request.headers.get('X-ELS-APIKey'), 'test-key');
    assert.equal(request.headers.get('X-ELS-Insttoken'), 'test-token');
    const url = new URL(request.url);
    assert.equal(url.pathname, '/content/search/author');
    assert.equal(url.searchParams.get('view'), 'STANDARD');
    assert.equal(url.searchParams.get('count'), '25');
    assert.equal(url.searchParams.has('start'), false);
  });
}

await test('author search forwards every native parameter including co-author precedence', async (t) => {
  const mock = mockFetch(Response.json({ 'search-results': { entry: [] } }));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const input = {
    query: 'AUTHLASTNAME(Коваль) OR AUTHLASTNAME(A&B)',
    'co-author': '7000000001',
    view: 'STANDARD',
    count: 10,
    start: 20,
    field: 'identifier,preferred-name',
    sort: '-document-count,+surname',
    facets: 'affilcountry(count=10,sort=fd);active',
    alias: false,
    suppressNavLinks: true,
    reqId: 'author-search-request',
    ver: 'subjexpand,facetexpand',
  };
  const result = await client.callTool({
    name: 'author_search',
    arguments: input,
  });
  assert.notEqual(result.isError, true);
  assert.equal(mock.requests.length, 1);
  const params = new URL(mock.requests[0]?.url ?? '').searchParams;
  assert.deepEqual(
    Object.fromEntries(params),
    Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, String(value)]),
    ),
  );
});

await test('co-author alone is valid and does not invent a query', async (t) => {
  const mock = mockFetch(Response.json({ 'search-results': { entry: [] } }));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'author_search',
    arguments: { 'co-author': '7000000001' },
  });
  assert.notEqual(result.isError, true);
  assert.equal(mock.requests.length, 1);
  const params = new URL(mock.requests[0]?.url ?? '').searchParams;
  assert.equal(params.get('co-author'), '7000000001');
  assert.equal(params.has('query'), false);
});

await test('author field selections retain partial, null and variable subject data', async (t) => {
  const payload = {
    'search-results': {
      entry: [
        {
          'dc:identifier': 'AUTHOR_ID:1',
          'preferred-name': null,
          'name-variant': null,
          'affiliation-current': null,
          subject: null,
          'subject-area': null,
        },
        {
          'preferred-name': { surname: 'Test' },
          'affiliation-current': [
            { 'affiliation-id': '1', future: true },
            { 'affiliation-name': null },
          ],
          'subject-area': [{ '@code': '1700', $: 'Computer Science' }],
          future: { nested: [null] },
        },
        {},
      ],
    },
  };
  const mock = mockFetch(Response.json(payload));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'author_search',
    arguments: { query: 'test', field: 'identifier' },
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, payload);
  assert.equal(result.content.length, 1);
  const text = result.content[0];
  assert.ok(text?.type === 'text');
  assert.deepEqual(JSON.parse(text.text) as unknown, payload);
});

for (const input of [
  {},
  { query: '' },
  { query: '  ' },
  { 'co-author': '' },
  { 'co-author': '1,2' },
  { 'co-author': 'abc' },
  { query: 'test', count: -1 },
  { query: 'test', count: 201 },
  { query: 'test', count: 1.5 },
  { query: 'test', start: -1 },
  { query: 'test', start: 4999, count: 2 },
  { query: 'test', view: 'COMPLETE' },
  { query: 'test', cursor: '*' },
  { query: 'test', apiKey: 'forbidden' },
  { query: 'test', field: ' ' },
]) {
  await test(`author search rejects invalid input before HTTP: ${JSON.stringify(input)}`, async (t) => {
    const mock = mockFetch(Response.json({}));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    let rejected: boolean;
    try {
      rejected =
        (await client.callTool({ name: 'author_search', arguments: input }))
          .isError === true;
    } catch {
      rejected = true;
    }
    assert.ok(rejected);
    assert.equal(mock.requests.length, 0);
  });
}

await test('author search accepts exact pagination boundaries', () => {
  for (const args of [
    { query: 'test', count: 0 },
    { query: 'test', start: 4800, count: 200 },
    { 'co-author': '1', start: 4975 },
  ]) {
    assert.ok(inputSchema.safeParse(args).success);
  }
});

await test('author upstream failures preserve the common error and quota contract', async (t) => {
  const mock = mockFetch(
    Response.json(
      {
        'service-error': {
          status: {
            statusCode: 'QUOTA_EXCEEDED',
            statusText: 'Quota exceeded',
          },
        },
      },
      { status: 429, headers: { 'Retry-After': '60' } },
    ),
  );
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'author_search',
    arguments: { query: 'test' },
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.deepEqual(result.content, [
    {
      type: 'text',
      text: JSON.stringify({
        code: 'QUOTA_EXCEEDED',
        message: 'Quota exceeded',
        status: 429,
      }),
    },
  ]);
  assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
    'Retry-After': '60',
  });
});

await test('author search rejects an unexpected successful response', async (t) => {
  const mock = mockFetch(Response.json({ unexpected: true }));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'author_search',
    arguments: { query: 'test' },
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
});
