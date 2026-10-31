import type { ToolAnnotations } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { ApiRequest } from '../mdblist-client.js';

export interface ToolDefinition<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  inputSchema: Schema;
  annotations: ToolAnnotations;
  /** Explanations appended to API errors with the given HTTP status. */
  errorHints?: Partial<Record<number, string>>;
  // Method syntax keeps the parameter bivariant so heterogeneous tools fit in one array.
  toRequest(args: z.infer<Schema>): ApiRequest;
}

export const defineTool = <Schema extends z.ZodObject>(
  tool: ToolDefinition<Schema>,
): ToolDefinition => tool;

export const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };
export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
export const REMOVE: ToolAnnotations = { ...WRITE, destructiveHint: true };

export const csv = (values?: readonly string[]): string | undefined => values?.join(',');

// ---- Shared schemas (enums copied from the MDBList OpenAPI spec) ----

export const mediaType = z.enum(['movie', 'show']);
export const sortOrder = z.enum(['asc', 'desc']);
export const listId = z.number().int().positive().describe('Numeric MDBList list ID');
export const limit = (max: number, fallback: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .optional()
    .describe(`Items per page (default ${String(fallback)})`);
export const offset = z.number().int().min(0).optional().describe('Number of items to skip');
export const cursor = z
  .string()
  .optional()
  .describe('Pagination cursor: `next_cursor` from the previous response');

/** Identifies one movie or show by any supported provider ID. */
export const mediaRef = z.object({
  provider: z.enum(['imdb', 'tmdb', 'trakt', 'tvdb', 'mal', 'mdblist']),
  media_type: z.enum(['any', 'movie', 'show']),
  id: z.string().min(1).describe('ID from the given provider, e.g. tt0111161 for IMDb'),
});

export const mediaIds = z
  .object({
    imdb: z.string().optional().describe('IMDb ID, e.g. tt0111161'),
    tmdb: z.number().int().positive().optional().describe('TMDb ID, e.g. 278'),
  })
  .refine((ids) => ids.imdb !== undefined || ids.tmdb !== undefined, {
    message: 'Provide at least one of imdb or tmdb',
  });
export type MediaIds = z.infer<typeof mediaIds>;

export const moviesAndShows = <Item extends z.ZodType>(item: Item) =>
  z.object({
    movies: z.array(item).optional().describe('Movies'),
    shows: z.array(item).optional().describe('Shows'),
  });

interface MediaLists {
  movies?: unknown[];
  shows?: unknown[];
}

export const requireMedia = <Schema extends z.ZodObject>(schema: Schema) =>
  schema.refine(
    (input) =>
      ((input as MediaLists).movies?.length ?? 0) + ((input as MediaLists).shows?.length ?? 0) > 0,
    { message: 'Provide at least one movie or show' },
  );

export const mapMoviesAndShows = <In, Out>(
  input: { movies?: In[]; shows?: In[] },
  map: (item: In) => Out,
) => ({ movies: input.movies?.map(map), shows: input.shows?.map(map) });

/** Movies/shows given as bare IDs; the shared input of every add/remove-by-ID endpoint. */
export const mediaIdLists = moviesAndShows(mediaIds);
export const requiredMediaIdLists = requireMedia(mediaIdLists);
/** `{movies: [{ids}], shows: [{ids}]}`, the body shape of the watchlist and sync endpoints. */
export const idsBody = (input: { movies?: MediaIds[]; shows?: MediaIds[] }) =>
  mapMoviesAndShows(input, (ids) => ({ ids }));

const LIST_ITEMS_PAGE_SIZE = 100;

export const listItemsQuery = z.object({
  cursor,
  limit: limit(1000, LIST_ITEMS_PAGE_SIZE),
  mediatype: z.enum(['movie', 'show', 'season', 'episode']).optional(),
  filter_title: z.string().optional().describe('Filter by title'),
  filter_genre: z.string().optional().describe('Filter by genre slug'),
  sort: z
    .enum([
      'added',
      'budget',
      'imdbpopular',
      'imdbrating',
      'imdbvotes',
      'last_air_date',
      'letterrating',
      'lettervotes',
      'metacritic',
      'myanimelist',
      'random',
      'rank',
      'released',
      'releasedigital',
      'revenue',
      'rogerebert',
      'rtaudience',
      'rtomatoes',
      'runtime',
      'score',
      'score_average',
      'sort_title',
      'title',
      'tmdbpopular',
      'usort',
    ])
    .optional(),
  order: sortOrder.optional(),
  unified: z.boolean().optional().describe('Return movies and shows in a single list'),
  append_to_response: z
    .array(z.enum(['genres', 'poster', 'description', 'ratings']))
    .optional()
    .describe('Extra fields to include per item'),
});
type ListItemsQuery = z.infer<typeof listItemsQuery>;

/**
 * Without `limit` or `cursor`, MDBList falls back to deprecated offset paging and returns up
 * to 1000 items, so always send a limit to get cursor paging with a bounded page.
 */
export const listItemsParams = ({
  append_to_response,
  limit = LIST_ITEMS_PAGE_SIZE,
  ...query
}: ListItemsQuery) => ({
  ...query,
  limit,
  append_to_response: csv(append_to_response),
});
