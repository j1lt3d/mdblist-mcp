import { peopleTools } from '../../src/tools/people.js';
import { describeTools } from './harness.js';

describeTools(
  'people',
  peopleTools,
  [
    ['get_person', { tmdb_id: 500 }, { method: 'GET', path: '/people/500' }],
    [
      'get_favorite_people',
      { limit: 10 },
      { method: 'GET', path: '/people/favorites', query: { limit: 10 } },
    ],
    [
      'get_favorite_people',
      { upcoming: true, offset: 20 },
      { method: 'GET', path: '/people/favorites/upcoming', query: { offset: 20 } },
    ],
    [
      'favorite_person',
      { tmdb_id: 138, role: 'director' },
      { method: 'PUT', path: '/people/138/favorite', body: { role: 'director' } },
    ],
    ['unfavorite_person', { tmdb_id: 138 }, { method: 'DELETE', path: '/people/138/favorite' }],
  ],
  [
    ['get_person', { tmdb_id: -1 }],
    ['favorite_person', { tmdb_id: 138, role: 'writer' }],
  ],
);
