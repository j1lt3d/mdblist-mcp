import { mediaTools } from '../../src/tools/media.js';
import { describeTools } from './harness.js';

describeTools(
  'media',
  mediaTools,
  [
    [
      'get_media_info',
      {
        provider: 'imdb',
        media_type: 'movie',
        id: 'tt0111161',
        append_to_response: ['keyword', 'review'],
      },
      {
        method: 'GET',
        path: '/imdb/movie/tt0111161/',
        query: { append_to_response: 'keyword,review' },
      },
    ],
    [
      'get_watch_providers',
      { provider: 'tmdb', media_type: 'show', id: '1396' },
      { method: 'GET', path: '/tmdb/show/1396/watchprovider_links/' },
    ],
    [
      'search_media',
      { query: 'matrix', year: 1999 },
      { method: 'GET', path: '/search/any', query: { query: 'matrix', year: 1999 } },
    ],
    [
      'get_ratings',
      { media_type: 'movie', rating_source: 'imdb', ids: ['603'] },
      { method: 'POST', path: '/rating/movie/imdb', body: { ids: ['603'], provider: 'tmdb' } },
    ],
    [
      'discover_catalog',
      {
        media_type: 'show',
        genre: ['drama'],
        country: ['us', 'gb'],
        language: ['en'],
        append_to_response: ['poster'],
        limit: 10,
      },
      {
        method: 'GET',
        path: '/catalog/show',
        query: {
          genre: ['drama'],
          limit: 10,
          country: 'us,gb',
          language: 'en',
          append_to_response: 'poster',
        },
      },
    ],
    [
      'discover_catalog',
      { media_type: 'movie' },
      {
        method: 'GET',
        path: '/catalog/movie',
        query: { country: undefined, language: undefined, append_to_response: undefined },
      },
    ],
    ['get_genres', {}, { method: 'GET', path: '/genres', query: { anime: 0 } }],
    ['get_genres', { anime: true }, { method: 'GET', path: '/genres', query: { anime: 1 } }],
  ],
  [
    ['get_media_info', { provider: 'netflix', media_type: 'movie', id: '1' }],
    ['get_watch_providers', { provider: 'tmdb', media_type: 'show', id: '' }],
    ['discover_catalog', { media_type: 'movie', released_from: '01/01/2020' }],
    ['get_ratings', { media_type: 'movie', rating_source: 'imdb', ids: [] }],
  ],
);
