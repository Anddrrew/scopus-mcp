import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import {
  fromJsonSchema,
  InMemoryTransport,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';
import { validateSchema } from '../../src/schemas/schema';
import { createServer } from '../../src/server';
import { ScopusClient } from '../../src/scopus/client';
import { mockFetch } from '../helpers/mock-fetch';

const fixture = JSON.parse(
  readFileSync(
    new URL('../fixtures/citation-overview/success.json', import.meta.url),
    'utf8',
  ),
) as unknown;

async function connect(t: TestContext, reply: Response, apiKey = 'test-key') {
  const mock = mockFetch(reply);
  const server = createServer(new ScopusClient({ apiKey }, mock.fetch));
  const client = new Client({ name: 'citation-test', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, mock };
}

await test('citation overview advertises native schemas and read-only annotations', async (t) => {
  const { client, mock } = await connect(t, Response.json({}));
  const { tools } = await client.listTools();
  const tool = tools.find(
    (candidate) => candidate.name === 'citation_overview',
  );
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.ok(tool.inputSchema.properties?.scopus_id);
  assert.equal(tool.inputSchema.properties?.apiKey, undefined);
  assert.ok(
    tool.outputSchema?.properties &&
      Object.hasOwn(
        tool.outputSchema.properties,
        'abstract-citations-response',
      ),
  );
  assert.equal(mock.requests.length, 0);
});

await test('citation overview makes one request and preserves native multi-document output and metadata', async (t) => {
  const { client, mock } = await connect(
    t,
    Response.json(fixture, { headers: { 'X-RateLimit-Remaining': '17' } }),
  );
  const input = {
    scopus_id: '1000000001,1000000002',
    author_id: '2000000001,2000000002',
    date: '2020-2025',
    citation: 'exclude-self',
    view: 'STANDARD',
    start: 0,
    count: 2,
    field: 'identifier,cc,rowTotal',
    sort: '-rowTotal',
    reqId: 'test-request',
    ver: '1',
  };
  const result = await client.callTool({
    name: 'citation_overview',
    arguments: input,
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, fixture);
  assert.equal(result.content.length, 1);
  const text = result.content[0];
  assert.ok(text?.type === 'text');
  assert.deepEqual(JSON.parse(text.text) as unknown, fixture);
  assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
    'X-RateLimit-Remaining': '17',
  });
  assert.equal(mock.requests.length, 1);
  const request = mock.requests[0];
  assert.ok(request);
  assert.equal(request.method, 'GET');
  assert.equal(request.headers.get('Accept'), 'application/json');
  assert.equal(request.headers.get('X-ELS-APIKey'), 'test-key');
  const url = new URL(request.url);
  assert.equal(url.pathname, '/content/abstract/citations');
  assert.deepEqual(
    Object.fromEntries(url.searchParams),
    Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, String(value)]),
    ),
  );
});

for (const [key, value] of Object.entries({
  doi: '10.1234/a?x=1&y=2,10.1234/b',
  pii: 'S0000000000000001,S0000000000000002',
  pubmed_id: '10000001,10000002',
})) {
  await test(`citation overview forwards ${key} without changing identifier content`, async (t) => {
    const { client, mock } = await connect(
      t,
      Response.json({ 'abstract-citations-response': {} }),
    );
    const result = await client.callTool({
      name: 'citation_overview',
      arguments: { [key]: value },
    });
    assert.notEqual(result.isError, true);
    assert.equal(mock.requests.length, 1);
    assert.deepEqual(
      Object.fromEntries(new URL(mock.requests[0]?.url ?? '').searchParams),
      { [key]: value },
    );
  });
}

