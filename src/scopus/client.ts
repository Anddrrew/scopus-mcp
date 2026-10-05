import type { Config } from '../config.js';
import { apiError, ScopusError } from './errors.js';

export class ScopusClient {
  constructor(
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  async get(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    signal?: AbortSignal,
  ): Promise<{ body: unknown; headers: Record<string, string> }> {
    const { apiKey, instToken } = this.config;
    if (!apiKey) {
      throw new ScopusError('MISSING_API_KEY', 'Set ELSEVIER_API_KEY in the MCP server environment.');
    }
    if ([apiKey, instToken].some((value) => value && /[^\x20-\x7e]/u.test(value))) {
      throw new ScopusError('INVALID_CREDENTIALS', 'Elsevier credentials must contain only printable ASCII characters.');
    }

    const url = new URL(path, 'https://api.elsevier.com');
    if (url.origin !== 'https://api.elsevier.com') {
      throw new ScopusError('INVALID_ENDPOINT', 'The endpoint must belong to api.elsevier.com.');
    }
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers = new Headers({ Accept: 'application/json', 'X-ELS-APIKey': apiKey });
    if (instToken) headers.set('X-ELS-Insttoken', instToken);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET', headers, signal: requestSignal, redirect: 'error',
      });
      const metadata: Record<string, string> = {};
      for (const name of ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After']) {
        const value = response.headers.get(name);
        if (value !== null) metadata[name] = value;
      }
      const text = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // Elsevier may return XML/HTML for failed requests even with Accept: application/json.
        if (response.ok) {
          throw new ScopusError('INVALID_RESPONSE', 'Scopus returned an invalid JSON response.', response.status, metadata);
        }
      }
      if (!response.ok) throw apiError(response.status, body, metadata, [apiKey, instToken ?? '']);
      return { body, headers: metadata };
    } catch (error) {
      if (error instanceof ScopusError) throw error;
      if (signal?.aborted) throw new ScopusError('CANCELLED', 'Scopus request was cancelled.');
      if (timeout.aborted) throw new ScopusError('TIMEOUT', 'Scopus request timed out.');
      throw new ScopusError('NETWORK_ERROR', 'Could not reach the Scopus API.');
    }
  }
}
