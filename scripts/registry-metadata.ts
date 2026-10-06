import { readFile, writeFile } from 'node:fs/promises';

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function equal(actual: unknown, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}.`);
  }
}

async function readObject(path: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  return object(value, path);
}

async function main(): Promise<void> {
  const [command, ...extraArguments] = process.argv.slice(2);
  if (
    (command !== 'check' && command !== 'sync') ||
    extraArguments.length > 0
  ) {
    throw new Error('Usage: registry-metadata.ts <check|sync>');
  }

  const [pkg, lock, server] = await Promise.all([
    readObject('package.json'),
    readObject('package-lock.json'),
    readObject('server.json'),
  ]);
  const name = text(pkg.name, 'package.json name');
  const version = text(pkg.version, 'package.json version');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(
      'package.json version must be a stable major.minor.patch version.',
    );
  }
  const mcpName = text(pkg.mcpName, 'package.json mcpName');
  const lockedPackages = object(lock.packages, 'package-lock.json packages');
  const lockedRoot = object(
    lockedPackages[''],
    'package-lock.json root package',
  );

  equal(lock.name, name, 'package-lock.json name');
  equal(lockedRoot.name, name, 'package-lock.json root package name');
  equal(lock.version, version, 'package-lock.json version');
  equal(lockedRoot.version, version, 'package-lock.json root package version');
  equal(server.name, mcpName, 'server.json name');

  if (!Array.isArray(server.packages) || server.packages.length !== 1) {
    throw new Error(
      'server.json packages must contain exactly one npm package.',
    );
  }
  const registryPackage = object(server.packages[0], 'server.json npm package');
  equal(
    registryPackage.registryType,
    'npm',
    'server.json package registryType',
  );
  equal(registryPackage.identifier, name, 'server.json package identifier');
  text(server.version, 'server.json version');
  text(registryPackage.version, 'server.json package version');

  if (command === 'check') {
    equal(server.version, version, 'server.json version');
    equal(registryPackage.version, version, 'server.json package version');
    return;
  }

  server.version = version;
  registryPackage.version = version;
  await writeFile('server.json', `${JSON.stringify(server, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
