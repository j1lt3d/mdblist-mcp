import * as z from 'zod';
import { apiPath } from '../mdblist-client.js';
import {
  cursor,
  defineTool,
  idsBody,
  limit,
  mediaIds,
  moviesAndShows,
  offset,
  READ,
  REMOVE,
  requiredMediaIdLists,
  requireMedia,
  WRITE,
} from './shared.js';

const SYNC_PATHS = {
  watched: '/sync/watched',
  ratings: '/sync/ratings',
  collection: '/sync/collection',
  dropped: '/sync/dropped',
  seasons_dropped: '/sync/seasons/dropped',
} as const;

const UP_NEXT_PATHS = {
  next: '/upnext',
  upcoming: '/upnext/upcoming',
  upcoming_episodes: '/upnext/upcoming/episodes',
  watchlist: '/upnext/watchlist',
} as const;

const keys = <T extends object>(record: T) => Object.keys(record) as [keyof T, ...(keyof T)[]];

const timestamp = z.iso.datetime().optional().describe('ISO 8601 timestamp');

export const syncTools = [
  defineTool({
    name: 'get_sync',
    title: 'Get sync snapshot',
    description:
      "Get the user's watched history, ratings, collection, dropped shows or dropped seasons.",
    inputSchema: z.object({
      kind: z.enum(keys(SYNC_PATHS)),
      cursor,
      limit: limit(1000, 100),
      since: timestamp.describe('Only items updated after this ISO 8601 timestamp'),
      mediatype: z
        .enum(['movie', 'show', 'season', 'episode'])
        .optional()
        .describe('watched and collection only'),
      tmdb: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('seasons_dropped only: TMDb ID of one show'),
    }),
    annotations: READ,
    toRequest: ({ kind, ...query }) => ({ method: 'GET', path: SYNC_PATHS[kind], query }),
  }),

  defineTool({
    name: 'get_last_activities',
    title: 'Get last activities',
    description:
      'Get timestamps of when the user last changed watched items, ratings and other sync data.',
    inputSchema: z.object({}),
    annotations: READ,
    toRequest: () => ({ method: 'GET', path: '/sync/last_activities' }),
  }),

  defineTool({
    name: 'get_item_state',
    title: 'Get item state',
    description:
      'Get watched, rated, collected and watchlist state for up to 100 movies, shows or episodes.',
    inputSchema: z.object({
      media_type: z.enum(['movie', 'show', 'episode']),
      provider: z.enum(['tmdb', 'mdblist']).describe('Provider of the given IDs (episodes: tmdb)'),
      ids: z
        .array(z.union([z.number().int().positive(), z.string().min(1)]))
        .min(1)
        .max(100)
        .describe('TMDb IDs (integers) or MDBList IDs (strings)'),
    }),
    annotations: READ,
    toRequest: ({ media_type, provider, ids }) => ({
      method: 'POST',
      path: apiPath`/sync/state/${media_type}/${provider}`,
      body: { ids },
    }),
  }),

  defineTool({
    name: 'get_up_next',
    title: 'Get up next',
    description:
      'Get next episodes: next (in-progress shows), upcoming (caught-up shows airing soon), upcoming_episodes (every followed show) or watchlist (watchlisted shows).',
    inputSchema: z.object({
      view: z.enum(keys(UP_NEXT_PATHS)).default('next'),
      limit: limit(100, 20),
      offset,
      hide_unreleased: z.boolean().optional().describe('next only: exclude episodes airing today'),
      days: z
        .number()
        .int()
        .min(1)
        .max(90)
        .optional()
        .describe('upcoming views only: window in days (default 14)'),
    }),
    annotations: READ,
    toRequest: ({ view, ...query }) => ({ method: 'GET', path: UP_NEXT_PATHS[view], query }),
  }),

  defineTool({
    name: 'rate_media',
    title: 'Rate media',
    description: 'Add or update the user ratings of movies/shows.',
    inputSchema: requireMedia(
      moviesAndShows(
        z.object({
          ids: mediaIds,
          rating: z.number().positive().describe('Rating value, e.g. 8'),
          rated_at: timestamp,
        }),
      ),
    ),
    annotations: WRITE,
    toRequest: (body) => ({ method: 'POST', path: '/sync/ratings', body }),
  }),

  defineTool({
    name: 'remove_ratings',
    title: 'Remove ratings',
    description: 'Remove the user ratings of movies/shows (watched status is kept).',
    inputSchema: requiredMediaIdLists,
    annotations: REMOVE,
    toRequest: (input) => ({ method: 'POST', path: '/sync/ratings/remove', body: idsBody(input) }),
  }),

  defineTool({
    name: 'mark_watched',
    title: 'Mark watched',
    description: 'Mark movies or whole shows as watched for the user.',
    inputSchema: requireMedia(moviesAndShows(z.object({ ids: mediaIds, watched_at: timestamp }))),
    annotations: { ...WRITE, idempotentHint: false },
    toRequest: (body) => ({ method: 'POST', path: '/sync/watched', body }),
  }),

  defineTool({
    name: 'unmark_watched',
    title: 'Unmark watched',
    description: 'Remove the watched status of movies or whole shows (ratings are kept).',
    inputSchema: requiredMediaIdLists,
    annotations: REMOVE,
    toRequest: (input) => ({ method: 'POST', path: '/sync/watched/remove', body: idsBody(input) }),
  }),
];
