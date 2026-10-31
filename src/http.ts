import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
  type McpServerFactory,
} from '@modelcontextprotocol/server';
import type { Config } from './config.js';

export const MCP_PATH = '/mcp';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export interface HttpServerHandle {
  url: URL;
  close: () => Promise<void>;
}

type HttpConfig = Pick<Config, 'host' | 'port' | 'authToken'> &
  Partial<Pick<Config, 'allowedOrigins'>>;

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Returns a 401 response unless the request carries the expected bearer token. */
function authResponse(request: Request, expected: Buffer | undefined): Response | undefined {
  if (!expected) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  if (match?.[1] && timingSafeEqual(digest(match[1].trim()), expected)) return undefined;
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Bearer' },
  });
}

function toRequest(req: IncomingMessage, signal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== undefined) headers.append(name, v);
    }
  }
  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  // The Host header is validated separately, so a fixed base keeps URL parsing safe.
  return new Request(new URL(req.url ?? '/', 'http://localhost'), {
    method,
    headers,
    signal,
    ...(hasBody && {
      body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
      duplex: 'half',
    }),
  });
}

async function writeResponse(response: Response, res: ServerResponse): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>), res);
}

/** Serves MCP over Streamable HTTP at {@link MCP_PATH}, with `/healthz` for liveness checks. */
export async function startHttpServer(
  factory: McpServerFactory,
  config: HttpConfig,
  onerror: (error: Error) => void,
): Promise<HttpServerHandle> {
  const handler = createMcpHandler(factory, { onerror });
  const expectedToken = config.authToken ? digest(config.authToken) : undefined;
  const checkHost = LOOPBACK_HOSTS.has(config.host);
  const allowedOrigins = [...localhostAllowedOrigins(), ...(config.allowedOrigins ?? [])];

  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/healthz' && request.method === 'GET') return new Response('ok');
    if (pathname !== MCP_PATH) return new Response('Not Found', { status: 404 });
    return (
      (checkHost
        ? hostHeaderValidationResponse(request, localhostAllowedHostnames())
        : undefined) ??
      originValidationResponse(request, allowedOrigins) ??
      authResponse(request, expectedToken) ??
      handler.fetch(request)
    );
  }

  const server = createServer((req, res) => {
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    let request: Request;
    try {
      request = toRequest(req, abort.signal);
    } catch {
      // e.g. an absolute-form request target with an invalid port
      res.writeHead(400).end('Bad Request');
      return;
    }
    handle(request)
      .then((response) => writeResponse(response, res))
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        onerror(error instanceof Error ? error : new Error(String(error)));
        if (res.headersSent) res.destroy();
        else res.writeHead(500).end('Internal Server Error');
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  // Report later server errors (e.g. EMFILE on accept) instead of crashing.
  server.on('error', onerror);

  const { port } = server.address() as AddressInfo;
  const host = config.host.includes(':') ? `[${config.host}]` : config.host;
  return {
    url: new URL(`http://${host}:${String(port)}${MCP_PATH}`),
    close: async () => {
      await handler.close();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
