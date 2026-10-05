#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer, serverMetadata } from './server';

console.error(
  JSON.stringify({
    event: 'startup',
    name: serverMetadata.name,
    version: serverMetadata.version,
    transport: 'stdio',
    pid: process.pid,
    entrypoint: fileURLToPath(import.meta.url),
  }),
);

serveStdio(() => createServer(), {
  onerror: (error) => console.error('Scopus MCP error:', error),
});
