import * as z from 'zod';
import { apiPath } from '../mdblist-client.js';
import { csv, cursor, defineTool, limit, mediaRef, mediaType, READ, sortOrder } from './shared.js';

export const mediaTools = [
  defineTool({
    name: 'get_media_info',
    title: 'Get media info',
    description:
      'Get full details (ratings, scores, streams, IDs) for a movie or show by provider ID. Also finds similar titles: append "recommendations" for up to ~8 related movies/shows (sparse for niche titles).',
    inputSchema: mediaRef.extend({
      append_to_response: z
        .array(z.enum(['episode_ratings', 'extra', 'keyword', 'recommendations', 'review']))
        .optional()
        .describe('Extra sections to include; "recommendations" returns similar titles'),
    }),
    annotations: READ,
    toRequest: ({ provider, media_type, id, append_to_response }) => ({
      method: 'GET',
      path: apiPath`/${provider}/${media_type}/${id}/`,
      query: { append_to_response: csv(append_to_response) },
    }),
  }),

  defineTool({
    name: 'get_watch_providers',
    title: 'Get watch provider links',
    description:
      'Get direct streaming/watch-provider links for a movie or show (supporter feature; empty for others). May be rejected for API-key access; get_media_info also lists providers.',
    inputSchema: mediaRef,
    annotations: READ,
    // MDBList documents an empty result for non-supporters, yet answers API-key requests
    // with 403 "Invalid app secret" regardless of supporter status.
    errorHints: {
      403: 'This is an access rejection, not a supporter limit (non-supporters get an empty result). MDBList refuses this endpoint for API-key requests; use get_media_info, which includes streams and watch_providers.',
    },
    toRequest: ({ provider, media_type, id }) => ({
      method: 'GET',
      path: apiPath`/${provider}/${media_type}/${id}/watchprovider_links/`,
    }),
  }),

  defineTool({
    name: 'search_media',
    title: 'Search media',
    description: 'Search movies and shows by title.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Search text'),
      media_type: mediaRef.shape.media_type.default('any'),
      year: z.number().int().optional().describe('Release year (matches ±1)'),
      limit: z.number().int().positive().optional().describe('Maximum number of results'),
      limit_by_score: z.number().int().min(0).max(100).optional().describe('Minimum score'),
      sort_by_score: z.boolean().optional().describe('Sort results by score'),
    }),
    annotations: READ,
    toRequest: ({ media_type, ...query }) => ({
      method: 'GET',
      path: apiPath`/search/${media_type}`,
      query,
    }),
  }),

  defineTool({
    name: 'get_ratings',
    title: 'Get ratings (batch)',
    description:
      'Get one rating source for many movies or shows at once. Max 10 IDs per call (100 for supporters).',
    inputSchema: z.object({
      media_type: mediaType,
      rating_source: z.enum([
        'audience',
        'imdb',
        'letterboxd',
        'mal',
        'metacritic',
        'rogerebert',
        'score',
        'score_average',
        'tmdb',
        'tomatoes',
        'trakt',
      ]),
      provider: z.enum(['tmdb', 'imdb']).default('tmdb').describe('Provider of the given IDs'),
      ids: z.array(z.string().min(1)).min(1).max(100).describe('Provider IDs'),
    }),
    annotations: READ,
    toRequest: ({ media_type, rating_source, provider, ids }) => ({
      method: 'POST',
      path: apiPath`/rating/${media_type}/${rating_source}`,
      body: { ids, provider },
    }),
  }),

  defineTool({
    name: 'discover_catalog',
    title: 'Discover catalog',
    description: 'Browse the movie or show catalog with filters and sorting.',
    inputSchema: z.object({
      media_type: mediaType,
      genre: z.array(z.string()).optional().describe('Genre names, e.g. ["action", "comedy"]'),
      genre_mode: z.enum(['and', 'or']).optional().describe('How to match genres (default or)'),
      country: z.array(z.string().length(2)).max(10).optional().describe('ISO 3166-1 codes'),
      language: z.array(z.string().length(2)).max(10).optional().describe('ISO 639-1 codes'),
      score_min: z.number().int().min(0).max(100).optional(),
      score_max: z.number().int().min(0).max(100).optional(),
      released_from: z.iso.date().optional().describe('YYYY-MM-DD'),
      released_to: z.iso.date().optional().describe('YYYY-MM-DD'),
      year_min: z.number().int().optional(),
      year_max: z.number().int().optional(),
      runtime_min: z.number().int().min(0).optional().describe('Minutes'),
      runtime_max: z.number().int().min(0).optional().describe('Minutes'),
      sort: z
        .enum([
          'imdbpopular',
          'imdbrating',
          'imdbvotes',
          'letterrating',
          'metacritic',
          'released',
          'releasedigital',
          'rtaudience',
          'rtomatoes',
          'score',
          'score_average',
          'title',
          'tmdbpopular',
        ])
        .optional(),
      sort_order: sortOrder.optional(),
      append_to_response: z
        .array(z.enum(['poster', 'ratings', 'description', 'genres']))
        .optional(),
      limit: limit(100, 100),
      cursor,
    }),
    annotations: READ,
    toRequest: ({ media_type, country, language, append_to_response, ...query }) => ({
      method: 'GET',
      path: apiPath`/catalog/${media_type}`,
      query: {
        ...query,
        country: csv(country),
        language: csv(language),
        append_to_response: csv(append_to_response),
      },
    }),
  }),

  defineTool({
    name: 'get_genres',
    title: 'Get genres',
    description: 'List available genres (use the slugs to filter catalogs and lists).',
    inputSchema: z.object({ anime: z.boolean().default(false).describe('Return anime genres') }),
    annotations: READ,
    toRequest: ({ anime }) => ({ method: 'GET', path: '/genres', query: { anime: anime ? 1 : 0 } }),
  }),
];
