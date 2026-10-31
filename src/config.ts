export type Transport = 'stdio' | 'http';

export interface Config {
  apiKey: string;
  transport: Transport;
  host: string;
  port: number;
  authToken?: string;
  /** Extra browser Origin hostnames allowed in HTTP mode, on top of localhost. */
  allowedOrigins: string[];
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

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
  // HTTP settings are only read in HTTP mode, so unrelated inherited variables
  // (a PaaS or dev tool's PORT, say) can never break the default stdio server.
  if (transport === 'stdio') {
    return { apiKey, transport, host: DEFAULT_HOST, port: DEFAULT_PORT, allowedOrigins: [] };
  }

  // PORT (unprefixed) is the convention platforms such as Cloud Run inject.
  const rawPort = env.PORT?.trim() || String(DEFAULT_PORT);
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535 (got "${rawPort}")`);
  }

  const authToken = env.MCP_AUTH_TOKEN?.trim();
  return {
    apiKey,
    transport,
    // Prefixed: shells and CI environments sometimes export a generic HOST.
    host: env.MCP_HOST?.trim() || DEFAULT_HOST,
    port,
    allowedOrigins: parseAllowedOrigins(env.MCP_ALLOWED_ORIGINS),
    ...(authToken && { authToken }),
  };
}

/** Hostnames as the SDK's Origin check expects them: no scheme or port, IPv6 in brackets. */
function parseAllowedOrigins(raw = ''): string[] {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean);
  for (const origin of origins) {
    const bracketedIpv6 = /^\[[0-9a-f:.]+\]$/.test(origin);
    if (origin.includes('/') || (!bracketedIpv6 && origin.includes(':'))) {
      throw new Error(
        `MCP_ALLOWED_ORIGINS takes hostnames only, without scheme or port; write IPv6 addresses in brackets, e.g. [fd00::5] (got "${origin}")`,
      );
    }
  }
  return origins;
}
