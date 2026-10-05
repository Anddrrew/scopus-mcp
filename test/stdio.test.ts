import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

await test('compiled CLI completes MCP initialization and answers ping', { timeout: 10_000 }, async () => {
  const client = new Client({ name: 'smoke-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.env.MCP_TEST_COMMAND ?? process.execPath,
    args: process.env.MCP_TEST_COMMAND
      ? []
      : [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, 'scopus-mcp');
    await client.ping();
    assert.equal(stderr, '');
  } finally {
    await client.close();
  }
});