for (const payload of [
  { 'abstract-citations-response': {} },
  {
    'abstract-citations-response': {
      'h-index': null,
      'identifier-legend': null,
      citeInfoMatrix: null,
      citeColumnTotalXML: null,
    },
  },
  {
    'abstract-citations-response': {
      'identifier-legend': {
        identifier: { scopus_id: '1000000001', extra: null },
      },
      citeInfoMatrix: {
        citeInfoMatrixXML: {
          citationMatrix: {
            citeInfo: {
              'dc:title': null,
              author: { surname: 'Example' },
              cc: { $: '0', '@year': '2025' },
              rowTotal: '0',
            },
          },
        },
      },
      citeColumnTotalXML: {
        citeCountHeader: {
          columnHeading: { $: '2025' },
          columnTotal: { $: '0' },
        },
      },
    },
  },
  {
    'abstract-citations-response': {
      citeInfoMatrix: {
        citeInfoMatrixXML: { citationMatrix: { citeInfo: [] } },
      },
    },
  },
]) {
  await test('citation overview preserves partial, null, singleton and empty collections', async (t) => {
    const { client } = await connect(t, Response.json(payload));
    const result = await client.callTool({
      name: 'citation_overview',
      arguments: { scopus_id: '1000000001', field: 'cc' },
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
  });
}

for (const args of [
  {},
  { scopus_id: '' },
  { scopus_id: '  ' },
  { scopus_id: '1,,2' },
  { scopus_id: '1, \t,2' },
  { scopus_id: ',1' },
  { scopus_id: '1,' },
  { scopus_id: '1', doi: '10.1234/test' },
  { scopus_id: '1', doi: '10.1234/test', pii: 'S1', pubmed_id: '2' },
  { author_id: '2' },
  { scopus_id: '1', count: -1 },
  { scopus_id: '1', count: 1.5 },
  { scopus_id: '1', start: -1 },
  { scopus_id: '1', start: Number.MAX_SAFE_INTEGER + 1 },
  { scopus_id: '1', count: Number.MAX_SAFE_INTEGER + 1 },
  { scopus_id: '1', citation: 'all' },
  { scopus_id: '1', view: 'FULL' },
  { scopus_id: '1', sort: 'rowTotal,sort-year' },
  { scopus_id: '1', apiKey: 'secret' },
  { scopus_id: '1', httpAccept: 'text/xml' },
]) {
  await test(`citation overview rejects invalid input before HTTP: ${JSON.stringify(args)}`, async (t) => {
    const { client, mock } = await connect(t, Response.json({}));
    const result = await client.callTool({
      name: 'citation_overview',
      arguments: args,
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /Input validation error/);
    assert.equal(mock.requests.length, 0);
  });
}

await test('citation overview publishes identifier selection and list constraints to clients', async (t) => {
  const { client, mock } = await connect(t, Response.json({}));
  const { tools } = await client.listTools();
  const tool = tools.find(
    (candidate) => candidate.name === 'citation_overview',
  );
  assert.ok(tool);
  const schema = fromJsonSchema(tool.inputSchema as JsonSchemaType);

  for (const value of [
    { scopus_id: ' 1 , 2 ' },
    { doi: '10.1234/a?query=1&x=2,10.1234/b' },
    { pii: 'S1' },
    { pubmed_id: '1', author_id: '2, 3', start: 0, count: 0 },
  ]) {
    const result = await validateSchema(schema, value);
    assert.equal(result.issues, undefined, JSON.stringify(value));
    assert.deepEqual(result.value, value);
  }
  for (const value of [
    {},
    { author_id: '1' },
    { scopus_id: '1', pubmed_id: '2' },
    { scopus_id: '1,\n\t,2' },
    { doi: '10.1234/a', author_id: '2,' },
    { pii: 'S1', count: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const result = await validateSchema(schema, value);
    assert.ok(result.issues, JSON.stringify(value));
  }
  assert.equal(mock.requests.length, 0);
});

for (const status of [403, 429]) {
  await test(`citation overview retains upstream ${status} error and quota headers`, async (t) => {
    const { client, mock } = await connect(
      t,
      Response.json(
        {
          'service-error': {
            status: {
              statusCode: 'UPSTREAM_ERROR',
              statusText: 'Synthetic upstream failure',
            },
          },
        },
        { status, headers: { 'Retry-After': '30' } },
      ),
    );
    const result = await client.callTool({
      name: 'citation_overview',
      arguments: { scopus_id: '1' },
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.deepEqual(result.content, [
      {
        type: 'text',
        text: JSON.stringify({
          code: 'UPSTREAM_ERROR',
          message: 'Synthetic upstream failure',
          status,
        }),
      },
    ]);
    assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
      'Retry-After': '30',
    });
    assert.equal(mock.requests.length, 1);
  });
}

for (const payload of [
  { unexpected: true },
  { 'abstract-citations-response': null },
  { 'abstract-citations-response': { 'h-index': 3 } },
]) {
  await test('citation overview rejects invalid successful response shapes', async (t) => {
    const { client } = await connect(t, Response.json(payload));
    const result = await client.callTool({
      name: 'citation_overview',
      arguments: { scopus_id: '1' },
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
  });
}
