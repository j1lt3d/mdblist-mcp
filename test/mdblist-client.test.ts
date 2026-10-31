import { describe, expect, it } from 'vitest';
import { MDBLIST_BASE_URL, MdblistApiError, apiPath } from '../src/mdblist-client.js';
import { API_KEY, clientWith, fetchCall, jsonResponse, mockFetch } from './helpers.js';

describe('apiPath', () => {
  it('encodes interpolated segments only', () => {
    expect(apiPath`/lists/user/${'a b/c'}/x/${42}`).toBe('/lists/user/a%20b%2Fc/x/42');
  });
});

describe('MdblistClient.request', () => {
  it('builds the URL with query params and the API key', async () => {
    const fetchFn = mockFetch();
    await clientWith(fetchFn).request({
      method: 'GET',
      path: '/catalog/movie',
      query: { genre: ['action', 'comedy'], limit: 5, unified: true, cursor: undefined },
    });

    const { url, init } = fetchCall(fetchFn);
    expect(url.origin + url.pathname).toBe(`${MDBLIST_BASE_URL}/catalog/movie`);
    expect(url.searchParams.getAll('genre')).toEqual(['action', 'comedy']);
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('unified')).toBe('true');
    expect(url.searchParams.has('cursor')).toBe(false);
    expect(url.searchParams.get('apikey')).toBe(API_KEY);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('sends a JSON body and returns parsed JSON', async () => {
    const fetchFn = mockFetch(jsonResponse({ added: 1 }));
    const result = await clientWith(fetchFn).request({
      method: 'POST',
      path: '/watchlist/items/add',
      body: { movies: [] },
    });

    const { init } = fetchCall(fetchFn);
    expect(init.body).toBe('{"movies":[]}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(result).toEqual({ added: 1 });
  });

  it('returns null for an empty body and raw text for non-JSON', async () => {
    const client = clientWith(mockFetch(() => new Response('')));
    expect(await client.request({ method: 'GET', path: '/x' })).toBeNull();

    const textClient = clientWith(mockFetch(() => new Response('plain')));
    expect(await textClient.request({ method: 'GET', path: '/x' })).toBe('plain');
  });

  it('wraps header-only pagination', async () => {
    const fetchFn = mockFetch(
      jsonResponse([{ id: 1 }], { headers: { 'X-Has-More': 'true', 'X-Total-Items': '42' } }),
    );
    expect(await clientWith(fetchFn).request({ method: 'GET', path: '/lists/top' })).toEqual({
      data: [{ id: 1 }],
      pagination: { has_more: true, total_items: 42 },
    });
  });

  it('includes only the pagination headers that are present', async () => {
    const fetchFn = mockFetch(jsonResponse({}, { headers: { 'X-Has-More': 'false' } }));
    expect(await clientWith(fetchFn).request({ method: 'GET', path: '/x' })).toEqual({
      data: {},
      pagination: { has_more: false },
    });
  });

  it('throws MdblistApiError with the API error message and Retry-After', async () => {
    const fetchFn = mockFetch(
      jsonResponse(
        { error: 'API rate limit exceeded!' },
        { status: 429, headers: { 'Retry-After': '30' } },
      ),
    );
    const error = await clientWith(fetchFn)
      .request({ method: 'GET', path: '/user' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MdblistApiError);
    expect(error).toMatchObject({
      status: 429,
      retryAfter: '30',
      message: 'MDBList API error 429: API rate limit exceeded!',
    });
  });

  it('throws a generic message when the error body has no error field', async () => {
    const fetchFn = mockFetch(() => new Response('<html>', { status: 502 }));
    await expect(
      clientWith(fetchFn).request({ method: 'GET', path: '/user' }),
    ).rejects.toMatchObject({ status: 502, retryAfter: null, message: 'MDBList API error 502' });
  });
});
