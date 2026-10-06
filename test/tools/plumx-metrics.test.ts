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
    new URL('../fixtures/plumx-metrics/success.json', import.meta.url),
    'utf8',
  ),
) as unknown;
const input = { idType: 'doi', idValue: '10.1234/synthetic-example' };

async function connect(t: TestContext, reply: Response) {
  const mock = mockFetch(reply);
  const server = createServer(
    new ScopusClient(
      { apiKey: 'test-key', instToken: 'test-token' },
      mock.fetch,
    ),
  );
  const client = new Client({ name: 'plumx-test', version: '1.0.0' });
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

await test('PlumX advertises native path inputs and structured output', async (t) => {
  const { client, mock } = await connect(t, Response.json({}));
  const { tools } = await client.listTools();
  const tool = tools.find((candidate) => candidate.name === 'plumx_metrics');
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.ok(tool.inputSchema.properties?.idType);
  assert.ok(tool.inputSchema.properties?.idValue);
  assert.equal(tool.inputSchema.properties?.apiKey, undefined);
  assert.ok(
    tool.outputSchema?.properties &&
      Object.hasOwn(tool.outputSchema.properties, 'count_categories'),
  );
  assert.equal(mock.requests.length, 0);
});

await test('PlumX sends one JSON GET and preserves native metrics and quota headers', async (t) => {
  const { client, mock } = await connect(
    t,
    Response.json(fixture, { headers: { 'X-RateLimit-Remaining': '99' } }),
  );
  const result = await client.callTool({
    name: 'plumx_metrics',
    arguments: { ...input, reqId: 'plumx-request' },
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, fixture);
  assert.equal(result.content.length, 1);
  const text = result.content[0];
  assert.ok(text?.type === 'text');
  assert.deepEqual(JSON.parse(text.text) as unknown, fixture);
  assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
    'X-RateLimit-Remaining': '99',
  });
  assert.equal(mock.requests.length, 1);
  const request = mock.requests[0];
  assert.ok(request);
  const url = new URL(request.url);
  assert.equal(
    url.pathname,
    '/analytics/plumx/doi/10.1234%2Fsynthetic-example',
  );
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    reqId: 'plumx-request',
  });
  assert.equal(request.method, 'GET');
  assert.equal(request.headers.get('Accept'), 'application/json');
  assert.equal(request.headers.get('X-ELS-APIKey'), 'test-key');
  assert.equal(request.headers.get('X-ELS-Insttoken'), 'test-token');
});

for (const idType of [
  'doi',
  'elsevierId',
  'elsevierPii',
  'isbn',
  'pmcid',
  'pmid',
]) {
  await test(`PlumX supports the native ${idType} identifier type`, async (t) => {
    const payload = {
      id_type: idType,
      id_value: 'example',
      count_categories: [],
    };
    const { client, mock } = await connect(t, Response.json(payload));
    const result = await client.callTool({
      name: 'plumx_metrics',
      arguments: { idType, idValue: 'example' },
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
    const url = new URL(mock.requests[0]?.url ?? '');
    assert.equal(url.pathname, `/analytics/plumx/${idType}/example`);
    assert.equal(url.search, '');
  });
}

for (const idValue of [
  '10.1234/a?query=1&x=2#part',
  '../relative/id',
  '%2e%2e',
  '10.1234/кирилиця',
]) {
  await test(`PlumX encodes identifier path content safely: ${idValue}`, async (t) => {
    const { client, mock } = await connect(
      t,
      Response.json({ id_type: 'doi', id_value: idValue }),
    );
    const result = await client.callTool({
      name: 'plumx_metrics',
      arguments: { idType: 'doi', idValue },
    });
    assert.notEqual(result.isError, true);
    assert.equal(mock.requests.length, 1);
    const url = new URL(mock.requests[0]?.url ?? '');
    assert.equal(url.origin, 'https://api.elsevier.com');
    assert.equal(
      url.pathname,
      `/analytics/plumx/doi/${encodeURIComponent(idValue)}`,
    );
    assert.equal(
      decodeURIComponent(url.pathname.slice('/analytics/plumx/doi/'.length)),
      idValue,
    );
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
  });
}

for (const payload of [
  { id_type: 'doi', id_value: input.idValue },
  { id_type: 'doi', id_value: input.idValue, count_categories: null },
  {
    id_type: 'doi',
    id_value: input.idValue,
    count_categories: [
      {
        name: null,
        total: null,
        count_types: [{ sources: null, future: ['extra'] }],
      },
    ],
  },
]) {
  await test('PlumX preserves missing, null and partial metric fields', async (t) => {
    const { client } = await connect(t, Response.json(payload));
    const result = await client.callTool({
      name: 'plumx_metrics',
      arguments: input,
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
  });
}

for (const args of [
  {},
  { idType: 'doi' },
  { idValue: 'test' },
  { idType: 'scopus_id', idValue: '1' },
  { idType: 'doi', idValue: '' },
  { idType: 'doi', idValue: '  ' },
  { idType: 'doi', idValue: '.' },
  { idType: 'doi', idValue: '..' },
  { ...input, apiKey: 'secret' },
  { ...input, httpAccept: 'text/xml' },
  { ...input, view: 'STANDARD' },
  { ...input, reqId: '' },
  { ...input, reqId: '\n\t' },
]) {
  await test(`PlumX rejects invalid input before HTTP: ${JSON.stringify(args)}`, async (t) => {
    const { client, mock } = await connect(t, Response.json({}));
    const result = await client.callTool({
      name: 'plumx_metrics',
      arguments: args,
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /Input validation error/);
    assert.equal(mock.requests.length, 0);
  });
}

await test('PlumX publishes identifier and path-segment validation without rewriting values', async (t) => {
  const { client, mock } = await connect(t, Response.json({}));
  const { tools } = await client.listTools();
  const tool = tools.find((candidate) => candidate.name === 'plumx_metrics');
  assert.ok(tool);
  const schema = fromJsonSchema(tool.inputSchema as JsonSchemaType);

  for (const idValue of [
    '10.1234/example',
    '../relative/id',
    '%2e%2e',
    ' . ',
  ]) {
    const value = { idType: 'doi', idValue };
    const result = await validateSchema(schema, value);
    assert.equal(result.issues, undefined, idValue);
    assert.deepEqual(result.value, value);
  }
  for (const idValue of ['', '\t\n', '.', '..']) {
    const result = await validateSchema(schema, { idType: 'doi', idValue });
    assert.ok(result.issues, JSON.stringify(idValue));
  }
  assert.equal(mock.requests.length, 0);
});

for (const status of [401, 404, 429]) {
  await test(`PlumX retains HTTP ${status} as an error instead of synthesizing metrics`, async (t) => {
    const { client, mock } = await connect(
      t,
      Response.json(
        {
          'error-response': {
            errorCode: 'UPSTREAM_ERROR',
            errorMessage: 'Synthetic upstream failure',
          },
        },
        { status, headers: { 'Retry-After': '30' } },
      ),
    );
    const result = await client.callTool({
      name: 'plumx_metrics',
      arguments: input,
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
  {},
  { id_type: 'doi' },
  { id_type: 'doi', id_value: input.idValue, count_categories: {} },
  {
    id_type: 'doi',
    id_value: input.idValue,
    count_categories: [{ total: '7' }],
  },
]) {
  await test('PlumX rejects malformed successful JSON', async (t) => {
    const { client } = await connect(t, Response.json(payload));
    const result = await client.callTool({
      name: 'plumx_metrics',
      arguments: input,
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
  });
}
