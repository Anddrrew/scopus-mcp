import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { assertStartupLog } from './helpers/startup-log';

await test(
  'compiled stdio server advertises and calls affiliation search',
  { timeout: 10_000 },
  async () => {
    const payload = JSON.parse(
      readFileSync(
        new URL('./fixtures/affiliation-search/success.json', import.meta.url),
        'utf8',
      ),
    ) as unknown;
    const preload = `
    import assert from 'node:assert/strict';
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      assert.equal(url.pathname, '/content/search/affiliation');
      assert.equal(url.searchParams.get('query'), 'AFFIL(university)');
      assert.equal(request.headers.get('X-ELS-APIKey'), 'stdio-affiliation-key');
      assert.equal(request.headers.get('Accept'), 'application/json');
      return new Response(${JSON.stringify(JSON.stringify(payload))}, { headers: { 'Content-Type': 'application/json' } });
    };
  `;
    const client = new Client({
      name: 'affiliation-stdio-test',
      version: '1.0.0',
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        `data:text/javascript,${encodeURIComponent(preload)}`,
        fileURLToPath(new URL('../dist/index.js', import.meta.url)),
      ],
      env: {
        ELSEVIER_API_KEY: 'stdio-affiliation-key',
        ELSEVIER_INST_TOKEN: '',
      },
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      assert.ok(tools.some((tool) => tool.name === 'affiliation_search'));
      const result = await client.callTool({
        name: 'affiliation_search',
        arguments: { query: 'AFFIL(university)' },
      });
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, payload);
    } finally {
      await client.close();
    }
    assertStartupLog(stderr, ['stdio-affiliation-key']);
  },
);
