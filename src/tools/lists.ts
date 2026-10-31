import * as z from 'zod';
import { apiPath } from '../mdblist-client.js';
import {
  defineTool,
  listId,
  listItemsParams,
  listItemsQuery,
  mapMoviesAndShows,
  mediaIdLists,
  offset,
  READ,
  REMOVE,
  requireMedia,
  WRITE,
  type MediaIds,
} from './shared.js';

/** Every way MDBList addresses a list; each maps to its own metadata and items routes. */
const listRef = z
  .union([
    z.strictObject({ id: listId }),
    z.strictObject({
      username: z.string().min(1).describe('List owner'),
      listname: z.string().min(1).describe('List slug'),
    }),
    z.strictObject({
      official: z
        .enum([
          'anticipated',
          'justwatch-streaming-charts',
          'most-watched',
          'most-watched-week',
          'moviemeter',
          'popular',
          'trending',
        ])
        .describe('Official MDBList list slug'),
    }),
    z.strictObject({ share_token: z.string().min(1).describe('Token of an unlisted shared list') }),
    z.strictObject({ external_id: listId.describe('Numeric external list ID') }),
  ])
  .describe('The list: {id}, {username, listname}, {official}, {share_token} or {external_id}');
type ListRef = z.infer<typeof listRef>;

function listPath(list: ListRef): string {
  if ('id' in list) return apiPath`/lists/${list.id}`;
  if ('listname' in list) return apiPath`/lists/${list.username}/${list.listname}`;
  if ('official' in list) return apiPath`/lists/official/${list.official}`;
  if ('share_token' in list) return apiPath`/lists/share/${list.share_token}`;
  return apiPath`/external/lists/${list.external_id}`;
}

