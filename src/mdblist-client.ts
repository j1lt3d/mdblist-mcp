export const MDBLIST_BASE_URL = 'https://api.mdblist.com';
const REQUEST_TIMEOUT_MS = 30_000;

export type QueryValue = string | number | boolean | readonly string[] | undefined;

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export class MdblistApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
    this.name = 'MdblistApiError';
  }
}

/** Tagged template that URI-encodes every interpolated path segment. */
export function apiPath(strings: TemplateStringsArray, ...segments: (string | number)[]): string {
  return String.raw({ raw: strings }, ...segments.map((segment) => encodeURIComponent(segment)));
}

function parseBody(text: string): unknown {
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(status: number, data: unknown): string {
  const detail =
    typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : undefined;
  return `MDBList API error ${String(status)}${detail ? `: ${detail}` : ''}`;
}

/**
 * Some MDBList endpoints (e.g. /lists/top, /lists/search) only report pagination
 * via X-Has-More / X-Total-Items headers, so surface them alongside the body.
 */
function withHeaderPagination(data: unknown, headers: Headers): unknown {
  const hasMore = headers.get('x-has-more');
  const totalItems = headers.get('x-total-items');
  if (hasMore === null && totalItems === null) return data;
  return {
    data,
    pagination: {
      ...(hasMore !== null && { has_more: hasMore === 'true' }),
      ...(totalItems !== null && { total_items: Number(totalItems) }),
    },
  };
}

export class MdblistClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly baseUrl: string = MDBLIST_BASE_URL,
  ) {}

  async request({ method, path, query = {}, body }: ApiRequest): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        url.searchParams.append(key, String(item));
      }
    }
    url.searchParams.set('apikey', this.apiKey);

    const response = await this.fetchFn(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = parseBody(await response.text());
    if (!response.ok) {
      throw new MdblistApiError(
        response.status,
        errorMessage(response.status, data),
        response.headers.get('retry-after'),
      );
    }
    return withHeaderPagination(data, response.headers);
  }
}
