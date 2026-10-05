import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

await test(
  'compiled stdio advertises affiliation retrieval and returns native JSON',
  { timeout: 10_000 },
  async () => {
    const payload = JSON.parse(
      readFileSync(
        new URL(
          './fixtures/affiliation-retrieval/authors.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as unknown;
    const preload = `import assert from 'node:assert/strict';
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      assert.equal(url.pathname, '/content/affiliation/eid/10-s2.0-60000001');
      assert.equal(url.searchParams.get('view'), 'AUTHORS');
      assert.equal(request.headers.get('Accept'), 'application/json');
      assert.equal(request.headers.get('X-ELS-APIKey'), 'stdio-key');
      assert.equal(request.headers.get('X-ELS-Insttoken'), 'stdio-token');
      return Response.json(${JSON.stringify(payload)});
    };`;
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
        tools.find((tool) => tool.name === 'affiliation_retrieval')
          ?.outputSchema,
      );
      const result = await client.callTool({
        name: 'affiliation_retrieval',
        arguments: { eid: '10-s2.0-60000001', view: 'AUTHORS' },
      });
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, payload);
      assert.deepEqual(result.content, [
        { type: 'text', text: JSON.stringify(payload) },
      ]);
      assert.equal(stderr, '');
    } finally {
      await client.close();
    }
  },
);
