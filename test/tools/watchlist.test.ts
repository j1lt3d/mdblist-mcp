import { watchlistTools } from '../../src/tools/watchlist.js';
import { describeTools } from './harness.js';

describeTools(
  'watchlist',
  watchlistTools,
  [
    [
      'get_watchlist',
      { mediatype: 'movie' },
      {
        method: 'GET',
        path: '/watchlist/items',
        query: { mediatype: 'movie', limit: 100, append_to_response: undefined },
      },
    ],
    [
      'add_watchlist_items',
      { movies: [{ imdb: 'tt0111161', tmdb: 278 }] },
      {
        method: 'POST',
        path: '/watchlist/items/add',
        body: { movies: [{ ids: { imdb: 'tt0111161', tmdb: 278 } }], shows: undefined },
      },
    ],
    [
      'remove_watchlist_items',
      { shows: [{ tmdb: 1396 }] },
      {
        method: 'POST',
        path: '/watchlist/items/remove',
        body: { movies: undefined, shows: [{ ids: { tmdb: 1396 } }] },
      },
    ],
  ],
  [
    ['add_watchlist_items', {}],
    ['add_watchlist_items', { movies: [], shows: [] }],
    ['add_watchlist_items', { movies: [{}] }],
  ],
);
