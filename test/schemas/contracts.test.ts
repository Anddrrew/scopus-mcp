import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { Ajv2020 } from 'ajv/dist/2020';
import type { AnySchemaObject } from 'ajv';
import { createServer } from '../../src/server';

type Schema = Record<string, unknown>;

function object(value: unknown): value is Schema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Inspect schema positions, never instance data in defaults or examples.
function inspectSchema(schema: unknown, path: string, descriptions = true) {
  if (!object(schema)) {
    return;
  }
  assert.equal(
    Array.isArray(schema.type),
    false,
    `${path}: use anyOf for nullable fields`,
  );
  if (object(schema.additionalProperties)) {
    assert.notDeepEqual(
      schema.additionalProperties,
      {},
      `${path}: use additionalProperties: true for open objects`,
    );
  }
  for (const key of ['properties', 'patternProperties', '$defs']) {
    const children = schema[key];
    if (!object(children)) {
      continue;
    }
    for (const [name, child] of Object.entries(children)) {
      const childPath = `${path}.${key}[${JSON.stringify(name)}]`;
      if (key === 'properties' && descriptions) {
        assert.ok(object(child), childPath);
        assert.ok(
          typeof child.description === 'string' &&
            child.description.trim().length > 0,
          `${childPath}: missing field description`,
        );
      }
      inspectSchema(child, childPath, descriptions);
    }
  }
  for (const key of ['anyOf', 'oneOf', 'allOf', 'prefixItems']) {
    const children = schema[key];
    if (Array.isArray(children)) {
      children.forEach((child: unknown, i: number) =>
        inspectSchema(child, `${path}.${key}[${i}]`, descriptions),
      );
    }
  }
  for (const key of ['items', 'additionalProperties', 'contains']) {
    inspectSchema(schema[key], `${path}.${key}`, descriptions);
  }
  // Conditional branches constrain fields already documented in properties.
  for (const key of ['if', 'then', 'else', 'not']) {
    inspectSchema(schema[key], `${path}.${key}`, false);
  }
}

await test('all advertised tool schemas are valid, documented JSON Schema with portable nullable and open-object forms', async (t) => {
  const server = createServer();
  const client = new Client({ name: 'schema-contract-test', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'affiliation_retrieval',
    'affiliation_search',
    'author_retrieval',
    'author_search',
    'citation_overview',
    'plumx_metrics',
    'scopus_search',
    'subject_classifications',
  ]);

  // Independent validator with meta-schema validation enabled. Production's
  // MCP adapter validates instances; this also verifies the schemas themselves.
  const ajv = new Ajv2020({
    strict: false,
    validateSchema: true,
    allErrors: true,
  });
  for (const tool of tools) {
    for (const kind of ['inputSchema', 'outputSchema'] as const) {
      const schema = tool[kind];
      assert.ok(schema, `${tool.name}.${kind}`);
      // MCP's wire type is deliberately broad; AJV checks its actual contents.
      const document = schema as AnySchemaObject;
      assert.equal(
        ajv.validateSchema(document),
        true,
        `${tool.name}.${kind}: ${ajv.errorsText()}`,
      );
      assert.doesNotThrow(() => ajv.compile(document), `${tool.name}.${kind}`);
      inspectSchema(schema, `${tool.name}.${kind}`);
    }
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
  }
});
