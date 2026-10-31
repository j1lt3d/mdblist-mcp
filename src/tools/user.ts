import * as z from 'zod';
import { apiPath } from '../mdblist-client.js';
import { defineTool, READ } from './shared.js';

export const userTools = [
  defineTool({
    name: 'get_user',
    title: 'Get user',
    description:
      "Get the authenticated user's profile, supporter status and API rate limits, or another user's public profile.",
    inputSchema: z.object({
      username: z.string().min(1).optional().describe('Omit for your own profile'),
    }),
    annotations: READ,
    toRequest: ({ username }) => ({
      method: 'GET',
      path: username === undefined ? '/user' : apiPath`/users/${username}`,
    }),
  }),

  defineTool({
    name: 'get_user_stats',
    title: 'Get user stats',
    description: "Get the authenticated user's precalculated watch statistics.",
    inputSchema: z.object({}),
    annotations: READ,
    toRequest: () => ({ method: 'GET', path: '/user/stats' }),
  }),
];
