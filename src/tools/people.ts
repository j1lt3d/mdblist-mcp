import * as z from 'zod';
import { apiPath } from '../mdblist-client.js';
import { defineTool, offset, READ, REMOVE, WRITE } from './shared.js';

const tmdbPersonId = z.number().int().positive().describe('TMDb person ID');

export const peopleTools = [
  defineTool({
    name: 'get_person',
    title: 'Get person',
    description: 'Get details of a person (actor, director, …) by TMDb person ID.',
    inputSchema: z.object({ tmdb_id: tmdbPersonId }),
    annotations: READ,
    toRequest: ({ tmdb_id }) => ({ method: 'GET', path: apiPath`/people/${tmdb_id}` }),
  }),

  defineTool({
    name: 'get_favorite_people',
    title: 'Get favorite people',
    description:
      "Get the user's favorited people, or (upcoming=true) upcoming movies/episodes featuring them.",
    inputSchema: z.object({
      upcoming: z.boolean().default(false).describe('Return upcoming releases instead'),
      limit: z.number().int().positive().optional(),
      offset,
    }),
    annotations: READ,
    toRequest: ({ upcoming, ...query }) => ({
      method: 'GET',
      path: upcoming ? '/people/favorites/upcoming' : '/people/favorites',
      query,
    }),
  }),

  defineTool({
    name: 'favorite_person',
    title: 'Favorite person',
    description: "Add a person to the user's favorites (subject to a tier-based limit).",
    inputSchema: z.object({
      tmdb_id: tmdbPersonId,
      role: z.enum(['actor', 'director']).optional().describe('Default actor'),
    }),
    annotations: WRITE,
    toRequest: ({ tmdb_id, role }) => ({
      method: 'PUT',
      path: apiPath`/people/${tmdb_id}/favorite`,
      body: { role },
    }),
  }),

  defineTool({
    name: 'unfavorite_person',
    title: 'Unfavorite person',
    description: "Remove a person from the user's favorites.",
    inputSchema: z.object({ tmdb_id: tmdbPersonId }),
    annotations: REMOVE,
    toRequest: ({ tmdb_id }) => ({ method: 'DELETE', path: apiPath`/people/${tmdb_id}/favorite` }),
  }),
];
