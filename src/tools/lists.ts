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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function markRow(row: unknown): unknown {
  if (!isRecord(row) || !('id' in row)) return row;
  // `id` is the number /external/lists/{n} routes on, so it always becomes external_id and
  // no plain `id` is left for the model to misuse. MDBList doesn't send its own external_id
  // today; if it ever does, keep it under another name rather than drop either value.
  const { id, external_id: sourceExternalId, ...rest } = row;
  return {
    external_id: id,
    ...rest,
    ...(sourceExternalId !== undefined && { source_external_id: sourceExternalId }),
  };
}

/**
 * Responses from the external-list endpoints (IMDb, Trakt, Letterboxd imports) carry a
 * plain `id` that only works as {external_id}: passed as {id} it hits /lists/{id},
 * which 404s or, worse, returns an unrelated MDBList list with the same number.
 * Renaming the key lets the model copy it into the right field. Only call this on
 * responses known to be external; other endpoints' `id`s are real MDBList list IDs.
 * Both external endpoints return a bare array of rows; a single row object is also handled.
 */
export function markExternalLists(data: unknown): unknown {
  return Array.isArray(data) ? data.map(markRow) : markRow(data);
}

/** 404 hints that depend on how the list was addressed, so they never suggest the form already used. */
function listNotFoundHint(status: number, { list }: { list: ListRef }): string | undefined {
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
    transformResult: (data, { source }) => (source === 'external' ? markExternalLists(data) : data),
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
  }),

  defineTool({
    name: 'get_list',
    title: 'Get list',
    description: 'Get metadata (name, owner, item count, likes) of a list.',
    inputSchema: z.object({ list: listRef }),
    annotations: READ,
    errorHint: listNotFoundHint,
    toRequest: ({ list }) => ({ method: 'GET', path: listPath(list) }),
    transformResult: (data, { list }) => ('external_id' in list ? markExternalLists(data) : data),
  }),

  defineTool({
    name: 'get_list_items',
    title: 'Get list items',
    description: 'Get the movies and shows in a list, with filtering, sorting and pagination.',
    inputSchema: listItemsQuery.extend({ list: listRef }),
    annotations: READ,
    errorHint: listNotFoundHint,
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
