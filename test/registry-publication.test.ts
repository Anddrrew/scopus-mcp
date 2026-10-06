import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { checkRegistryPublication } from '../scripts/registry-publication';

const exec = promisify(execFile);
const script = fileURLToPath(
  new URL('../scripts/registry-publication.ts', import.meta.url),
);

function server() {
  return {
    $schema:
      'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    name: 'io.github.Anddrrew/scopus-mcp',
    title: 'Scopus',
    description: 'Search Scopus.',
    version: '1.2.3',
    repository: {
      url: 'https://github.com/Anddrrew/scopus-mcp',
      source: 'github',
    },
    packages: [
      {
        registryType: 'npm',
        identifier: 'scopus-mcp',
        version: '1.2.3',
        runtimeHint: 'npx',
        transport: { type: 'stdio' },
        environmentVariables: [
          { name: 'ELSEVIER_API_KEY', isRequired: true, isSecret: true },
          { name: 'ELSEVIER_INST_TOKEN', isSecret: true },
        ],
      },
    ],
  };
}

function publication(value: unknown = server(), status = 'active') {
  return {
    server: value,
    _meta: {
      'io.modelcontextprotocol.registry/official': {
        status,
        isLatest: false,
        publishedAt: '2026-10-06T12:00:00Z',
      },
    },
  };
}

function jsonResponse(body: unknown): typeof fetch {
  return () => Promise.resolve(Response.json(body));
}

await test('registry lookup requests the exact encoded name and version without credentials', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = (url, options) => {
    calls += 1;
    assert.equal(
      url,
      'https://registry.modelcontextprotocol.io/v0.1/servers/io.github.Anddrrew%2Fscopus-mcp/versions/1.2.3?include_deleted=true',
    );
    assert.deepEqual(options?.headers, { Accept: 'application/json' });
    assert.ok(options?.signal instanceof AbortSignal);
    return Promise.resolve(new Response('Not found', { status: 404 }));
  };
  assert.equal(await checkRegistryPublication(server(), fetchImpl), false);
  assert.equal(calls, 1);
});

await test('an active identical publication is reusable even when it is no longer latest', async () => {
  const expected = server();
  const before = structuredClone(expected);
  const actual = server();
  assert.equal(
    await checkRegistryPublication(expected, jsonResponse(publication(actual))),
    true,
  );
  assert.deepEqual(expected, before);
});

const changes: {
  name: string;
  change: (value: ReturnType<typeof server>) => void;
}[] = [
  {
    name: 'server name',
    change: (value) => {
      value.name = 'io.github.Other/scopus-mcp';
    },
  },
  {
    name: 'server version',
    change: (value) => {
      value.version = '1.2.4';
    },
  },
  {
    name: 'description',
    change: (value) => {
      value.description = 'Different description.';
    },
  },
  {
    name: 'package version',
    change: (value) => {
      value.packages[0]!.version = '1.2.4';
    },
  },
  {
    name: 'runtime',
    change: (value) => {
      value.packages[0]!.runtimeHint = 'other';
    },
  },
  {
    name: 'required API key',
    change: (value) => {
      value.packages[0]!.environmentVariables[0]!.isRequired = false;
    },
  },
  {
    name: 'secret API key',
    change: (value) => {
      value.packages[0]!.environmentVariables[0]!.isSecret = false;
    },
  },
  {
    name: 'repository',
    change: (value) => {
      value.repository.url = 'https://github.com/Other/scopus-mcp';
    },
  },
];

for (const { name, change } of changes) {
  await test(`registry retry rejects a changed ${name}`, async () => {
    const actual = server();
    change(actual);
    await assert.rejects(
      checkRegistryPublication(server(), jsonResponse(publication(actual))),
      /already published with different metadata/,
    );
  });
}

await test('unexpected server properties are not silently ignored', async () => {
  const actual = {
    ...server(),
    remotes: [{ type: 'sse', url: 'https://example.com' }],
  };
  await assert.rejects(
    checkRegistryPublication(server(), jsonResponse(publication(actual))),
    /different metadata/,
  );
});

for (const status of ['deprecated', 'deleted', 'unknown']) {
  await test(`registry retry rejects ${status} publications`, async () => {
    await assert.rejects(
      checkRegistryPublication(
        server(),
        jsonResponse(publication(server(), status)),
      ),
      /not active/,
    );
  });
}

for (const [name, body] of [
  ['null', null],
  ['array', []],
  ['missing server', {}],
  ['missing metadata', { server: server() }],
  ['missing official metadata', { server: server(), _meta: {} }],
  ['null server', publication(null)],
  ['array server', publication([])],
] as const) {
  await test(`registry lookup rejects a response with ${name}`, async () => {
    await assert.rejects(
      checkRegistryPublication(server(), jsonResponse(body)),
      /must be a JSON object/,
    );
  });
}

await test('registry lookup rejects invalid JSON and network failures', async () => {
  await assert.rejects(
    checkRegistryPublication(server(), () =>
      Promise.resolve(new Response('not JSON')),
    ),
    SyntaxError,
  );
  await assert.rejects(
    checkRegistryPublication(server(), () =>
      Promise.reject(new Error('Network failure')),
    ),
    /Network failure/,
  );
});

for (const status of [204, 401, 403, 429, 500]) {
  await test(`registry lookup fails on HTTP ${status} instead of treating it as unpublished`, async () => {
    await assert.rejects(
      checkRegistryPublication(server(), () =>
        Promise.resolve(new Response(null, { status })),
      ),
      new RegExp(`HTTP ${status}`),
    );
  });
}

for (const status of [200, 404, 500]) {
  await test(`registry CLI writes a result only after a successful lookup (HTTP ${status})`, async (t) => {
    const directory = await mkdtemp(
      join(tmpdir(), 'scopus-registry-publication-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    const output = join(directory, 'github-output');
    const preload = join(directory, 'fetch.mjs');
    await Promise.all([
      writeFile(join(directory, 'server.json'), JSON.stringify(server())),
      writeFile(output, 'previous=value\n'),
      writeFile(
        preload,
        `globalThis.fetch = async () => new Response(${JSON.stringify(JSON.stringify(publication()))}, { status: ${String(status)} });\n`,
      ),
    ]);
    const run = exec(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        '--import',
        pathToFileURL(preload).href,
        script,
      ],
      { cwd: directory, env: { ...process.env, GITHUB_OUTPUT: output } },
    );
    if (status === 500) {
      await assert.rejects(run, /HTTP 500/);
      assert.equal(await readFile(output, 'utf8'), 'previous=value\n');
    } else {
      await run;
      assert.equal(
        await readFile(output, 'utf8'),
        `previous=value\nexists=${String(status === 200)}\n`,
      );
    }
  });
}
