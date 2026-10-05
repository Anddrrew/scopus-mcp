import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { searchFixture } from './helpers/fixtures';

await test(
  'compiled CLI initializes, advertises search and reports missing credentials',
  { timeout: 10_000 },
  async () => {
    const client = new Client({ name: 'smoke-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.env.MCP_TEST_COMMAND ?? process.execPath,
      args: process.env.MCP_TEST_COMMAND
        ? []
        : [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
      stderr: 'pipe',
      env: { ELSEVIER_API_KEY: '', ELSEVIER_INST_TOKEN: '' },
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      assert.equal(client.getServerVersion()?.name, 'scopus-mcp');
      await client.ping();
      const { tools } = await client.listTools();
      assert.equal(tools[0]?.name, 'scopus_search');
      const result = await client.callTool({
        name: 'scopus_search',
        arguments: { query: 'test' },
      });
      assert.equal(result.isError, true);
      assert.match(JSON.stringify(result.content), /MISSING_API_KEY/);
      assert.equal(stderr, '');
    } finally {
      await client.close();
    }
  },
);

await test(
  'stdio search uses environment credentials and returns structured JSON',
  { timeout: 10_000 },
  async () => {
    const client = new Client({ name: 'stdio-search-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        'tsx',
        '--import',
        fileURLToPath(new URL('./helpers/stdio-fetch.ts', import.meta.url)),
        fileURLToPath(new URL('../dist/index.js', import.meta.url)),
      ],
      env: {
        ELSEVIER_API_KEY: 'stdio-test-key',
        ELSEVIER_INST_TOKEN: 'stdio-test-token',
      },
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      await client.listTools();
      const result = await client.callTool({
        name: 'scopus_search',
        arguments: { query: 'test' },
      });
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, searchFixture('success'));
      assert.equal(stderr, '');
    } finally {
      await client.close();
    }
  },
);
