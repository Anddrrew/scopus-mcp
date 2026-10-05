import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

export const packageMetadata = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

export function assertStartupLog(
  stderr: string,
  secrets: readonly string[] = [],
): void {
  const lines = stderr.trim().split(/\r?\n/);
  assert.equal(lines.length, 1, 'Expected exactly one startup diagnostic.');
  const value = JSON.parse(lines[0] ?? '') as unknown;
  assert.ok(value !== null && typeof value === 'object');
  const record = value as Record<string, unknown>;
  assert.deepEqual(Object.keys(record).sort(), [
    'entrypoint',
    'event',
    'name',
    'pid',
    'transport',
    'version',
  ]);
  assert.equal(record.event, 'startup');
  assert.equal(record.name, packageMetadata.name);
  assert.equal(record.version, packageMetadata.version);
  assert.equal(record.transport, 'stdio');
  assert.ok(typeof record.pid === 'number');
  assert.ok(Number.isInteger(record.pid) && record.pid > 0);
  assert.ok(typeof record.entrypoint === 'string');
  assert.ok(isAbsolute(record.entrypoint));
  for (const secret of secrets) {
    assert.equal(
      stderr.includes(secret),
      false,
      'Startup diagnostics must not contain credentials.',
    );
  }
}
