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

async function connect(t: TestContext, upstream: ScopusClient) {
  const server = createServer(upstream);
  const client = new Client({ name: 'subjects-test', version: '1.0.0' });
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

await test('subject classifications advertises native schemas without credentials or pagination', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  const tool = tools.find((tool) => tool.name === 'subject_classifications');
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}).sort(), [
    'abbrev',
    'code',
    'description',
    'detail',
    'field',
  ]);
  assert.ok(
    tool.outputSchema?.properties &&
      Object.hasOwn(tool.outputSchema.properties, 'subject-classifications'),
  );
  assert.equal(mock.requests.length, 0);
});

for (const name of ['single', 'multiple', 'empty']) {
  await test(`subject classifications preserves ${name} results without a key`, async (t) => {
    const payload = JSON.parse(
      readFileSync(
        new URL(
          `../fixtures/subject-classifications/${name}.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    ) as unknown;
    const mock = mockFetch(Response.json(payload));
    const client = await connect(t, new ScopusClient({}, mock.fetch));
    const result = await client.callTool({
      name: 'subject_classifications',
      arguments: {},
    });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, payload);
    const text = result.content[0];
    assert.ok(text?.type === 'text');
    assert.deepEqual(JSON.parse(text.text) as unknown, payload);
    assert.equal(mock.requests.length, 1);
    const request = mock.requests[0];
    assert.ok(request);
    assert.equal(
      request.url,
      'https://api.elsevier.com/content/subject/scopus',
    );
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.get('Accept'), 'application/json');
    assert.equal(request.headers.has('X-ELS-APIKey'), false);
  });
}

await test('subject filters are forwarded exactly and field-selected responses stay partial', async (t) => {
  const payload = {
    'subject-classifications': {
      'subject-classification': { code: '1106', detail: null, extra: [1, '2'] },
    },
  };
  const mock = mockFetch(
    Response.json(payload, {
      headers: { 'X-RateLimit-Remaining': '123' },
    }),
  );
  const client = await connect(
    t,
    new ScopusClient({ apiKey: 'test' }, mock.fetch),
  );
  const input = {
    description: 'Agricultural & Biological + Science',
    detail: 'Київ / Food',
    code: '1106',
    abbrev: 'agri',
    field: 'code,detail',
  };
  const result = await client.callTool({
    name: 'subject_classifications',
    arguments: input,
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, payload);
  assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
    'X-RateLimit-Remaining': '123',
  });
  assert.equal(mock.requests.length, 1);
  const request = mock.requests[0];
  assert.ok(request);
  assert.deepEqual(
    Object.fromEntries(new URL(request.url).searchParams),
    input,
  );
  assert.equal(request.headers.get('X-ELS-APIKey'), 'test');
});

for (const input of [
  { code: 1106 },
  { code: '' },
  { detail: '  ' },
  { field: 'unknown' },
  { field: 'code,' },
  { field: 'code, detail' },
  { field: 'code\n' },
  { parentCode: '11' },
  { view: 'STANDARD' },
  { start: 0 },
  { apiKey: 'never-a-tool-argument' },
  { httpAccept: 'text/xml' },
]) {
  await test(`invalid subject input is rejected before HTTP: ${JSON.stringify(input)}`, async (t) => {
    const mock = mockFetch(Response.json({}));
    const client = await connect(t, new ScopusClient({}, mock.fetch));
    const result = await client.callTool({
      name: 'subject_classifications',
      arguments: input,
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /Input validation error/);
    assert.equal(mock.requests.length, 0);
  });
}

await test('subject classifications publishes exact field-list validation to clients', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const { tools } = await client.listTools();
  const tool = tools.find(
    (candidate) => candidate.name === 'subject_classifications',
  );
  assert.ok(tool);
  const schema = fromJsonSchema(tool.inputSchema as JsonSchemaType);

  for (const value of [
    {},
    { field: 'code' },
    { field: 'description,abbrev,detail,code' },
    { field: 'code,code' },
  ]) {
    const result = await validateSchema(schema, value);
    assert.equal(result.issues, undefined, JSON.stringify(value));
    assert.deepEqual(result.value, value);
  }
  for (const field of [
    '',
    'Code',
    'code,',
    ',code',
    'code, detail',
    'code\n',
    'code\r\n',
    'code,unknown',
  ]) {
    const result = await validateSchema(schema, { field });
    assert.ok(result.issues, JSON.stringify(field));
  }
  assert.equal(mock.requests.length, 0);
});

for (const payload of [
  { unexpected: true },
  { 'subject-classifications': [] },
  { 'subject-classifications': { 'subject-classification': 42 } },
]) {
  await test(`invalid subject response is a tool error: ${JSON.stringify(payload)}`, async (t) => {
    const mock = mockFetch(Response.json(payload));
    const client = await connect(t, new ScopusClient({}, mock.fetch));
    const result = await client.callTool({
      name: 'subject_classifications',
      arguments: {},
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.match(JSON.stringify(result.content), /INVALID_RESPONSE/);
  });
}

await test('public subject endpoint retains upstream failures and quota metadata', async (t) => {
  const mock = mockFetch(
    Response.json(
      {
        'service-error': {
          status: {
            statusCode: 'QUOTA_EXCEEDED',
            statusText: 'Quota exhausted',
          },
        },
      },
      { status: 429, headers: { 'Retry-After': '12' } },
    ),
  );
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const result = await client.callTool({
    name: 'subject_classifications',
    arguments: {},
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.deepEqual(result.content, [
    {
      type: 'text',
      text: JSON.stringify({
        code: 'QUOTA_EXCEEDED',
        message: 'Quota exhausted',
        status: 429,
      }),
    },
  ]);
  assert.deepEqual(result._meta?.['scopus-mcp/headers'], {
    'Retry-After': '12',
  });
  assert.equal(mock.requests.length, 1);
});

await test('public subject registration does not relax authentication for Scopus Search', async (t) => {
  const mock = mockFetch(Response.json({}));
  const client = await connect(t, new ScopusClient({}, mock.fetch));
  const result = await client.callTool({
    name: 'scopus_search',
    arguments: { query: 'test' },
  });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /MISSING_API_KEY/);
  assert.equal(mock.requests.length, 0);
});
