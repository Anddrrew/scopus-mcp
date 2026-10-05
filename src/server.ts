import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';

const metadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

export function createServer(): McpServer {
  return new McpServer(
    { name: metadata.name, version: metadata.version },
    { capabilities: { tools: {} } },
  );
}
