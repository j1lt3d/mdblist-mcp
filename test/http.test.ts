import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { request } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHttpServer, type HttpServerHandle } from '../src/http.js';
import { createServer } from '../src/server.js';
import { tools } from '../src/tools/index.js';
import { clientWith, mockFetch } from './helpers.js';

const TOKEN = 'test-token';
const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

const onerror = vi.fn();

async function start(authToken?: string, host = '127.0.0.1'): Promise<HttpServerHandle> {
  const handle = await startHttpServer(
    () => createServer(clientWith(mockFetch())),
    { host, port: 0, ...(authToken && { authToken }) },
    onerror,
  );
  closers.push(handle.close);
  return handle;
}

async function connect(url: URL, token?: string) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(url, {
      ...(token && { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
    }),
  );
  closers.unshift(() => client.close());
  return client;
}

describe('HTTP transport', () => {
  it('lists every tool over Streamable HTTP', async () => {
    const { url } = await start();
    const client = await connect(url);
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name)).toEqual(tools.map((t) => t.name));
  });

  it('accepts the bearer token when one is configured', async () => {
    const { url } = await start(TOKEN);
    const client = await connect(url, TOKEN);
    expect((await client.listTools()).tools.length).toBe(tools.length);
  });

  it.each([undefined, 'Bearer wrong', 'Basic dGVzdA=='])(
    'rejects Authorization=%s with 401',
    async (authorization) => {
      const { url } = await start(TOKEN);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization && { Authorization: authorization }),
        },
        body: '{}',
      });
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    },
  );

  it('serves /healthz without auth', async () => {
    const { url } = await start(TOKEN);
    const response = await fetch(new URL('/healthz', url));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('returns 404 for other paths', async () => {
    const { url } = await start();
    expect((await fetch(new URL('/other', url))).status).toBe(404);
  });

  it('rejects cross-site browser origins', async () => {
    const { url } = await start();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it('rejects a foreign Host header when bound to loopback (DNS rebinding)', async () => {
    const { url } = await start();
    expect(await postStatus(url, 'evil.example')).toBe(403);
  });

  it('accepts any Host header when bound to all interfaces', async () => {
    const { url } = await start(TOKEN, '0.0.0.0');
    // Passes the Host check and reaches the token check instead.
    expect(await postStatus(url, 'mdblist.lan')).toBe(401);
  });

  it('rejects when the port is already in use', async () => {
    const { url } = await start();
    await expect(
      startHttpServer(
        () => createServer(clientWith(mockFetch())),
        { host: '127.0.0.1', port: Number(url.port) },
        onerror,
      ),
    ).rejects.toThrow(/EADDRINUSE/);
  });
});

/** fetch() won't let us override Host, so use node:http directly. */
function postStatus(url: URL, host: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'POST', headers: { Host: host, 'Content-Type': 'application/json' } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end('{}');
  });
}
