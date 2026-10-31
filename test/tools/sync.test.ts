import { syncTools } from '../../src/tools/sync.js';
import { describeTools } from './harness.js';

describeTools(
  'sync',
  syncTools,
  [
    [
      'get_sync',
      { kind: 'watched', mediatype: 'movie', since: '2025-01-01T00:00:00Z' },
      {
        method: 'GET',
        path: '/sync/watched',
        query: { mediatype: 'movie', since: '2025-01-01T00:00:00Z' },
      },
    ],
    ['get_sync', { kind: 'ratings' }, { method: 'GET', path: '/sync/ratings', query: {} }],
    [
      'get_sync',
      { kind: 'collection', limit: 500 },
      { method: 'GET', path: '/sync/collection', query: { limit: 500 } },
    ],
    [
      'get_sync',
      { kind: 'dropped', cursor: 'abc' },
      { method: 'GET', path: '/sync/dropped', query: { cursor: 'abc' } },
    ],
    [
      'get_sync',
      { kind: 'seasons_dropped', tmdb: 1396 },
      { method: 'GET', path: '/sync/seasons/dropped', query: { tmdb: 1396 } },
    ],
    ['get_last_activities', {}, { method: 'GET', path: '/sync/last_activities' }],
    [
      'get_item_state',
      { media_type: 'movie', provider: 'tmdb', ids: [603, 604] },
      { method: 'POST', path: '/sync/state/movie/tmdb', body: { ids: [603, 604] } },
    ],
    [
      'get_up_next',
      { limit: 5, hide_unreleased: true },
      { method: 'GET', path: '/upnext', query: { limit: 5, hide_unreleased: true } },
    ],
    [
      'get_up_next',
      { view: 'upcoming', days: 30 },
      { method: 'GET', path: '/upnext/upcoming', query: { days: 30 } },
    ],
    [
      'get_up_next',
      { view: 'upcoming_episodes' },
      { method: 'GET', path: '/upnext/upcoming/episodes', query: {} },
    ],
    [
      'get_up_next',
      { view: 'watchlist', offset: 20 },
      { method: 'GET', path: '/upnext/watchlist', query: { offset: 20 } },
    ],
    [
      'rate_media',
      { movies: [{ ids: { tmdb: 24428 }, rating: 8, rated_at: '2025-10-21T14:00:00Z' }] },
      {
        method: 'POST',
        path: '/sync/ratings',
        body: { movies: [{ ids: { tmdb: 24428 }, rating: 8, rated_at: '2025-10-21T14:00:00Z' }] },
      },
    ],
    [
      'remove_ratings',
      { movies: [{ tmdb: 24428 }] },
      {
        method: 'POST',
        path: '/sync/ratings/remove',
        body: { movies: [{ ids: { tmdb: 24428 } }], shows: undefined },
      },
    ],
    [
      'mark_watched',
      { shows: [{ ids: { imdb: 'tt0903747' } }] },
      { method: 'POST', path: '/sync/watched', body: { shows: [{ ids: { imdb: 'tt0903747' } }] } },
    ],
    [
      'unmark_watched',
      { shows: [{ imdb: 'tt0903747' }] },
      {
        method: 'POST',
        path: '/sync/watched/remove',
        body: { movies: undefined, shows: [{ ids: { imdb: 'tt0903747' } }] },
      },
    ],
  ],
  [
    ['get_sync', { kind: 'history' }],
    ['get_sync', { kind: 'watched', limit: 5000 }],
    ['get_item_state', { media_type: 'season', provider: 'tmdb', ids: [1] }],
    ['get_item_state', { media_type: 'movie', provider: 'tmdb', ids: [] }],
    ['get_up_next', { view: 'upcoming', days: 365 }],
    ['rate_media', { movies: [{ ids: { tmdb: 1 } }] }],
    ['remove_ratings', {}],
    ['mark_watched', { movies: [{ ids: { tmdb: 1 }, watched_at: 'yesterday' }] }],
    ['unmark_watched', { movies: [{}] }],
  ],
);
