import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockFetch } from './mock-fetch';

// Synthetic, offline response for the compiled subprocess test only.
globalThis.fetch = mockFetch((request) => {
  const url = new URL(request.url);
  assert.equal(url.pathname, '/content/abstract/citations');
  assert.equal(url.searchParams.get('scopus_id'), '1000000001,1000000002');
  assert.equal(request.headers.get('X-ELS-APIKey'), 'stdio-test-key');
  return Response.json(
    JSON.parse(
      readFileSync(
        new URL('../fixtures/citation-overview/success.json', import.meta.url),
        'utf8',
      ),
    ) as unknown,
  );
}).fetch;
