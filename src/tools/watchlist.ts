import { apiPath } from '../mdblist-client.js';
import {
  defineTool,
  idsBody,
  listItemsParams,
  listItemsQuery,
  READ,
  REMOVE,
  requiredMediaIdLists,
  WRITE,
} from './shared.js';

export const watchlistTools = [
  defineTool({
    name: 'get_watchlist',
    title: 'Get watchlist',
    description: "Get the authenticated user's watchlist items.",
    inputSchema: listItemsQuery,
    annotations: READ,
    toRequest: (query) => ({
      method: 'GET',
      path: '/watchlist/items',
      query: listItemsParams(query),
    }),
  }),

  ...(['add', 'remove'] as const).map((action) =>
    defineTool({
      name: `${action}_watchlist_items`,
      title: `${action === 'add' ? 'Add to' : 'Remove from'} watchlist`,
      description: `${action === 'add' ? 'Add movies/shows to' : 'Remove movies/shows from'} the user's watchlist.`,
      inputSchema: requiredMediaIdLists,
      annotations: action === 'add' ? WRITE : REMOVE,
      toRequest: (input) => ({
        method: 'POST',
        path: apiPath`/watchlist/items/${action}`,
        body: idsBody(input),
      }),
    }),
  ),
];
