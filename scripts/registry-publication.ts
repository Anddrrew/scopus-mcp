import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

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

export async function checkRegistryPublication(
  expectedValue: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const expected = object(expectedValue, 'server.json');
  const name = text(expected.name, 'server.json name');
  const version = text(expected.version, 'server.json version');
  const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}?include_deleted=true`;
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 404) {
    return false;
  }
  if (response.status !== 200) {
    throw new Error(`MCP Registry returned HTTP ${response.status}.`);
  }

  const body: unknown = await response.json();
  const published = object(body, 'MCP Registry response');
  const server = object(published.server, 'Published server');
  const meta = object(published._meta, 'MCP Registry metadata');
  const official = object(
    meta['io.modelcontextprotocol.registry/official'],
    'Official MCP Registry metadata',
  );
  if (official.status !== 'active') {
    throw new Error('This MCP Registry version exists but is not active.');
  }
  if (!isDeepStrictEqual(server, expected)) {
    throw new Error(
      'This MCP Registry version is already published with different metadata.',
    );
  }
  return true;
}

async function main(): Promise<void> {
  if (process.argv.length !== 2) {
    throw new Error('Usage: registry-publication.ts');
  }
  const output = text(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT');
  const server: unknown = JSON.parse(await readFile('server.json', 'utf8'));
  const exists = await checkRegistryPublication(server);
  await appendFile(output, `exists=${String(exists)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
