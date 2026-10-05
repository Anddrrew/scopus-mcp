import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockFetch } from './mock-fetch';

globalThis.fetch = mockFetch((request) => {
  const url = new URL(request.url);
  assert.equal(
    url.origin + url.pathname,
    'https://api.elsevier.com/content/subject/scopus',
  );
  assert.equal(url.searchParams.get('code'), '1106');
  assert.equal(request.headers.get('Accept'), 'application/json');
  assert.equal(request.headers.has('X-ELS-APIKey'), false);
  return new Response(
    readFileSync(
      new URL(
        '../fixtures/subject-classifications/single.json',
        import.meta.url,
      ),
      'utf8',
    ),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
}).fetch;
