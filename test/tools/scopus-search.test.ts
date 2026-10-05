import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from '../../src/server.js';
import { ScopusClient } from '../../src/scopus/client.js';
import { inputSchema, outputSchema } from '../../src/tools/scopus-search/schemas.js';
import { searchFixture } from '../helpers/fixtures.js';
import { mockFetch } from '../helpers/mock-fetch.js';

async function connect(t: TestContext, upstream: ScopusClient) {
  const server = createServer(upstream);
  const client = new Client({ name: 'scopus-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

await test('MCP advertises the native input/output schemas and read-only annotation', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  assert.equal(tools.length, 1);
  const tool = tools[0];
  assert.ok(tool);
  assert.equal(tool.name, 'scopus_search');
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.ok(tool.inputSchema.properties?.query);
  assert.ok(tool.outputSchema?.properties && Object.hasOwn(tool.outputSchema.properties, 'search-results'));
  assert.equal(tool.inputSchema.properties?.apiKey, undefined);
  assert.equal(mock.requests.length, 0);
});

for (const name of ['success', 'empty']) {
  await test(`MCP preserves the ${name} payload, including unknown fields and string numbers`, async (t) => {
    const payload = searchFixture(name);
    const mock = mockFetch(Response.json(payload, { headers: { 'X-RateLimit-Remaining': '123' } }));
    const client = await connect(t, new ScopusClient({ apiKey: 'test' }, mock.fetch));
    const result = await client.callTool({ name: 'scopus_search', arguments: { query: 'TITLE-ABS-KEY(machine learning)', cursor: '*' } });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
    assert.equal(result.content.length, 1);
    const text = result.content[0];
    assert.ok(text?.type === 'text');
    assert.deepEqual(JSON.parse(text.text) as unknown, payload);
    assert.deepEqual(result._meta?.['scopus-mcp/headers'], { 'X-RateLimit-Remaining': '123' });
    assert.ok(outputSchema.safeParse(result.structuredContent).success);
    assert.equal(mock.requests.length, 1);
    const params = new URL(mock.requests[0]?.url ?? '').searchParams;
    assert.equal(params.get('view'), 'STANDARD');
    assert.equal(params.get('count'), '25');
    assert.equal(params.get('cursor'), '*');
    assert.equal(params.has('start'), false);
  });
}

await test('all supported API parameters are forwarded with their original names', async (t) => {
  const mock = mockFetch(Response.json({ 'search-results': { entry: [] } }));
  const client = await connect(t, new ScopusClient({ apiKey: 'test' }, mock.fetch));
  const input = {
    query: 'AU-ID(1000000001)', view: 'COMPLETE', count: 10, start: 0, date: '2020-2026',
    sort: '-coverDate,+creator', field: 'identifier,title', subj: 'COMP',
    facets: 'pubyear;subjarea(count=10,sort=fd)', content: 'core', alias: false,
    suppressNavLinks: true, reqId: 'test-request', ver: 'new,facetexpand',
  };
  const result = await client.callTool({ name: 'scopus_search', arguments: input });
  assert.notEqual(result.isError, true);
  const params = new URL(mock.requests[0]?.url ?? '').searchParams;
  assert.deepEqual(Object.fromEntries(params), Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)])));
});

await test('field-selected and partial responses do not acquire missing fields', async (t) => {
  const payload = { 'search-results': { entry: [{ 'dc:title': 'Only a title', 'prism:doi': null }] } };
  const mock = mockFetch(Response.json(payload));
  const client = await connect(t, new ScopusClient({ apiKey: 'test' }, mock.fetch));
  const result = await client.callTool({ name: 'scopus_search', arguments: { query: 'test', field: 'title' } });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, payload);
});

for (const input of [
  {}, { query: '' }, { query: '  ' }, { query: 'test', count: -1 },
  { query: 'test', count: 201 }, { query: 'test', count: 1.5 }, { query: 'test', start: -1 },
  { query: 'test', view: 'UNKNOWN' }, { query: 'test', view: 'COMPLETE', count: 26 },
  { query: 'test', view: 'COMPONENT', count: 26 }, { query: 'test', cursor: '*', start: 0 },
  { query: 'test', start: 4999, count: 2 }, { query: 'test', apiKey: 'do-not-accept' },
]) {
  await test(`invalid input is rejected before HTTP: ${JSON.stringify(input)}`, async (t) => {
    const mock = mockFetch(Response.json({}));
    const client = await connect(t, new ScopusClient({ apiKey: 'test' }, mock.fetch));
    // SDK validation may report a protocol error or an isError tool result, depending on the negotiated revision.
    let rejected: boolean;
    try {
      const result = await client.callTool({ name: 'scopus_search', arguments: input });
      rejected = result.isError === true;
    } catch {
      rejected = true;
    }
    assert.ok(rejected);
    assert.equal(mock.requests.length, 0);
  });
}

await test('pagination bounds and field overrides do not reject valid requests', () => {
  for (const args of [
    { query: 'test', start: 4800, count: 200 },
    { query: 'test', count: 0 },
    { query: 'test', cursor: 'next+/==', count: 200 },
    { query: 'test', view: 'COMPLETE', count: 25 },
    { query: 'test', view: 'COMPONENT', count: 25 },
    { query: 'test', view: 'COMPLETE', field: 'title', count: 100 },
  ]) assert.ok(inputSchema.safeParse(args).success);
});

await test('upstream failures are MCP tool errors, not successful search payloads', async (t) => {
  const mock = mockFetch(Response.json(searchFixture('error'), { status: 400 }));
  const client = await connect(t, new ScopusClient({ apiKey: 'test' }, mock.fetch));
  const result = await client.callTool({ name: 'scopus_search', arguments: { query: 'invalid(' } });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.deepEqual(result.content, [{ type: 'text', text: JSON.stringify({ code: 'INVALID_INPUT', message: 'Error translating query', status: 400 }) }]);
});

await test('HTTP 200 with a wrong payload fails output validation', async (t) => {
  const mock = mockFetch(Response.json({ unexpected: true }));
  const client = await connect(t, new ScopusClient({ apiKey: 'test' }, mock.fetch));
  const result = await client.callTool({ name: 'scopus_search', arguments: { query: 'test' } });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
});
