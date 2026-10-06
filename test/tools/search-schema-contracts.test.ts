import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import {
  fromJsonSchema,
  InMemoryTransport,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';
import { validateSchema } from '../../src/schemas/schema';
import { ScopusClient } from '../../src/scopus/client';
import { createServer } from '../../src/server';
import { mockFetch } from '../helpers/mock-fetch';

await test('tools/list exposes search argument constraints to clients', async (t) => {
  const mock = mockFetch(Response.json({}));
  const server = createServer(new ScopusClient({}, mock.fetch));
  const client = new Client({ name: 'search-schema-test', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();

  const cases = [
    {
      name: 'scopus_search',
      valid: [
        { query: 'test' },
        { query: 'test', count: 200 },
        { query: 'test', cursor: '*' },
        { query: 'test', view: 'COMPLETE' },
        { query: 'test', view: 'COMPONENT', count: 25 },
        { query: 'test', view: 'COMPLETE', count: 200, field: 'title' },
        { query: 'test', view: 'COMPONENT', count: 200, field: 'title' },
      ],
      invalid: [
        { query: 'test', cursor: '*', start: 0 },
        { query: 'test', view: 'COMPLETE', count: 26 },
        { query: 'test', view: 'COMPONENT', count: 26 },
        { query: '\t\n' },
        { query: 'test', cursor: ' ' },
      ],
    },
    {
      name: 'author_search',
      valid: [
        { query: 'test' },
        { 'co-author': '7000000001' },
        { query: 'test', 'co-author': '7000000001' },
      ],
      invalid: [
        {},
        { 'co-author': '1,2' },
        { query: 'test', view: 'COMPLETE' },
        { query: 'test', cursor: '*' },
        { query: '\t\n' },
      ],
    },
    {
      name: 'affiliation_search',
      valid: [{ query: 'test' }, { query: 'test', count: 0 }],
      invalid: [
        {},
        { query: '\t\n' },
        { query: 'test', view: 'COMPLETE' },
        { query: 'test', cursor: '*' },
        { query: 'test', 'co-author': '1' },
      ],
    },
  ];

  for (const scenario of cases) {
    const tool = tools.find((entry) => entry.name === scenario.name);
    assert.ok(tool);
    // A separate validator sees only tools/list, so these checks catch rules
    // that work on the server but disappear from its advertised JSON Schema.
    const publishedSchema = fromJsonSchema(tool.inputSchema as JsonSchemaType);
    for (const input of [
      ...scenario.valid,
      { query: 'test', start: 5000, count: 0 },
    ]) {
      assert.equal(
        (await validateSchema(publishedSchema, input)).issues,
        undefined,
        `${scenario.name} should advertise acceptance of ${JSON.stringify(input)}`,
      );
    }
    for (const input of [
      ...scenario.invalid,
      { query: 'test', start: 5001, count: 0 },
    ]) {
      assert.ok(
        (await validateSchema(publishedSchema, input)).issues,
        `${scenario.name} should advertise rejection of ${JSON.stringify(input)}`,
      );
    }
  }
  assert.equal(mock.requests.length, 0);
});
