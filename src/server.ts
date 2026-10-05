import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { readConfig } from './config';
import { ScopusClient } from './scopus/client';
import { registerAffiliationRetrieval } from './tools/affiliation-retrieval/tool';
import { registerAffiliationSearch } from './tools/affiliation-search/tool';
import { registerAuthorRetrieval } from './tools/author-retrieval/tool';
import { registerAuthorSearch } from './tools/author-search/tool';
import { registerCitationOverview } from './tools/citation-overview/tool';
import { registerPlumxMetrics } from './tools/plumx-metrics/tool';
import { registerScopusSearch } from './tools/scopus-search/tool';
import { registerSubjectClassifications } from './tools/subject-classifications/tool';

export const serverMetadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

export function createServer(
  client = new ScopusClient(readConfig()),
): McpServer {
  const server = new McpServer(
    { name: serverMetadata.name, version: serverMetadata.version },
    {
      capabilities: { tools: {} },
      instructions: `${serverMetadata.name} v${serverMetadata.version}. Tools use native Scopus API parameters and return structured JSON.`,
    },
  );
  registerScopusSearch(server, client);
  registerAuthorSearch(server, client);
  registerAffiliationSearch(server, client);
  registerAuthorRetrieval(server, client);
  registerAffiliationRetrieval(server, client);
  registerPlumxMetrics(server, client);
  registerCitationOverview(server, client);
  registerSubjectClassifications(server, client);
  return server;
}
