import { vi } from 'vitest';
import { MdblistClient } from '../src/mdblist-client.js';

export const API_KEY = 'test-key';

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export function mockFetch(response: Response | (() => Response) = jsonResponse({ ok: true })) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(typeof response === 'function' ? response() : response),
  );
}

export function clientWith(fetchFn: typeof fetch): MdblistClient {
  return new MdblistClient(API_KEY, fetchFn);
}

/** Returns the URL and init of the nth fetch call. */
export function fetchCall(fetchFn: ReturnType<typeof mockFetch>, n = 0) {
  const call = fetchFn.mock.calls[n];
  if (!call) throw new Error(`fetch call ${String(n)} not made`);
  const [input, init] = call;
  return { url: new URL(input instanceof Request ? input.url : input), init: init ?? {} };
}
