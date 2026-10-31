#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { MdblistClient } from './mdblist-client.js';
import { createServer } from './server.js';

try {
  const client = new MdblistClient(loadConfig().apiKey);
  serveStdio(() => createServer(client), {
    onerror: (error) => {
      console.error(error);
    },
  });
} catch (error) {
  // stdout is reserved for MCP messages; diagnostics go to stderr.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
