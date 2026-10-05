import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { assertStartupLog } from './helpers/startup-log';

await test(
  'compiled stdio CLI lists and calls subject classifications without credentials',
  { timeout: 10_000 },
  async () => {
    const client = new Client({ name: 'subject-stdio-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        'tsx',
        '--import',
        fileURLToPath(
          new URL(
            './helpers/subject-classifications-stdio-fetch.ts',
            import.meta.url,
          ),
        ),
        fileURLToPath(new URL('../dist/index.js', import.meta.url)),
      ],
      env: { ELSEVIER_API_KEY: '', ELSEVIER_INST_TOKEN: '' },
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      assert.ok(tools.some((tool) => tool.name === 'subject_classifications'));
      const result = await client.callTool({
        name: 'subject_classifications',
        arguments: { code: '1106' },
      });
      assert.notEqual(result.isError, true);
      const payload = JSON.parse(
        readFileSync(
          new URL(
            './fixtures/subject-classifications/single.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ) as unknown;
      assert.deepEqual(result.structuredContent, payload);
    } finally {
      await client.close();
    }
    assertStartupLog(stderr);
  },
);
