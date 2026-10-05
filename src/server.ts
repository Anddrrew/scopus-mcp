import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { readConfig } from './config';
import { ScopusClient } from './scopus/client';
import { registerAffiliationRetrieval } from './tools/affiliation-retrieval/tool';
import { registerAffiliationSearch } from './tools/affiliation-search/tool';
import { registerAuthorRetrieval } from './tools/author-retrieval/tool';
import { registerAuthorSearch } from './tools/author-search/tool';
import { registerScopusSearch } from './tools/scopus-search/tool';

const metadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

export function createServer(
  client = new ScopusClient(readConfig()),
): McpServer {
  const server = new McpServer(
    { name: metadata.name, version: metadata.version },
    { capabilities: { tools: {} } },
  );
  registerScopusSearch(server, client);
  registerAuthorSearch(server, client);
  registerAffiliationSearch(server, client);
  registerAuthorRetrieval(server, client);
  registerAffiliationRetrieval(server, client);
  return server;
}
