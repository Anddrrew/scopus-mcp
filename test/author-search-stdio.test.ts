import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { assertStartupLog } from './helpers/startup-log';

await test(
  'compiled stdio server advertises and calls author search',
  { timeout: 10_000 },
  async () => {
    const payload = JSON.parse(
      readFileSync(
        new URL('./fixtures/author-search/success.json', import.meta.url),
        'utf8',
      ),
    ) as unknown;
    const preload = `
    import assert from 'node:assert/strict';
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      assert.equal(url.pathname, '/content/search/author');
      assert.equal(url.searchParams.get('co-author'), '7000000001');
      assert.equal(request.headers.get('X-ELS-APIKey'), 'stdio-author-key');
      assert.equal(request.headers.get('Accept'), 'application/json');
      return new Response(${JSON.stringify(JSON.stringify(payload))}, { headers: { 'Content-Type': 'application/json' } });
    };
  `;
    const client = new Client({ name: 'author-stdio-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        `data:text/javascript,${encodeURIComponent(preload)}`,
        fileURLToPath(new URL('../dist/index.js', import.meta.url)),
      ],
      env: { ELSEVIER_API_KEY: 'stdio-author-key', ELSEVIER_INST_TOKEN: '' },
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      assert.ok(tools.some((tool) => tool.name === 'author_search'));
      const result = await client.callTool({
        name: 'author_search',
        arguments: { 'co-author': '7000000001' },
      });
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, payload);
    } finally {
      await client.close();
    }
    assertStartupLog(stderr, ['stdio-author-key']);
  },
);
