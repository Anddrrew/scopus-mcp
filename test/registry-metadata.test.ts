import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const script = fileURLToPath(
  new URL('../scripts/registry-metadata.ts', import.meta.url),
);

function metadata() {
  return {
    'package.json': {
      name: 'scopus-mcp',
      version: '1.2.3',
      mcpName: 'io.github.Anddrrew/scopus-mcp',
    },
    'package-lock.json': {
      name: 'scopus-mcp',
      version: '1.2.3',
      lockfileVersion: 3,
      packages: { '': { name: 'scopus-mcp', version: '1.2.3' } },
    },
    'server.json': {
      name: 'io.github.Anddrrew/scopus-mcp',
      version: '1.2.3',
      description: 'Scopus tools.',
      packages: [
        {
          registryType: 'npm',
          identifier: 'scopus-mcp',
          version: '1.2.3',
          transport: { type: 'stdio' },
          environmentVariables: [
            { name: 'ELSEVIER_API_KEY', isRequired: true, isSecret: true },
          ],
        },
      ],
    },
  };
}

type Metadata = ReturnType<typeof metadata>;

async function fixture(t: TestContext, files: Metadata): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'scopus-registry-metadata-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await Promise.all(
    Object.entries(files).map(([name, value]) =>
      writeFile(join(directory, name), `${JSON.stringify(value, null, 2)}\n`),
    ),
  );
  return directory;
}

function run(directory: string, ...args: string[]) {
  return exec(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), script, ...args],
    { cwd: directory },
  );
}

await test('repository npm and registry metadata stay synchronized', async () => {
  await run(fileURLToPath(new URL('..', import.meta.url)), 'check');
});

await test('registry check accepts matching metadata without rewriting files', async (t) => {
  const directory = await fixture(t, metadata());
  const before = await readFile(join(directory, 'server.json'), 'utf8');
  await run(directory, 'check');
  assert.equal(await readFile(join(directory, 'server.json'), 'utf8'), before);
});

await test('registry sync updates both versions and preserves other metadata', async (t) => {
  const files = metadata();
  files['server.json'].version = '1.0.0';
  files['server.json'].packages[0]!.version = '1.0.1';
  const directory = await fixture(t, files);

  await run(directory, 'sync');
  files['server.json'].version = '1.2.3';
  files['server.json'].packages[0]!.version = '1.2.3';
  const expected = `${JSON.stringify(files['server.json'], null, 2)}\n`;
  assert.equal(
    await readFile(join(directory, 'server.json'), 'utf8'),
    expected,
  );
  for (const name of ['package.json', 'package-lock.json'] as const) {
    assert.equal(
      await readFile(join(directory, name), 'utf8'),
      `${JSON.stringify(files[name], null, 2)}\n`,
    );
  }

  await run(directory, 'check');
  await run(directory, 'sync');
  assert.equal(
    await readFile(join(directory, 'server.json'), 'utf8'),
    expected,
  );
});

const invalidMetadata: {
  name: string;
  change: (files: Metadata) => void;
  message: RegExp;
}[] = [
  {
    name: 'lockfile name mismatch',
    change: (files) => {
      files['package-lock.json'].name = 'other';
    },
    message: /package-lock\.json name must equal/,
  },
  {
    name: 'lockfile root name mismatch',
    change: (files) => {
      files['package-lock.json'].packages[''].name = 'other';
    },
    message: /package-lock\.json root package name must equal/,
  },
  {
    name: 'lockfile version mismatch',
    change: (files) => {
      files['package-lock.json'].version = '1.0.0';
    },
    message: /package-lock\.json version must equal/,
  },
  {
    name: 'lockfile root version mismatch',
    change: (files) => {
      files['package-lock.json'].packages[''].version = '1.0.0';
    },
    message: /package-lock\.json root package version must equal/,
  },
  {
    name: 'registry identity mismatch',
    change: (files) => {
      files['server.json'].name = 'io.github.Other/scopus-mcp';
    },
    message: /server\.json name must equal/,
  },
  {
    name: 'npm identifier mismatch',
    change: (files) => {
      files['server.json'].packages[0]!.identifier = 'other';
    },
    message: /server\.json package identifier must equal/,
  },
  {
    name: 'non-npm registry',
    change: (files) => {
      files['server.json'].packages[0]!.registryType = 'pypi';
    },
    message: /server\.json package registryType must equal/,
  },
  {
    name: 'missing package',
    change: (files) => {
      files['server.json'].packages = [];
    },
    message: /exactly one npm package/,
  },
  {
    name: 'duplicate package',
    change: (files) => {
      files['server.json'].packages.push(files['server.json'].packages[0]!);
    },
    message: /exactly one npm package/,
  },
  {
    name: 'missing mcpName',
    change: (files) => {
      files['package.json'].mcpName = '';
    },
    message: /package\.json mcpName must be a non-empty string/,
  },
];

for (const { name, change, message } of invalidMetadata) {
  await test(`registry commands reject ${name} without changing metadata`, async (t) => {
    const files = metadata();
    change(files);
    const directory = await fixture(t, files);
    const before = await readFile(join(directory, 'server.json'), 'utf8');
    for (const command of ['check', 'sync']) {
      await assert.rejects(run(directory, command), message);
      assert.equal(
        await readFile(join(directory, 'server.json'), 'utf8'),
        before,
      );
    }
  });
}

for (const part of ['server', 'package'] as const) {
  await test(`registry check rejects a stale ${part} version`, async (t) => {
    const files = metadata();
    const target =
      part === 'server'
        ? files['server.json']
        : files['server.json'].packages[0]!;
    target.version = '1.0.0';
    const directory = await fixture(t, files);
    await assert.rejects(
      run(directory, 'check'),
      /version must equal "1\.2\.3"/,
    );
  });
}

for (const version of [
  '1.2',
  'v1.2.3',
  '01.2.3',
  '1.2.3-rc.1',
  '1.2.3+build',
]) {
  await test(`registry commands reject non-stable version ${version}`, async (t) => {
    const files = metadata();
    files['package.json'].version = version;
    const directory = await fixture(t, files);
    for (const command of ['check', 'sync']) {
      await assert.rejects(
        run(directory, command),
        /stable major\.minor\.patch version/,
      );
    }
  });
}

await test('registry commands reject malformed package metadata before writing', async (t) => {
  const directory = await fixture(t, metadata());
  const before = await readFile(join(directory, 'server.json'), 'utf8');
  await writeFile(join(directory, 'package-lock.json'), '{"packages":[]}');
  await assert.rejects(
    run(directory, 'sync'),
    /packages must be a JSON object/,
  );
  assert.equal(await readFile(join(directory, 'server.json'), 'utf8'), before);
});

for (const args of [[], ['publish'], ['sync', '--force']]) {
  await test(`registry CLI rejects unsupported arguments ${JSON.stringify(args)}`, async (t) => {
    const directory = await fixture(t, metadata());
    await assert.rejects(
      run(directory, ...args),
      /Usage: registry-metadata\.ts <check\|sync>/,
    );
  });
}
