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

  it('adds no tool hint to errors with other statuses', async () => {
    const client = await connect(mockFetch(jsonResponse({ error: 'Not found' }, { status: 404 })));
    const result = await client.callTool({
      name: 'get_watch_providers',
      arguments: { provider: 'tmdb', media_type: 'movie', id: '278' },
    });
    expect(text(result)).toBe('MDBList API error 404: Not found');
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

  describe('external lists', () => {
    const externalRow = { id: 168348, name: 'British Crime Shows', source: 'imdb' };
    const json = (result: Awaited<ReturnType<Client['callTool']>>) =>
      JSON.parse(text(result) ?? '') as unknown;

    it('browse_lists returns external lists keyed by external_id', async () => {
      const client = await connect(mockFetch(jsonResponse([externalRow])));
      const result = await client.callTool({
        name: 'browse_lists',
        arguments: { source: 'external' },
      });
      expect(json(result)).toEqual([
        { external_id: 168348, name: 'British Crime Shows', source: 'imdb' },
      ]);
    });

    it('browse_lists leaves MDBList list ids alone', async () => {
      const client = await connect(mockFetch(jsonResponse([{ id: 14, name: 'Top' }])));
      const result = await client.callTool({ name: 'browse_lists', arguments: { source: 'top' } });
      expect(json(result)).toEqual([{ id: 14, name: 'Top' }]);
    });

    it('get_list by external_id returns the list keyed by external_id', async () => {
      const fetchFn = mockFetch(jsonResponse([externalRow]));
      const client = await connect(fetchFn);
      const result = await client.callTool({
        name: 'get_list',
        arguments: { list: { external_id: 168348 } },
      });
      expect(fetchCall(fetchFn).url.pathname).toBe('/external/lists/168348');
      expect(json(result)).toEqual([expect.objectContaining({ external_id: 168348 })]);
    });

    it.each([
      ['get_user_lists', {}],
      ['search_lists', { query: 'x' }],
      ['get_list_membership', { mediatype: 'show', tmdb: 96677 }],
      ['browse_lists', { source: 'liked' }],
      ['get_list', { list: { id: 14 } }],
    ])('%s keeps MDBList list ids as id, even with an external source', async (name, args) => {
      // These endpoints return MDBList lists, whose id is what {id} and list_id expect.
      // A bare array (not a wrapper) so the test fails if the rename is ever applied here.
      const body = [{ id: 14, source: 'imdb' }];
      const client = await connect(mockFetch(jsonResponse(body)));
      const result = await client.callTool({ name, arguments: args });
      expect(json(result)).toEqual(body);
    });

    it('get_list by external_id renames a single-object response', async () => {
      const client = await connect(mockFetch(jsonResponse(externalRow)));
      const result = await client.callTool({
        name: 'get_list',
        arguments: { list: { external_id: 168348 } },
      });
      expect(json(result)).toEqual(expect.objectContaining({ external_id: 168348 }));
      expect(json(result)).not.toHaveProperty('id');
    });

    const notFound = () => mockFetch(jsonResponse({ error: 'Not found' }, { status: 404 }));

    it.each(['get_list', 'get_list_items'])(
      '%s points an {id} 404 at {external_id}',
      async (name) => {
        const client = await connect(notFound());
        const result = await client.callTool({ name, arguments: { list: { id: 168348 } } });
        expect(result.isError).toBe(true);
        expect(text(result)).toMatch(/^MDBList API error 404: Not found — .*\{external_id: N\}/);
      },
    );

    it.each(['get_list', 'get_list_items'])(
      '%s points an {external_id} 404 back at browse_lists, not at {external_id}',
      async (name) => {
        const client = await connect(notFound());
        const result = await client.callTool({ name, arguments: { list: { external_id: 999 } } });
        expect(text(result)).toMatch(/^MDBList API error 404: Not found — .*browse_lists/);
        expect(text(result)).not.toMatch(/retry with/);
      },
    );

    it.each([
      ['add_list_items', { list_id: 168348, movies: [{ tmdb: 278 }] }],
      ['remove_list_items', { list_id: 168348, movies: [{ tmdb: 278 }] }],
      ['delete_list', { list_id: 168348 }],
    ])('%s explains that list_id takes MDBList ids, not external ones', async (name, args) => {
      const client = await connect(notFound());
      const result = await client.callTool({ name, arguments: args });
      expect(text(result)).toMatch(
        /^MDBList API error 404: Not found — list_id must be the id of one of your own MDBList lists/,
      );
    });

    it('adds no hint to other errors on {id}', async () => {
      const client = await connect(mockFetch(jsonResponse({ error: 'Oops' }, { status: 500 })));
      const result = await client.callTool({ name: 'get_list', arguments: { list: { id: 1 } } });
      expect(text(result)).toBe('MDBList API error 500: Oops');
    });

    it.each([
      { username: 'jane', listname: 'best' },
      { official: 'trending' },
      { share_token: 'abc' },
    ])('adds no hint to a 404 for list %j', async (list) => {
      const client = await connect(notFound());
      const result = await client.callTool({ name: 'get_list', arguments: { list } });
      expect(text(result)).toBe('MDBList API error 404: Not found');
    });
  });
});
