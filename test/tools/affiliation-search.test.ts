import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { validateSchema } from '../../src/schemas/schema';
import { createServer } from '../../src/server';
import { ScopusClient } from '../../src/scopus/client';
import {
  inputSchema,
  outputSchema,
} from '../../src/tools/affiliation-search/schemas';
import { mockFetch } from '../helpers/mock-fetch';

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../fixtures/affiliation-search/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as unknown;
}

async function connect(t: TestContext, upstream: ScopusClient) {
  const server = createServer(upstream);
  const client = new Client({
    name: 'affiliation-search-test',
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

await test('affiliation search advertises native schemas and read-only annotations', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  const tool = tools.find((entry) => entry.name === 'affiliation_search');
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.ok(tool.inputSchema.properties?.query);
  assert.ok(
    tool.outputSchema?.properties &&
      Object.hasOwn(tool.outputSchema.properties, 'search-results'),
  );
  assert.equal(tool.inputSchema.properties?.apiKey, undefined);
  assert.equal(mock.requests.length, 0);
});

for (const name of ['success', 'empty']) {
  await test(`affiliation search preserves the ${name} response and makes one JSON request`, async (t) => {
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
      name: 'affiliation_search',
      arguments: { query: 'AFFIL(university)' },
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
    assert.equal(
      (await validateSchema(outputSchema, result.structuredContent)).issues,
      undefined,
    );
    assert.equal(mock.requests.length, 1);
    const request = mock.requests[0];
    assert.ok(request);
    assert.equal(request.headers.get('Accept'), 'application/json');
    assert.equal(request.headers.get('X-ELS-APIKey'), 'test-key');
    assert.equal(request.headers.get('X-ELS-Insttoken'), 'test-token');
    const url = new URL(request.url);
    assert.equal(url.pathname, '/content/search/affiliation');
    assert.equal(url.searchParams.get('view'), 'STANDARD');
    assert.equal(url.searchParams.get('count'), '25');
    assert.equal(url.searchParams.has('start'), false);
  });
}

await test('affiliation search forwards every native parameter and query characters', async (t) => {
  const mock = mockFetch(Response.json({ 'search-results': { entry: [] } }));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const input = {
    query: 'AFFIL(Київ) OR AFFIL(A&B)',
    view: 'STANDARD',
    count: 10,
    start: 20,
    field: 'identifier,affiliation-name',
    sort: '-document-count,+affiliation-name',
    facets: 'affilcountry(count=10,sort=fd);affilcity',
    suppressNavLinks: true,
    reqId: 'affiliation-search-request',
    ver: 'new,facetexpand',
  };
  const result = await client.callTool({
    name: 'affiliation_search',
    arguments: input,
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    'search-results': { entry: [] },
  });
  assert.equal(mock.requests.length, 1);
  const params = new URL(mock.requests[0]?.url ?? '').searchParams;
  assert.deepEqual(
    Object.fromEntries(params),
    Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, String(value)]),
    ),
  );
});

await test('affiliation field selections retain missing fields, nulls and unknown nested data', async (t) => {
  const payload = {
    'search-results': {
      entry: [
        {
          'dc:identifier': 'AFFILIATION_ID:1',
          'name-variant': null,
          'parent-affiliation-id': null,
          city: null,
          country: null,
        },
        {
          'name-variant': [
            { $: 'Example University', future: { nested: [null] } },
          ],
          'affiliation-name': 'Example University',
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
    name: 'affiliation_search',
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
  { query: 'test', count: null },
  { query: 'test', count: '25' },
  { query: 'test', view: null },
  { query: 'test', start: 4976 },
  { query: 'test', count: -1 },
  { query: 'test', count: 201 },
  { query: 'test', count: 1.5 },
  { query: 'test', start: -1 },
  { query: 'test', start: 4999, count: 2 },
  { query: 'test', view: 'COMPLETE' },
  { query: 'test', cursor: '*' },
  { query: 'test', apiKey: 'forbidden' },
  { query: 'test', field: ' ' },
  { query: 'test', 'co-author': '1' },
  { query: 'test', alias: false },
]) {
  await test(`affiliation search rejects invalid input before HTTP: ${JSON.stringify(input)}`, async (t) => {
    const mock = mockFetch(Response.json({}));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    const result = await client.callTool({
      name: 'affiliation_search',
      arguments: input,
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /Input validation error/);
    assert.equal(mock.requests.length, 0);
  });
}

await test('affiliation search accepts exact pagination boundaries', async () => {
  for (const args of [
    { query: 'test', count: 0 },
    { query: 'test', start: 5000, count: 0 },
    { query: 'test', start: 4975 },
    { query: 'test', start: 4800, count: 200 },
  ]) {
    assert.equal((await validateSchema(inputSchema, args)).issues, undefined);
  }
});

await test('affiliation upstream failures preserve the common error and quota contract', async (t) => {
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
    name: 'affiliation_search',
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

await test('affiliation search rejects an unexpected successful response', async (t) => {
  const mock = mockFetch(Response.json({ unexpected: true }));
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const result = await client.callTool({
    name: 'affiliation_search',
    arguments: { query: 'test' },
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
});

for (const [field, payload] of Object.entries({
  count: { 'search-results': { 'opensearch:totalResults': 12 } },
  identifier: { 'search-results': { entry: [{ 'dc:identifier': false }] } },
  links: { 'search-results': { entry: [{ link: 'invalid-link-list' }] } },
})) {
  await test(`affiliation-search rejects a malformed native ${field} field`, async (t) => {
    const mock = mockFetch(Response.json(payload));
    const client = await connect(
      t,
      new ScopusClient({ apiKey: 'test' }, mock.fetch),
    );
    const result = await client.callTool({
      name: 'affiliation_search',
      arguments: { query: 'test' },
    });
    assert.equal(mock.requests.length, 1);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
  });
}
