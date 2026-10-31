export type Transport = 'stdio' | 'http';

export interface Config {
  apiKey: string;
  transport: Transport;
  host: string;
  port: number;
  authToken?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.MDBLIST_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'MDBLIST_API_KEY environment variable is required (generate one in your mdblist.com preferences)',
    );
  }

  const transport = env.MCP_TRANSPORT?.trim().toLowerCase() || 'stdio';
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error(`MCP_TRANSPORT must be "stdio" or "http" (got "${transport}")`);
  }

  const rawPort = env.PORT?.trim() || '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535 (got "${rawPort}")`);
  }

  const authToken = env.MCP_AUTH_TOKEN?.trim();
  return {
    apiKey,
    transport,
    host: env.HOST?.trim() || '127.0.0.1',
    port,
    ...(authToken && { authToken }),
  };
}
