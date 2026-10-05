import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { assertStartupLog } from './helpers/startup-log';

await test(
  'compiled stdio advertises author retrieval and preserves native batch JSON',
  { timeout: 10_000 },
  async () => {
    const payload = JSON.parse(
      readFileSync(
        new URL('./fixtures/author-retrieval/batch.json', import.meta.url),
        'utf8',
      ),
    ) as unknown;
    const preload = `import assert from 'node:assert/strict';
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      assert.equal(url.pathname, '/content/author');
      assert.equal(url.searchParams.get('author_id'), '1,2');
      assert.equal(request.headers.get('Accept'), 'application/json');
      assert.equal(request.headers.get('X-ELS-APIKey'), 'stdio-key');
      assert.equal(request.headers.get('X-ELS-Insttoken'), 'stdio-token');
      return Response.json(${JSON.stringify(payload)});
    };`;
    const client = new Client({ name: 'author-stdio-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        `data:text/javascript,${encodeURIComponent(preload)}`,
        fileURLToPath(new URL('../dist/index.js', import.meta.url)),
      ],
      env: {
        ELSEVIER_API_KEY: 'stdio-key',
        ELSEVIER_INST_TOKEN: 'stdio-token',
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
      assert.ok(
        tools.find((tool) => tool.name === 'author_retrieval')?.outputSchema,
      );
      const result = await client.callTool({
        name: 'author_retrieval',
        arguments: { author_id: '1,2' },
      });
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, payload);
      assert.deepEqual(result.content, [
        { type: 'text', text: JSON.stringify(payload) },
      ]);
    } finally {
      await client.close();
    }
    assertStartupLog(stderr, ['stdio-key', 'stdio-token']);
  },
);