/** `source` values of lists imported from other services; official lists use "official". */
const EXTERNAL_SOURCES = new Set(['imdb', 'trakt', 'letterboxd']);
/** Keys under which MDBList wraps list rows (`{data}`, `{lists}`, membership `{contains}`). */
const ROW_WRAPPERS = ['data', 'lists', 'contains'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function markRow(row: unknown, external: boolean): unknown {
  if (!isRecord(row) || !('id' in row)) return row;
  const { source } = row;
  const isExternal =
    external || (typeof source === 'string' && EXTERNAL_SOURCES.has(source.toLowerCase()));
  if (!isExternal) return row;
  const { id, ...rest } = row;
  return { external_id: id, ...rest };
}

/**
 * External (IMDb, Trakt, Letterboxd) list rows carry a plain `id` that only works as
 * {external_id}: passed as {id} it hits /lists/{id}, which 404s or, worse, returns an
 * unrelated MDBList list with the same number. Renaming the key lets the model copy it
 * into the right field. Rows are recognised by their `source`, or all treated as
 * external when `external` is set (responses from the external-list endpoints).
 * Handles bare arrays, single objects, and rows wrapped in {data}, {lists} or {contains}.
 */
export function markExternalLists(data: unknown, external = false): unknown {
  if (Array.isArray(data)) return data.map((row: unknown) => markRow(row, external));
  if (!isRecord(data)) return data;
  for (const key of ROW_WRAPPERS) {
    const rows = data[key];
    if (Array.isArray(rows)) {
      return { ...data, [key]: rows.map((row: unknown) => markRow(row, external)) };
    }
  }
  return markRow(data, external);
}

/** 404 hints that depend on how the list was addressed, so they never suggest the form already used. */
function listNotFoundHint(status: number, list: ListRef): string | undefined {
  if (status !== 404) return undefined;
  if ('id' in list) {
    return "If this is an IMDb, Trakt or Letterboxd list (from browse_lists source 'external'), retry with list: {external_id: N} instead of {id: N}.";
  }
  if ('external_id' in list) {
    return "No connected external list has this external_id; get current values from browse_lists source 'external'.";
  }
  return undefined;
}

const LIST_SOURCES = {
  top: '/lists/top',
  curated: '/lists/curated',
  liked: '/lists/liked',
  official: '/lists/official',
  external: '/external/lists/user',
} as const;
const PAGINATED_SOURCES = new Set<keyof typeof LIST_SOURCES>(['top', 'curated', 'liked']);

export const listTools = [
  defineTool({
    name: 'get_user_lists',
    title: 'Get user lists',
    description:
      "List the authenticated user's MDBList-made lists, or another user's public lists. Excludes lists imported from IMDb, Trakt or Letterboxd: use browse_lists with source 'external' for those.",
    inputSchema: z.object({
      username: z.string().min(1).optional().describe('Omit for your own lists'),
      sort: z.enum(['created', 'name', 'ranked']).optional(),
      unified: z.boolean().optional().describe('Merge twin movie+show list pairs'),
    }),
    annotations: READ,
    toRequest: ({ username, ...query }) => ({
      method: 'GET',
      path: username === undefined ? '/lists/user' : apiPath`/lists/user/${username}`,
      query,
    }),
    transformResult: (data) => markExternalLists(data),
  }),

  defineTool({
    name: 'browse_lists',
    title: 'Browse lists',
    description:
      'Browse lists: top public lists, curated lists, your liked lists, official MDBList lists, or your connected external lists. External lists are returned with external_id: pass it to get_list/get_list_items as list: {external_id}.',
    inputSchema: z.object({
      source: z.enum(['top', 'curated', 'liked', 'official', 'external']),
      limit: z.number().int().positive().optional().describe('top, curated and liked only'),
      offset: offset.describe('top, curated and liked only'),
    }),
    annotations: READ,
    toRequest: ({ source, ...page }) => ({
      method: 'GET',
      path: LIST_SOURCES[source],
      query: PAGINATED_SOURCES.has(source) ? page : {},
    }),
    transformResult: (data, { source }) => markExternalLists(data, source === 'external'),
  }),

  defineTool({
    name: 'search_lists',
    title: 'Search lists',
    description: 'Search public lists by title.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Search text'),
      limit: z.number().int().positive().optional(),
      offset,
    }),
    annotations: READ,
    toRequest: (query) => ({ method: 'GET', path: '/lists/search', query }),
    transformResult: (data) => markExternalLists(data),
  }),

  defineTool({
    name: 'get_list',
    title: 'Get list',
    description: 'Get metadata (name, owner, item count, likes) of a list.',
    inputSchema: z.object({ list: listRef }),
    annotations: READ,
    errorHint: (status, { list }) => listNotFoundHint(status, list),
    toRequest: ({ list }) => ({ method: 'GET', path: listPath(list) }),
    transformResult: (data, { list }) => markExternalLists(data, 'external_id' in list),
  }),

  defineTool({
    name: 'get_list_items',
    title: 'Get list items',
    description: 'Get the movies and shows in a list, with filtering, sorting and pagination.',
    inputSchema: listItemsQuery.extend({ list: listRef }),
    annotations: READ,
    errorHint: (status, { list }) => listNotFoundHint(status, list),
    toRequest: ({ list, ...query }) => ({
      method: 'GET',
      path: `${listPath(list)}/items`,
      query: listItemsParams(query),
    }),
  }),

  defineTool({
    name: 'get_list_membership',
    title: 'Get list membership',
    description: "Find which of the user's static lists contain a movie, show, season or episode.",
    inputSchema: z
      .object({
        mediatype: z.enum(['movie', 'show', 'season', 'episode']),
        tmdb: z.number().int().positive().optional().describe('TMDb ID'),
        imdb: z.string().optional().describe('IMDb ID (movie/show only)'),
        trakt: z.number().int().positive().optional().describe('Trakt ID (movie/show only)'),
        tvdb: z.number().int().positive().optional().describe('TVDb ID (movie/show only)'),
        include_shared: z.boolean().optional().describe('Also check lists shared with the user'),
      })
      .refine(
        ({ tmdb, imdb, trakt, tvdb }) => [tmdb, imdb, trakt, tvdb].some((id) => id !== undefined),
        {
          message: 'Provide at least one of tmdb, imdb, trakt or tvdb',
        },
      ),
    annotations: READ,
    toRequest: (query) => ({ method: 'GET', path: '/lists/user/membership', query }),
    transformResult: (data) => markExternalLists(data),
  }),

  ...(['add', 'remove'] as const).map((action) =>
    defineTool({
      name: `${action}_list_items`,
      title: `${action === 'add' ? 'Add' : 'Remove'} list items`,
      description: `${action === 'add' ? 'Add movies/shows to' : 'Remove movies/shows from'} one of the user's static lists.`,
      inputSchema: requireMedia(mediaIdLists.extend({ list_id: listId })),
      annotations: action === 'add' ? WRITE : REMOVE,
      toRequest: ({ list_id, ...input }) => ({
        method: 'POST',
        path: apiPath`/lists/${list_id}/items/${action}`,
        body: mapMoviesAndShows(input, (ids: MediaIds) => ids),
      }),
    }),
  ),

  defineTool({
    name: 'create_list',
    title: 'Create list',
    description: 'Create a new static list for the user.',
    inputSchema: z.object({
      name: z.string().min(1),
      private: z.boolean().optional(),
    }),
    annotations: { ...WRITE, idempotentHint: false },
    toRequest: (body) => ({ method: 'POST', path: '/lists/user/add', body }),
  }),

  defineTool({
    name: 'delete_list',
    title: 'Delete list',
    description:
      "Permanently delete one of the user's static lists (dynamic, official and external lists cannot be deleted).",
    inputSchema: z.object({ list_id: listId }),
    annotations: REMOVE,
    toRequest: ({ list_id }) => ({ method: 'DELETE', path: apiPath`/lists/${list_id}` }),
  }),
];
