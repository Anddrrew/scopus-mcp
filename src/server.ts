import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { readConfig } from './config';
import { ScopusClient } from './scopus/client';
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
  return server;
}
