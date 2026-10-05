import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { assertStartupLog } from './helpers/startup-log';

await test(
  'compiled stdio registers citation overview and returns its native JSON',
  { timeout: 10_000 },
  async () => {
    const client = new Client({
      name: 'citation-stdio-test',
      version: '1.0.0',
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        'tsx',
        '--import',
        fileURLToPath(
          new URL(
            './helpers/citation-overview-stdio-fetch.ts',
            import.meta.url,
          ),
        ),
        fileURLToPath(new URL('../dist/index.js', import.meta.url)),
      ],
      env: { ELSEVIER_API_KEY: 'stdio-test-key', ELSEVIER_INST_TOKEN: '' },
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      assert.ok(tools.some((tool) => tool.name === 'citation_overview'));
      const result = await client.callTool({
        name: 'citation_overview',
        arguments: { scopus_id: '1000000001,1000000002' },
      });
      assert.notEqual(result.isError, true);
      assert.deepEqual(
        result.structuredContent,
        JSON.parse(
          readFileSync(
            new URL(
              './fixtures/citation-overview/success.json',
              import.meta.url,
            ),
            'utf8',
          ),
        ) as unknown,
      );
    } finally {
      await client.close();
    }
    assertStartupLog(stderr, ['stdio-test-key']);
  },
);
