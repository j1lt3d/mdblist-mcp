import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('reads and trims the API key', () => {
    expect(loadConfig({ MDBLIST_API_KEY: '  abc  ' })).toEqual({ apiKey: 'abc' });
  });

  it.each([{}, { MDBLIST_API_KEY: '' }, { MDBLIST_API_KEY: '   ' }])(
    'throws when the API key is missing (%o)',
    (env) => {
      expect(() => loadConfig(env)).toThrow(/MDBLIST_API_KEY/);
    },
  );
});
