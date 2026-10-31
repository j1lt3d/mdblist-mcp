import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { createServer, SERVER_NAME } from '../src/server.js';
import { tools } from '../src/tools/index.js';
import { clientWith, fetchCall, jsonResponse, mockFetch } from './helpers.js';

const PROTOCOL_VERSION = '2026-07-28';
const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

async function connect(fetchFn: typeof fetch) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const handle = serveStdio(() => createServer(clientWith(fetchFn)), {
    transport: serverTransport,
  });
  const client = new Client(
    { name: 'test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: PROTOCOL_VERSION } } },
  );
  await client.connect(clientTransport);
  closers.push(
    () => client.close(),
    () => handle.close(),
  );
  return client;
}

const text = (result: Awaited<ReturnType<Client['callTool']>>) =>
  (result.content as { type: string; text: string }[])[0]?.text;

describe('MCP server', () => {
  it(`lists every tool over protocol ${PROTOCOL_VERSION}`, async () => {
    const client = await connect(mockFetch());
    const { tools: listed } = await client.listTools();

    expect(client.getServerVersion()).toEqual({ name: SERVER_NAME, version: pkg.version });
    expect(listed.map((t) => t.name)).toEqual(tools.map((t) => t.name));
    const user = listed.find((t) => t.name === 'get_user');
    expect(user).toMatchObject({
      title: 'Get user',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { type: 'object' },
    });
  });

  it('returns API responses as JSON text', async () => {
    const fetchFn = mockFetch(jsonResponse({ username: 'jane' }));
    const client = await connect(fetchFn);

    const result = await client.callTool({ name: 'get_user', arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result) ?? '')).toEqual({ username: 'jane' });
    expect(fetchCall(fetchFn).url.pathname).toBe('/user');
  });

  it('reports API errors as tool errors with retry hint', async () => {
    const client = await connect(
      mockFetch(
        jsonResponse(
          { error: 'Daily API limit exceeded!' },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      ),
    );

    const result = await client.callTool({ name: 'get_user', arguments: {} });

    expect(result.isError).toBe(true);
    expect(text(result)).toBe('MDBList API error 429: Daily API limit exceeded! (retry after 60s)');
  });

  it('appends tool-specific hints to matching API errors', async () => {
    const client = await connect(
      mockFetch(jsonResponse({ error: 'Invalid app secret.' }, { status: 403 })),
    );

    const result = await client.callTool({
      name: 'get_watch_providers',
      arguments: { provider: 'tmdb', media_type: 'movie', id: '278' },
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(
      /^MDBList API error 403: Invalid app secret\. — This is an access rejection, not a supporter limit/,
    );
  });

  it('reports network failures as tool errors', async () => {
    const fetchFn = mockFetch();
    fetchFn.mockRejectedValueOnce(new TypeError('fetch failed'));
    const client = await connect(fetchFn);

    const result = await client.callTool({ name: 'get_user', arguments: {} });

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'fetch failed' }],
    });
  });

  it('reports non-Error rejections as tool errors', async () => {
    const fetchFn = mockFetch();
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exercising non-Error rejections
    fetchFn.mockImplementationOnce(() => Promise.reject('boom'));
    const client = await connect(fetchFn);

    const result = await client.callTool({ name: 'get_user', arguments: {} });

    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'boom' }] });
  });

  it('rejects invalid arguments without calling the API', async () => {
    const fetchFn = mockFetch();
    const client = await connect(fetchFn);

    const result = await client.callTool({ name: 'get_person', arguments: { tmdb_id: 'x' } });

    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/validation/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
