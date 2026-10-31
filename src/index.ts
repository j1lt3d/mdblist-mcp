#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { startHttpServer } from './http.js';
import { MdblistClient } from './mdblist-client.js';
import { createServer } from './server.js';

const onerror = (error: Error) => {
  console.error(error);
};

try {
  const config = loadConfig();
  const client = new MdblistClient(config.apiKey);
  const factory = () => createServer(client);

  if (config.transport === 'stdio') {
    serveStdio(factory, { onerror });
  } else {
    const { url, close } = await startHttpServer(factory, config, onerror);
    // stdout is reserved for MCP messages in stdio mode; keep diagnostics on stderr everywhere.
    console.error(`mdblist-mcp listening on ${url.href}`);
    if (!config.authToken) {
      console.error(
        'Warning: MCP_AUTH_TOKEN is not set, so anyone who can reach this port can use your MDBList API key.',
      );
    }
    const shutdown = () => {
      close().then(
        () => process.exit(0),
        (error: unknown) => {
          console.error(error);
          process.exit(1);
        },
      );
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
} catch (error) {
  // stdout is reserved for MCP messages; diagnostics go to stderr.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
