import { readFileSync } from 'node:fs';

export function searchFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../fixtures/scopus-search/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as unknown;
}
