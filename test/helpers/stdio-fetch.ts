import assert from 'node:assert/strict';
import { searchFixture } from './fixtures';
import { mockFetch } from './mock-fetch';

// Loaded only by the stdio subprocess test; production code uses native fetch.
globalThis.fetch = mockFetch((request) => {
  assert.equal(request.headers.get('X-ELS-APIKey'), 'stdio-test-key');
  assert.equal(request.headers.get('X-ELS-Insttoken'), 'stdio-test-token');
  assert.equal(new URL(request.url).pathname, '/content/search/scopus');
  return Response.json(searchFixture('success'));
}).fetch;
