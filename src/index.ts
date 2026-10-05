#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server';

serveStdio(() => createServer(), {
  onerror: (error) => console.error('Scopus MCP error:', error),
});
