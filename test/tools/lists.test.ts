import { describe, expect, it } from 'vitest';
import { listTools, markExternalLists } from '../../src/tools/lists.js';
import { describeTools } from './harness.js';

describeTools(
  'list',
  listTools,
  [
    [
      'get_user_lists',
      { sort: 'name' },
      { method: 'GET', path: '/lists/user', query: { sort: 'name' } },
    ],
    [
      'get_user_lists',
      { username: 'some user' },
      { method: 'GET', path: '/lists/user/some%20user', query: {} },
    ],
    [
      'browse_lists',
      { source: 'top', offset: 10 },
      { method: 'GET', path: '/lists/top', query: { offset: 10 } },
    ],
    [
      'browse_lists',
      { source: 'curated', limit: 5 },
      { method: 'GET', path: '/lists/curated', query: { limit: 5 } },
    ],
    ['browse_lists', { source: 'liked' }, { method: 'GET', path: '/lists/liked', query: {} }],
    [
      'browse_lists',
      { source: 'official', limit: 5 },
      { method: 'GET', path: '/lists/official', query: {} },
    ],
    [
      'browse_lists',
      { source: 'external', offset: 1 },
      { method: 'GET', path: '/external/lists/user', query: {} },
    ],
    [
      'search_lists',
      { query: 'horror', limit: 5 },
      { method: 'GET', path: '/lists/search', query: { query: 'horror', limit: 5 } },
    ],
    ['get_list', { list: { id: 14 } }, { method: 'GET', path: '/lists/14' }],
    [
      'get_list',
      { list: { username: 'jane', listname: 'best of 2024' } },
      { method: 'GET', path: '/lists/jane/best%20of%202024' },
    ],
    [
      'get_list',
      { list: { official: 'trending' } },
      { method: 'GET', path: '/lists/official/trending' },
    ],
    ['get_list', { list: { share_token: 'a/b' } }, { method: 'GET', path: '/lists/share/a%2Fb' }],
    ['get_list', { list: { external_id: 9 } }, { method: 'GET', path: '/external/lists/9' }],
    [
      'get_list_items',
      {
        list: { id: 14 },
        limit: 50,
        sort: 'score',
        order: 'desc',
        append_to_response: ['genres', 'poster'],
      },
      {
        method: 'GET',
        path: '/lists/14/items',
        query: { limit: 50, sort: 'score', order: 'desc', append_to_response: 'genres,poster' },
      },
    ],
    [
      'get_list_items',
      { list: { official: 'popular' }, mediatype: 'show' },
      {
        method: 'GET',
        path: '/lists/official/popular/items',
        query: { mediatype: 'show', limit: 100, append_to_response: undefined },
      },
    ],
    [
      'get_list_items',
      { list: { username: 'jane', listname: 'faves' } },
      {
        method: 'GET',
        path: '/lists/jane/faves/items',
        query: { limit: 100, append_to_response: undefined },
      },
    ],
    [
      'get_list_items',
      { list: { share_token: 'tok' } },
      {
        method: 'GET',
        path: '/lists/share/tok/items',
        query: { limit: 100, append_to_response: undefined },
      },
    ],
    [
      'get_list_items',
      { list: { external_id: 3 } },
      {
        method: 'GET',
        path: '/external/lists/3/items',
        query: { limit: 100, append_to_response: undefined },
      },
    ],
    [
      'get_list_membership',
      { mediatype: 'movie', imdb: 'tt0111161' },
      {
        method: 'GET',
        path: '/lists/user/membership',
        query: { mediatype: 'movie', imdb: 'tt0111161' },
      },
    ],
    [
      'add_list_items',
      { list_id: 7, movies: [{ tmdb: 630, imdb: 'tt0032138' }] },
      {
        method: 'POST',
        path: '/lists/7/items/add',
        body: { movies: [{ tmdb: 630, imdb: 'tt0032138' }], shows: undefined },
      },
    ],
    [
      'remove_list_items',
      { list_id: 7, shows: [{ imdb: 'tt0417299' }] },
      {
        method: 'POST',
        path: '/lists/7/items/remove',
        body: { movies: undefined, shows: [{ imdb: 'tt0417299' }] },
      },
    ],
    [
      'create_list',
      { name: 'My List', private: false },
      { method: 'POST', path: '/lists/user/add', body: { name: 'My List', private: false } },
    ],
    ['delete_list', { list_id: 7 }, { method: 'DELETE', path: '/lists/7' }],
  ],
  [
    ['get_list', { list: {} }],
    ['delete_list', { list_id: 0 }],
    ['get_list', { list: { id: 1, official: 'trending' } }],
    ['get_list', { list: { official: 'unknown' } }],
    ['get_list_items', { list: { username: 'jane' } }],
    ['browse_lists', { source: 'friends' }],
    ['get_list_membership', { mediatype: 'movie' }],
    ['add_list_items', { list_id: 1 }],
  ],
);

describe('markExternalLists', () => {
  it('renames id to external_id on each row', () => {
    expect(markExternalLists([{ id: 1, name: 'a' }, { id: 2 }])).toEqual([
      { external_id: 1, name: 'a' },
      { external_id: 2 },
    ]);
  });

  it.each([{ error: 'x' }, null, 'text'])('passes non-array responses through (%j)', (data) => {
    expect(markExternalLists(data)).toBe(data);
  });

  it('leaves rows without an id untouched', () => {
    const rows = [{ name: 'a' }, null, 3];
    expect(markExternalLists(rows)).toEqual(rows);
  });
});
